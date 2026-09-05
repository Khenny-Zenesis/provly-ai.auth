import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

const COOKIE_NAME = 'provly_session';

// R1.4 — Session cookie flags are set correctly so the session ID can't be
// read or forged from client-side JavaScript, can't travel over plain HTTP in
// production, and isn't sent cross-site.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

// A server-side session. The cookie holds nothing meaningful besides an
// opaque random token; the authoritative record lives in the Session table.
// Because the token is opaque (not a signed JWT), a session is invalidated
// simply by deleting its row — no secret rotation or revocation list needed.
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { token, userId, expiresAt },
  });

  cookies().set(COOKIE_NAME, token, sessionCookieOptions());
  return token;
}

export async function getSessionUser(): Promise<User | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;

  // R1.5/R1.10 — expiry is enforced from the DB record, not from anything
  // the client shows. Expired sessions are cleaned up and treated as signed out.
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return session.user;
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.delete({ where: { token } }).catch(() => undefined);
  }
  cookies().set(COOKIE_NAME, '', { ...sessionCookieOptions(), maxAge: 0 });
}
