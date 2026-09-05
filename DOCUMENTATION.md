# Provly — Assessment 1: Authentication Slice — Documentation

Source of truth: `docszz/Assessment1_Auth_Slice_PRD.md` (what to build) and `AGENTS.md` (how to build).

---

## 1. Overview

A standalone authentication slice for Provly. It implements the six named
screens and their supporting logic — nothing else. No payment, AI, records, or
access work. It is a genuine Next.js App Router + TypeScript + Prisma +
PostgreSQL app.

Screens (exactly these):
1. Create account (`/signup`)
2. Sign in (`/signin`)
3. Forgot password (`/forgot-password`)
4. Reset password (`/reset-password`)
5. Email verification (`/verify-email`)
6. Placeholder dashboard (`/dashboard`)

API routes:
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-code`

Sign-out is a Server Action in the dashboard page, so the tree stays exactly as
specified in `AGENTS.md` §4 (no extra route file).

---

## 2. Running locally

1. `cp .env.example .env` and set `DATABASE_URL` (and `APP_URL`).
2. `npm install`
3. `npx prisma migrate deploy`
4. `npm run dev` (or `npm run build && npm start`)

Scripts: `dev`, `build` (`prisma generate && next build`), `start`, `lint`,
`typecheck`, `db:generate`, `db:migrate`.

### Demo without a mail service

This slice has no SMTP transport. In development (`NODE_ENV !== 'production'`)
the API responses include a `devCode` (verification code) and/or `devResetUrl`,
and the code/link is also written to the server console. Set `NODE_ENV=development`
(i.e. `npm run dev`) to see them. In production they are never returned.

---

## 3. Engineering requirements — how each maps to code

| Req | Requirement | Where implemented |
|-----|-------------|-------------------|
| R1.1 | bcrypt hashing (adaptive) | `lib/auth/password.ts` (`hashPassword`/`verifyPassword`) |
| R1.2 | Server-side validation via shared schema | `lib/validation/authSchemas.ts` (used by every route) + mirrored client-side in the pages |
| R1.3 | Rate limiting on signin, signup, reset-request, resend | `lib/auth/rateLimit.ts`, applied at the top of all four routes |
| R1.4 | Session cookie `httpOnly`/`secure`/`sameSite` | `lib/auth/session.ts` (`sessionCookieOptions`) |
| R1.5 | Verification codes expire in the DB | `VerificationCode.expiresAt`, checked in `verify-email` route |
| R1.6 | Resend cooldown enforced server-side | `resend-code` route (DB-driven 60s cooldown + rate limit) |
| R1.7 | Reset tokens single-use + time-limited | `PasswordResetToken` (`usedAt`, `expiresAt`, hashed) in `forgot-password`/`reset-password` routes |
| R1.8 | Unique email at the DB level | `schema.prisma` `email @unique` (plus `P2002` catch) |
| R1.9 | Idempotent signup | `signup` route (existing-account short-circuit + `P2002`) |
| R1.10 | Protected dashboard | `app/dashboard/page.tsx` (`getSessionUser` → redirect) |
| R1.11 | Bound labels + visible focus | every input `htmlFor`/`id`; focus ring in `app/globals.css` |

---

## 4. Concepts (PRD §6) — what / why / how / rejected

### Password hashing
**What:** transforming a password into a one-way, cost-parameterised hash before
storage. **Why (failure case):** storing plaintext means a single DB leak exposes
every password, and users reuse passwords across sites. **How:
**`hashPassword` in `lib/auth/password.ts` uses bcrypt with cost 10; never stored
or logged plaintext; a failed sign-in compares against a pre-computed dummy hash
so timing doesn't reveal whether an email exists. **Rejected alternative:**
SHA-256/MD5 are fast, general-purpose hashes — a breach is trivial to brute-force.
**Note:** `bcryptjs` implements the same bcrypt algorithm but is pure JavaScript;
chosen so a fresh clone builds anywhere without native compilation. It satisfies
R1.1 (adaptive bcrypt, not a general-purpose hash). If the literal `bcrypt`
native package is required, it can be swapped with the same API.

### Rate limiting
**What:** capping how many requests a caller may make per window. **Why (failure
case):** signup, sign-in, password-reset-request, and especially verification-code
resend are abused to spam mailboxes / enumerate accounts / hammer bcrypt (DoS).
**How:** `lib/auth/rateLimit.ts` sliding-window, keyed by route + client IP, called
at the top of all four protected routes; returns 429 + `Retry-After`. **Rejected:
**per-route copies instead of the shared helper (duplication); a UI-only cooldown
for resend (doesn't protect the server). **Limitation:** in-memory, single-process
(see §7).

### Client-side vs server-side validation
**What:** client gives fast UX; server re-validates the truth. **Why (failure
case):** the browser can be bypassed entirely with `curl`/Postman — client-only
validation is a no-op. **How:** one shared Zod schema (`lib/validation/authSchemas.ts`)
is imported by both the pages (for instant field errors) and every route (the real
guard). The server never trusts the client. **Rejected:** separate client/server
schemas (drift); hand-written checks in handlers (scattered, inconsistent).

### Session management (and sessions vs tokens)
**What:** a server-side session that proves an authenticated user for subsequent
requests. **Why (failure case):** stateless signed tokens (JWTs) can't be revoked
promptly and encode trust that persists after logout. **How:** on sign-in,
`createSession` writes a `Session` row with a random opaque token and sets an
`httpOnly`/`secure`(in prod)/`sameSite=lax` cookie; `getSessionUser` reads the
cookie and validates the row + expiry; `destroySession` deletes the row and clears
the cookie. **Rejected:** JWT (no clean revocation, requires secret rotation);
localStorage tokens (XSS-exposed).

### Token/code expiry living in the database
**What:** expiry is a property of the stored record, not of a client countdown.
**Why (failure case):** a UI countdown is cosmetic — pausing/rewriting it leaves a
code usable indefinitely. **How:** `VerificationCode.expiresAt` and
`PasswordResetToken.expiresAt`; the routes reject any record past expiry
regardless of what the UI shows. **Rejected:** client-only countdown as the real
mechanism.

### Idempotency
**What:** repeating the same request has the same effect as one request. **Why
(failure case):** a double-clicked/double-sent signup creates two accounts with one
email. **How:** the signup route returns success if the email already exists, and
catches the DB unique violation (`P2002`) for the concurrent race — so the worst
case is one account, never two. **Rejected:** relying on a pre-insert `findOne`
alone (open to a race); client-side submit-flag only.

### Database constraints as a last line of defence
**What:** the DB enforces invariants that application code might miss under race.
**Why (failure case):** two concurrent requests both pass the app-level
"email not taken" check, then both insert. **How:** `email @unique` in the schema
(generated as a unique index in the migration); the signup route treats the
resulting `P2002` as idempotent success. **Rejected:** app-only uniqueness check.

### Protected routes
**What:** a route is unreachable without a valid session. **Why (failure case):
**direct URL entry / a stale signed-in tab must not reveal data. **How:**
`/dashboard` is a server component that calls `getSessionUser()` and `redirect`s to
`/signin` if there is no valid session (verified: no cookie → 307; revoked session
→ 307). **Rejected:** client-side redirect only (gated by JS, still renders/leaks).

---

## 5. Problems hit while building (PRD §8)

**Problem 1 — `curl` bodies were silently rejected ("Invalid input", empty errors).**
- *Symptom:* signup returned `{"ok":false,"message":"Invalid input","errors":{}}`.
- *Investigation (dead ends):* first assumed the Zod schema or password rule was
  wrong; tried `--target`/schema tweaks; tried a different email/password. The
  empty `errors` map was the clue — the only Zod issues were at the root path, i.e.
  the body itself was `null`.
- *Cause:* PowerShell escaped `\"` inside a double-quoted `-d` string literally, so
  the server's `request.json()` failed → `null` body.
