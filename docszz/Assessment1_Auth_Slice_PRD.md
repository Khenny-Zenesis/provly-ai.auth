# Assessment 1 — Authentication Slice — PRD

## 1. What this is

A complete, standalone authentication system: create account, sign in, forgot password, reset password, email verification, and a placeholder dashboard. This is a real slice of Provly's actual auth (PRD Section 5, R1) — built to hold up on its own, with nothing extra around it.

**This is not the full Provly app.** No landing page, no marketing page, no real dashboard features, no profile editing, no settings, no social sign-in, no two-factor. The dashboard is one line of text ("Signed in as [name]") and a sign-out button. Nothing else. Building anything beyond this scope actively hurts the grade — restraint is the assignment.

## 2. Tech stack (locked, matches main Provly PRD)

Next.js (App Router), TypeScript, Prisma, PostgreSQL. Build in Antigravity.

## 3. Screens (exactly these, nothing more)

1. Create account
2. Sign in
3. Forgot password (request form)
4. Reset password (form reached via emailed link)
5. Email verification (code entry + resend control)
6. Placeholder dashboard (signed-in user's name + sign-out button, nothing else)

## 4. Behavior requirements

- A new user can create an account, verify their email, and reach the dashboard.
- A returning user can sign in.
- A user who forgets their password can reset it and sign in with the new one.
- A signed-out user who types the dashboard URL directly is redirected to sign in.
- Sign out properly ends the session.

## 5. Engineering requirements (all required, all graded)

- **R1.1** — Password hashing with bcrypt (adaptive algorithm), not a general-purpose hash like SHA-256.
- **R1.2** — Server-side validation on every input, declared as a schema (e.g. Zod), not scattered through handlers. Client-side validation mirrors the same schema.
- **R1.3** — Rate limiting on: signin, signup, password reset request, AND verification code resend. (The resend route is the one most people forget — it's the one that costs money if abused.)
- **R1.4** — Session management with correctly configured session cookie (httpOnly, secure, sameSite).
- **R1.5** — Email verification codes that expire in the database, not just visually in the UI countdown.
- **R1.6** — A resend cooldown enforced server-side, not just disabled client-side.
- **R1.7** — Password reset tokens: single-use, time-limited.
- **R1.8** — Unique constraint on email at the database level (not just application-level checking).
- **R1.9** — Idempotent signup endpoint — a double submission creates exactly one account.
- **R1.10** — Protected route handling — dashboard unreachable without a valid session.
- **R1.11** — Accessible inputs: labels programmatically bound to inputs, visible focus states.

## 6. Concepts to be able to explain (Section 5 of documentation)

For each of these, be ready to answer: what it is, why it's needed (with a concrete failure case, not "for security"), how it was actually implemented (file/function named), and what alternative was rejected and why:

- Password hashing
- Rate limiting
- Client-side vs. server-side validation
- Session management (and why sessions vs. tokens)
- Token/code expiry, and why expiry must live in the database
- Idempotency
- Database constraints as a last line of defense
- Protected routes

## 7. Evidence to capture WHILE building, not after

Some of this is hard to reconstruct later — capture it as you go:

- Screenshot of the `users` table showing a stored bcrypt hash (no plain password anywhere).
- The exact `curl` command used to hit the signup endpoint directly, bypassing the browser, plus the server's response.
- Evidence of the rate limit actually triggering — the status code returned.
- A verification code in the database, and the same record after it expires.

## 8. Keep a running log as you build

Section 6 of the documentation requires at least 3 real problems hit while building — symptom, investigation (including dead ends), cause, fix. Write these down the moment they happen. They're much harder to reconstruct accurately after the fact than to jot down in the moment.

## 9. Known traps (from the assignment itself)

- Validating only on the client and calling it done.
- Building the dashboard instead of the actual authentication.
- Verification codes with no server-side expiry (UI countdown as theater).
- Committing the `.env` file.
- Rate limiting signin but forgetting the resend route.
