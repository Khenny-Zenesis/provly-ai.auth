import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { resetPasswordSchema, zodErrors } from '@/lib/validation/authSchemas';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: 'Invalid input', errors: zodErrors(parsed.error) },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  // R1.7 — single-use and time-limited, enforced server-side.
  if (!record) {
    return NextResponse.json(
      { ok: false, message: 'This reset link is invalid.' },
      { status: 400 }
    );
  }
  if (record.usedAt) {
    return NextResponse.json(
      { ok: false, message: 'This reset link has already been used.' },
      { status: 400 }
    );
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { ok: false, message: 'This reset link has expired.' },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true, message: 'Password updated. You can sign in now.' });
}
