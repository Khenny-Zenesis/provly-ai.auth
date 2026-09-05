import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword, DUMMY_PASSWORD_HASH } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { signinSchema, zodErrors } from '@/lib/validation/authSchemas';

const SIGNIN_WINDOW_MS = 15 * 60 * 1000;
const SIGNIN_LIMIT = 10;

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'local';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = signinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: 'Invalid input', errors: zodErrors(parsed.error) },
      { status: 400 }
    );
  }

  // R1.3 — rate limit signin.
  const rate = checkRateLimit({
    key: `signin:${clientIp(request)}`,
    limit: SIGNIN_LIMIT,
    windowMs: SIGNIN_WINDOW_MS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Run a comparison either way so response time doesn't reveal whether the
  // email is registered (a classic user-enumeration timing oracle).
  const hashToCheck = user ? user.passwordHash : DUMMY_PASSWORD_HASH;
  const passwordOk = await verifyPassword(password, hashToCheck);

  if (!user || !passwordOk) {
    return NextResponse.json(
      { ok: false, message: 'Invalid email or password.' },
      { status: 401 }
    );
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { ok: false, message: 'Please verify your email before signing in.' },
      { status: 403 }
    );
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
