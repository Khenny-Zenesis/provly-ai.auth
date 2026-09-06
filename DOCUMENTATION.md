# Assessment 1 — Authentication Slice — Documentation

## Section 1: What This Is

<!-- Two paragraphs, no more. First: what the slice does, plain language.
     Second: what's deliberately not included, and why. -->

This project is a standalone authentication system — create account, sign in, forgot password, reset password, and email verification — ending at a placeholder dashboard. A new user can register, verify their email, and reach the dashboard; a returning user can sign in; a user who forgets their password can reset it.

This is deliberately not the full Provly application. There is no landing page, no marketing page, no dashboard features beyond a signed-in user's name and a sign-out button, no profile editing, no settings, no social sign-in, and no two-factor authentication. The scope is limited on purpose, so that the authentication logic itself — not surrounding features — is what gets evaluated.

## Section 2: How To Run It

1. public repository:http://github.com/Khenny-Zenesis/provly-ai.auth

Clone the repository:```bash
     $git clone https://github.com/Khenny-Zenesis/provly-ai.auth
2. npm install
3. Environment variables needed (see `.env.example`):
   - `DATABASE_URL` — postgreSQL connection string (prisma datasource).
   From local postgres or Neon dashboard.
   Example:
   postgresql://postgres:postgres@localhost:5433/provly?schema=public`
   - `APP_URL` - Public base URL used to build password-reset and verification links.
   Example: `http://localhost:3000` for local dev
4. Database setup: `npx prisma migrate dev`
5. Start command: `npm run dev`
6. URL where it appears: `http://localhost:3000`

## Section 3: The Flow, Step By Step

Sign-up and verification. A new user fills in their name, email, and password on the sign-up screen (app/(auth)/signup/page.tsx). On submit, the frontend sends this data to POST /api/auth/signup (app/api/auth/signup/route.ts). The server first checks whether an account already exists for that email — if it exists and is already verified, the request is rejected with "This email is already registered. Please sign in instead."; if it exists but was never verified, or doesn't exist at all, the server hashes the password (lib/auth/password.ts), creates the user record, generates a verification code, and redirects the user to the verification screen (app/(auth)/verify-email/page.tsx). The user enters the code, which is sent to POST /api/auth/verify-email; the server checks the code against the stored value and its expiry (10 minutes), and on success, creates a session and sends the user to the dashboard.

Sign-in. A returning user enters email and password on app/(auth)/signin/page.tsx, which sends the credentials to POST /api/auth/signin. The server compares the submitted password against the stored bcrypt hash and, on a match, creates a new session before redirecting to the dashboard. Repeated failed attempts are rate-limited (lib/auth/rateLimit.ts) — after several incorrect tries, the endpoint returns a 429 status with "Too many attempts. Please try again later."

Forgot / reset password. The user requests a reset from app/(auth)/forgot-password/page.tsx, which calls POST /api/auth/forgot-password. The server generates a single-use, time-limited reset token (30 minutes) and returns a reset link. Following that link loads app/(auth)/reset-password/page.tsx, where the user sets a new password; this submits to POST /api/auth/reset-password, which verifies the token is still valid and unused before updating the password hash and invalidating the token.

Protected dashboard. app/dashboard/page.tsx checks for a valid session (lib/auth/session.ts) before rendering. A signed-out user who navigates to /dashboard directly is redirected to sign-in rather than seeing any dashboard content — confirmed directly by testing this exact case.

Sign-out. Triggered from the dashboard, this ends the current session, after which the dashboard becomes unreachable again until a new sign-in occurs.


## Section 4: The Data Model

User — one row per account.

id (String, cuid): a non-sequential, non-guessable identifier. Chosen over an auto-incrementing integer specifically to avoid IDs that are easy to enumerate or guess.
email (String, @unique): enforced unique at the database level, not just checked in application code. This is the real backstop behind R1.8 — even if a future code change accidentally skips the application-level existence check, the database itself will refuse a duplicate insert.
passwordHash (String): only ever the bcrypt hash, never the plain password.
emailVerified (Boolean, default false): the flag that distinguishes a completed account from an in-progress signup. This is the exact field the duplicate-email bug (Section 6) was missing a check against — the original signup handler only asked "does this email exist?" instead of "does this email exist and is it verified?"

Session — one row per active login.

