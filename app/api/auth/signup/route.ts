import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import {
  signupSchema,
  zodErrors,
} from '@/lib/validation/authSchemas';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes — enforced in the DB, not the UI
const SIGNUP_WINDOW_MS = 15 * 60 * 1000;
const SIGNUP_LIMIT = 5;

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'local';
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// No mail transport in this slice: the code is logged, and returned as devCode
// in development, so the verification flow is demonstrable end-to-end.
async function issueVerificationCode(userId: string, email: string): Promise<string> {
  const code = generateCode();
  await prisma.verificationCode.create({
    data: {
      userId,
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  console.info(`[signup] verification code for ${email}: ${code}`);
  return code;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: 'Invalid input', errors: zodErrors(parsed.error) },
      { status: 400 }
    );
  }

  // R1.3 — rate limit signup.
  const rate = checkRateLimit({
    key: `signup:${clientIp(request)}`,
    limit: SIGNUP_LIMIT,
    windowMs: SIGNUP_WINDOW_MS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const { name, email, password } = parsed.data;

  try {
    // R1.9 — idempotency: an existing account must never create a second one.
    // The unique index on email (R1.8) is the backstop for the concurrent
    // double-submit race, caught below as a P2002.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Distinguish a COMPLETED signup (already verified → tell the user to
      // sign in) from an INCOMPLETE one (exists but not verified → continue by
      // issuing a fresh verification code). Previously this returned a generic
      // success for both, which wrongly sent a verified user to the verify page.
      if (existing.emailVerified) {
        return NextResponse.json(
          {
            ok: false,
            message: 'This email is already registered. Please sign in instead.',
          },
          { status: 409 }
        );
      }

      const code = await issueVerificationCode(existing.id, email);
      const response: Record<string, unknown> = {
        ok: true,
        verified: false,
        message:
          'An account exists for this email but it is not verified yet. Enter the code to finish signing up.',
      };
      if (process.env.NODE_ENV !== 'production') {
        response.devCode = code;
      }
      return NextResponse.json(response);
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { email, name, passwordHash },
    });

    const code = await issueVerificationCode(user.id, email);

    const response: Record<string, unknown> = {
      ok: true,
      verified: false,
      message: 'Account created. Check your email for the verification code.',
    };
    if (process.env.NODE_ENV !== 'production') {
      response.devCode = code;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    // P2002 = unique constraint violation on email (R1.8). Treat a concurrent
    // duplicate create as idempotent success (R1.9).
    const code = (error as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json({ ok: true, message: 'Account already exists.' });
    }
    console.error('[signup] error', error);
    return NextResponse.json(
      { ok: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