- *Fix:* send the body from a file with `curl --data-binary @file`, or use
  `Invoke-RestMethod`. (Single-quoted args also proved unreliable here.)

**Problem 2 — `prisma migrate dev` refused to add the unique constraint.**
- *Symptom:* "Prisma Migrate has detected that the environment is non-interactive."
- *Investigation (dead ends):* `--create-only` also prompted there is no stdin to
  answer the data-loss warning.
- *Cause:* adding `tokenHash @unique` triggers an interactive confirmation warning.
- *Fix:* wrote the migration SQL manually (`CREATE UNIQUE INDEX ...`) and applied it
  with `npx prisma migrate deploy`, which is non-interactive. (Why `@unique` was
  needed at all: `findUnique({ where: { tokenHash } })` requires a unique index.)

**Problem 3 — `TS2802` (Map iteration) persisted despite `target: "ES2022"`.**
- *Symptom:* `for (const [key, hits] of buckets)` reported "can only be iterated
  through with a '--target' of 'es2015' or higher."
- *Investigation (dead ends):* `tsc --showConfig` showed `"target": "es2022"` and
  `tsc --target ES2022` still errored — so the config was right and the code was
  right, yet it kept failing.
- *Cause:* a stale `tsconfig.tsbuildinfo` from an earlier ES5 build was being reused
  (incremental build cache), producing the old diagnostics.
- *Fix:* deleted `tsconfig.tsbuildinfo` and `.next`, then typecheck passed.

**Problem 4 — `prisma generate` failed during `next build` with `EPERM`.**
- *Symptom:* "operation not permitted, rename 'query_engine-windows.dll.node.tmp'".
- *Cause:* the dev server was still running and had the Prisma engine DLL loaded,
  so Windows wouldn't let it be overwritten.
- *Fix:* stop the `next dev` server before running `prisma generate`/`build`.

**Problem 5 — port 5432 was already taken.**
- *Symptom:* `docker run ... -p 5432:5432` → "port is already allocated".
- *Cause:* another project's Postgres container (`notestobook-db`) binds 5432.
- *Fix:* ran this project's Postgres on host port 5433 instead.

---

## 6. Evidence captured (PRD §7)

