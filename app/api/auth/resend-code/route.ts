import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { resendCodeSchema, zodErrors } from '@/lib/validation/authSchemas';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // R1.6 — server-enforced cooldown
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const RESEND_LIMIT = 3;

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'local';
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = resendCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: 'Invalid input', errors: zodErrors(parsed.error) },
      { status: 400 }
    );
  }

  // R1.3 — rate limit the resend route (the one most commonly forgotten).
  const rate = checkRateLimit({
    key: `resend-code:${clientIp(request)}`,
    limit: RESEND_LIMIT,
    windowMs: RESEND_WINDOW_MS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: false, message: 'No account found for that email.' }, { status: 404 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, message: 'This email is already verified.' });
  }

  // R1.6 — the cooldown is enforced here, not just by disabling a button.
  const latest = await prisma.verificationCode.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.max(
      1,
      Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) / 1000)
    );
    return NextResponse.json(
      { ok: false, message: `Please wait ${wait}s before requesting again.` },
      { status: 429, headers: { 'Retry-After': String(wait) } }
    );
  }

  const code = generateCode();
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  console.info(`[resend-code] verification code for ${email}: ${code}`);

  const response: Record<string, unknown> = {
    ok: true,
    message: 'A new verification code has been sent.',
  };
  if (process.env.NODE_ENV !== 'production') {
    response.devCode = code;
  }

  return NextResponse.json(response);
}