token (String, @unique): the value stored client-side; uniqueness at the database level prevents any possibility of two sessions colliding on the same token.
userId with onDelete: Cascade: if a user were ever deleted, their sessions are automatically removed with them — no orphaned session rows left pointing at a nonexistent user.
expiresAt (DateTime): session lifetime enforced by checking this field server-side on every protected request.

VerificationCode — one row per email-verification attempt.

code (String): stored in plain form deliberately, not hashed. This was a conscious trade-off, not an oversight — a verification code is short-lived (10 minutes), single-purpose, and only proves someone can read the account's email, unlike a password which grants full account control. Storing it in plain form also made it possible to show it directly in the database as required evidence for this assessment.
expiresAt / usedAt: expiry is a real database value, not just a countdown shown in the UI (R1.5) — confirmed directly by testing that an expired code is rejected server-side.

PasswordResetToken — one row per reset request.

tokenHash (String, @unique): unlike the verification code, this is hashed before storage. The reasoning is the opposite trade-off: a reset token grants the ability to take over the account entirely by setting a new password, so if the database were ever exposed, an unhashed token would hand over immediate account access. A verification code carries much lower stakes by comparison.
expiresAt (30 minutes) / usedAt: same single-use, time-limited pattern as the verification code (R1.7).

Which constraints make an invalid state impossible:

User.email @unique — makes two accounts sharing one email impossible at the database level, regardless of what application code does or fails to check. This is the real safety net behind the bug found and fixed in Section 6.
Session.token @unique and PasswordResetToken.tokenHash @unique — make token collision between two different sessions or reset requests impossible.
The onDelete: Cascade foreign keys on all three child tables make an orphaned row (one pointing to a user that no longer exists) impossible.

Honest limitation: expiry itself is not enforced by a database-level constraint — there's no rule stopping usedAt from theoretically being set after expiresAt at the schema level. That check currently lives entirely in application code (the route handlers compare expiresAt against the current time before accepting a code or token). This was confirmed working correctly through direct testing, but it's worth being explicit that the enforcement is at the application layer, not the database layer, for this slice.

## Section 5: The Concepts

<!-- Required concepts: password hashing, rate limiting, client vs server
     validation, session management, token/code expiry, idempotency,
     database constraints, protected routes.
     Each gets: What it is / Why it's needed / How I implemented it /
     What I chose against, and why. -->

### Password Hashing
- What it is:
- Why it is needed:
- How I implemented it:
- What I chose against, and why:

### Rate Limiting
- What it is:
- Why it is needed:
- How I implemented it:
- What I chose against, and why:

### Client-Side vs. Server-Side Validation
- What it is:
- Why it is needed:
- How I implemented it:
- What I chose against, and why:

### Session Management
- What it is:
- Why it is needed:
- How I implemented it:
- What I chose against, and why:

### Token and Code Expiry
- What it is:
- Why it is needed:
- How I implemented it:
- What I chose against, and why:

### Idempotency
- What it is:
- Why it is needed:
- How I implemented it:
- What I chose against, and why:

### Database Constraints as a Last Line of Defense
- What it is:
- Why it is needed:
- How I implemented it:
- What I chose against, and why:

### Protected Routes
- What it is:
- Why it is needed:
- How I implemented it:
- What I chose against, and why:

## Section 6: What Went Wrong

<!-- Minimum 3 real problems: symptom, investigation (including dead ends),
     cause, fix. WRITE THESE DOWN AS THEY HAPPEN — don't try to remember
     them after the fact. Use the scratch space below while building. -->

### Problem 1
- Symptom:
- Investigation:
- Cause:
- Fix:

### Problem 2
- Symptom:
- Investigation:
- Cause:
- Fix:

### Problem 3
- Symptom:
- Investigation:
- Cause:
- Fix:

## Section 7: What This Slice Does Not Handle

<!-- Honest limitations. What breaks at scale, what's needed before real
     users, what was left out as out-of-brief vs. out-of-time. -->

*(To be written near the end, once the full picture is clear.)*

## Section 8: If I Built This Again

<!-- One paragraph. The single biggest thing you'd do differently, and why. -->

*(To be written last.)*

---

## 🗒️ Scratch notes (delete before final submission)

*Use this space to jot down problems, error messages, and fixes the moment they happen while building — this becomes the raw material for Section 6. Don't rely on remembering it later.*

-
-
-