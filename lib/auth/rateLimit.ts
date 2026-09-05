// R1.3 — Shared rate-limiting used by the four protected routes: signup,
// signin, password-reset-request, and verification-code-resend.
//
// Implementation: in-memory sliding window. This is intentionally simple and
// dependency-free. It is scoped to a single process and is the correct default
// for this assessment, but it will NOT work across multiple server instances.
// If this ever runs on horizontally-scaled serverless, back it with Redis or
// the database. That limitation is called out in DOCUMENTATION.md.

type Result = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, number[]>();

function now() {
  return Date.now();
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Result {
  const cutoff = now() - windowMs;
  let hits = buckets.get(key) ?? [];

  // Drop timestamps that have fallen outside the window.
  hits = hits.filter((t) => t > cutoff);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const oldest = Math.min(...hits);
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now()) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  hits.push(now());
  buckets.set(key, hits);
  return { allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}
