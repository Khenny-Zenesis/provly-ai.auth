import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyEmailSchema, zodErrors } from '@/lib/validation/authSchemas';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: 'Invalid input', errors: zodErrors(parsed.error) },
      { status: 400 }
    );
  }

  const { email, code } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { ok: false, message: 'No account found for that email.' },
      { status: 404 }
    );
  }

  const record = await prisma.verificationCode.findFirst({
    where: { userId: user.id, usedAt: null, code },
    orderBy: { createdAt: 'desc' },
  });

  // R1.5 — expiry is enforced here against the DB record. Even if the UI
  // freeze-frames a countdown, an expired code is rejected server-side.
  if (!record) {
    return NextResponse.json(
      { ok: false, message: 'That code is invalid.' },
      { status: 400 }
    );
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { ok: false, message: 'That code has expired. Request a new one.' },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    }),
    prisma.verificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true, message: 'Email verified. You can sign in now.' });
}
