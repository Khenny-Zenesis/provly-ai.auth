import bcrypt from 'bcryptjs';

// R1.1 — Password hashing with bcrypt (an adaptive, cost-factor algorithm),
// deliberately NOT a general-purpose hash like SHA-256 or MD5. bcryptjs
// implements the same bcrypt algorithm but is pure JavaScript, so it builds
// on any platform without native compilation (which matters for a fresh clone).
const SALT_ROUNDS = 10;

// bcrypt only uses the first 72 bytes of an input; planning around that keeps
// a long password from silently being truncated in confusing ways.
export const PASSWORD_MAX_BYTES = 72;

// A pre-computed bcrypt hash of a fixed, non-real string. Used only to make
// sign-in time roughly constant whether or not an email exists, so a caller
// can't probe which emails are registered by watching response timing.
const DUMMY_PLAIN = 'provly-dummy-signin-probe';
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(DUMMY_PLAIN, SALT_ROUNDS);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