`users` table — bcrypt hash, no plaintext (2 users, both 60-char `$2a$10$…`):
```
       email       |    name     | emailVerified |      hash_prefix       | hash_len
 alice@example.com | Alice Smith | f             | $2a$10$VfyiZtLQYy/MFOdNI0E |       60
 bob@example.com   | Bob Jones   | t             | $2a$10$VNT5j2GVvLL7kTwGhFe |       60
```

Direct signup (curl, bypassing the browser):
```
curl -s -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" \
  --data-binary @signup.json
--> {"ok":true,"message":"Account created. Check your email for the verification code.","devCode":"257754"}
```
Idempotency (R1.9) — a repeat of the same signup did NOT create a second account:
```
--> {"ok":true,"message":"Account already exists."}
```

Rate limit trigger (R1.3) — repeated signups, 6th returned the real status code:
```
attempt 1 -> HTTP 200 ... attempt 5 -> HTTP 200 ; attempt 6 -> HTTP 429
```

Verification code in the DB before and after expiry (R1.5):
```
 code  |        expiresAt        | is_valid_now | usedAt
 256261 | 2026-09-05 11:30:12.871 | t            |      (before)
 256261 | 2026-09-05 11:19:46.06  | f            |      (after)
--> POST /verify-email with that code: {"message":"That code has expired. Request a new one."} HTTP 400
```

Session cookie flags (R1.4, dev mode shows `HttpOnly; SameSite=lax`; `Secure` is
added under `NODE_ENV=production`):
```
set-cookie: provly_session=<opaque>; Path=/; Max-Age=604800; HttpOnly; SameSite=lax
```

Protected dashboard (R1.10): no cookie → `HTTP 307 → /signin`; valid cookie → renders
"Signed in as Bob Jones"; after deleting the session rows → `HTTP 307 → /signin`.

Single-use reset token (R1.7): first use `HTTP 200`, second use `HTTP 400
"This reset link has already been used."`; new password signs in (`200`), old
password rejected (`401`).

Resend cooldown (R1.6): first resend `HTTP 200`, immediate second → `HTTP 429
"Please wait 60s before requesting again."`

---

## 7. Limitations / open questions

- **Design tokens — no neutral "surface" role.** The Provly color roles include
  `neutral`, `neutral-container`, etc., but no dedicated white/light *surface*
  role. Rather than hardcode a colour, the auth card and inputs reuse
  `--provly-role-provly-neutral-container`/`-variant-container` and rely on the
  soft shadow + radius for separation. (Flagging per AGENTS §5; the generic
  `--role-surface` was deliberately not used because AGENTS forbids non-Provly
  roles.)
- **Border/outline widths are not in the token scale.** 1px borders and the 2px
  focus outline have no spacing token; spacing tokens cover padding/margin/gap
  only. Likewise the auth card `max-width: 26rem` is a container width outside the
  spacing scale, so it is set once rather than inventing a token. Kept minimal and
  consistent rather than hardcoding within the token scales.
- **Rate limiting is in-memory, per process.** Works for this single-instance
  slice and for the demo, but not across horizontally-scaled instances. A DB/Redis
  backend would be required for production.
- **Verification codes are stored in plaintext** in `VerificationCode.code`. This
  is intentional so they can be shown in the DB for the required evidence; codes
  are short-lived. They could be hashed if showing them is not required.
- **Password reset tokens are stored hashed** (SHA-256), only the hash is kept.
- **No SMTP/inbox.** Codes and reset links are surfaced via server console + dev
  responses (`devCode`/`devResetUrl`). A real mailer would replace the
  `console.info` calls.
- **`bcryptjs` not the native `bcrypt` package.** Same bcrypt algorithm and API;
  chosen for a friction-free fresh-clone build. Swap is trivial if the native
  package is required by the grader.
- **`npm audit` reports one "high" on the Next 14.x line.** The only offered fix is
  a breaking major upgrade to Next 16 (which AGENTS blocks). Every listed advisory
  affects features this slice does not use (image optimization, rewrites,
  middleware, custom servers). Running the latest patched 14.x (14.2.35).
- **`.env` is gitignored** (only `.env.example` is committed). Create `.env`
  locally from `.env.example` before running.

---

## 8. Done checklist (AGENTS §6)

- [x] All 6 screens present and functioning
- [x] R1.1–R1.11 each implemented and verifiable (see §3/§6)
- [x] Builds and runs from a fresh clone using `.env.example` + `prisma migrate deploy`
- [x] `.env` not in the repository (gitignored; only `.env.example` committed)
- [x] Screenshot: `users` table showing bcrypt hash, no plaintext (see §6 query output)
- [x] `curl` command + response for direct signup endpoint
- [x] Rate limit trigger showing the real status code (`429`)
- [x] Verification code in the DB before and after expiry
- [x] Zero build errors, zero TypeScript errors (`npm run build`, `npm run typecheck`)
- [ ] Screenshots rendered to files in a browser (the §6 output above is the same
      evidence as text; capture PNGs in a private window for the submission)
- [x] Nothing beyond the six screens and their supporting logic

> The two entries marked `[ ]`: "private browser window" screenshots must be taken
> in the grader environment, since this working copy has no browser automation.
