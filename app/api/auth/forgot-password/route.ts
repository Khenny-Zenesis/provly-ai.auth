import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { forgotPasswordSchema, zodErrors } from '@/lib/validation/authSchemas';

const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes — R1.7 time-limited
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_LIMIT = 5;

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'local';
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: 'Invalid input', errors: zodErrors(parsed.error) },
      { status: 400 }
    );
  }

  // R1.3 — rate limit the reset-request route.
  const rate = checkRateLimit({
    key: `forgot-password:${clientIp(request)}`,
    limit: RESET_LIMIT,
    windowMs: RESET_WINDOW_MS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const { email } = parsed.data;

  // Always return the same generic message so this endpoint cannot be used to
  // enumerate which emails have accounts.
  const genericMessage = 'If that email is registered, a reset link is on its way.';

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: true, message: genericMessage });
  }

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  // R1.7 — store only the hash. Single-use: the route that consumes it marks
  // it used and only accepts a token whose usedAt is still null.
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  // No mail transport in this slice; log the link so the flow is demonstrable.
  console.info(`[forgot-password] reset link for ${email}: ${resetUrl}`);

  const response: Record<string, unknown> = { ok: true, message: genericMessage };
  if (process.env.NODE_ENV !== 'production') {
    response.devResetUrl = resetUrl;
  }

  return NextResponse.json(response);
}
