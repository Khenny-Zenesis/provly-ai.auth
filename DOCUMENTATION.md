# Assessment 1 — Authentication Slice — Documentation

## Section 1: What This Is

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
Password Hashing

What it is. Hashing turns a password into a fixed-length string that can't be reversed back into the original. When someone signs in, the password they typed is hashed and compared against the stored hash — the real password is never stored anywhere.

Why it is needed. If the database were ever read by someone who shouldn't have it, plain-text passwords would hand over every account immediately — and because people commonly reuse passwords, it would likely hand over their accounts on other services too. Hashing means a stolen database only gives an attacker a set of strings that are computationally expensive to reverse.

How I implemented it. bcrypt via the bcryptjs package, cost factor 10, in lib/auth/password.ts:

```typescript
const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

![Password stored as bcrypt hash](evidence/password-hash-db.png)

I also added a small extra protection beyond the base requirement: DUMMY_PASSWORD_HASH, a pre-computed hash of a fixed dummy string, used during sign-in so that comparison timing stays roughly constant whether or not the submitted email actually exists — this prevents someone from figuring out which emails are registered just by measuring how fast the server responds.

What I chose against, and why. SHA-256 and similar general-purpose hashes are fast by design — which is exactly what makes them wrong for passwords, since speed is what lets an attacker try millions of guesses per second against a stolen hash. Argon2 is a defensible, arguably stronger modern alternative, but I chose bcrypt because it's well-supported and well-understood in this stack. I also specifically chose the pure-JavaScript bcryptjs package over native bcrypt — native bcrypt requires platform-specific compilation during install, which risks breaking the "runs from a fresh clone in under 10 minutes" requirement on a machine without the right build tools already set up. bcryptjs avoids that risk entirely at a small performance cost that doesn't matter at this scale.

Rate Limiting

What it is. Rate limiting caps how many times an action can be attempted within a given time window, blocking further attempts once that cap is reached until the window passes.

Why it is needed. Without it, someone could send thousands of sign-in attempts a minute trying to guess a password, and each attempt still costs a real database query. The resend-code endpoint is the one most likely to be forgotten, and it's specifically the one that costs real money — an attacker (or just a confused user clicking repeatedly) could trigger unlimited email sends without a limit in place.

How I implemented it. A shared, in-memory sliding-window limiter in lib/auth/rateLimit.ts, used across all four required routes (signup, signin, forgot-password, resend-code):

```typescript
const cutoff = now() - windowMs;
let hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

if (hits.length >= limit) {
  return { allowed: false, remaining: 0, retryAfterSeconds };
}

hits.push(now());
buckets.set(key, hits);
return { allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
```

![Rate limit 429 response](evidence/rate-limit-429.png)

Each key tracks an array of attempt timestamps; anything outside the current window is dropped before counting. Confirmed working directly by testing: repeated failed sign-in attempts returned a 429 status after the limit was reached.

What I chose against, and why. I deliberately chose a simple in-memory approach over a Redis- or database-backed rate limiter. For a single-process assessment running on one server, in-memory is the correct, lower-complexity default — reaching for an external dependency like Redis would have added real setup overhead for no benefit at this scale. The honest trade-off, which I've called out directly in the code comment: this only works correctly on a single server process. If this were ever deployed across multiple horizontally-scaled instances, each instance would track its own separate counts, effectively multiplying the real limit. That would need to move to a shared store (Redis or the database itself) before running at that scale.

Client-Side vs. Server-Side Validation

What it is. Client-side validation checks input in the browser before it's sent, giving instant feedback. Server-side validation checks the same input again once it actually arrives at the server. They look similar but serve different purposes — one is about user experience, the other is the real enforcement.

Why it is needed. The browser can always be bypassed entirely — I proved this directly by hitting the signup endpoint with curl, with no browser involved at all. If validation only existed on the client, that request could have sent anything: a one-character password, a malformed email, or worse. Server-side validation is what actually protects the data, regardless of how the request arrived.

How I implemented it. One shared Zod schema set in lib/validation/authSchemas.ts, imported and used identically on both the page components and the API route handlers — there is no second, separate validation implementation anywhere:

```typescript
import { PASSWORD_MAX_BYTES } from '@/lib/auth/password';

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(PASSWORD_MAX_BYTES, `Password must be at most ${PASSWORD_MAX_BYTES} characters`);
```
Worth calling out specifically: passwordSchema imports its maximum length directly from lib/auth/password.ts, the same constant used during hashing. bcrypt silently ignores anything past 72 bytes — so without this shared constant, two different long passwords sharing the same first 72 bytes could both hash to the same value, allowing either one to sign in. Sharing the constant makes that scenario structurally impossible rather than relying on remembering to keep two numbers in sync by hand.

What I chose against, and why. I could have written two separate validation implementations — simple HTML attributes (required, minlength) on the client, and independent hand-written checks on the server. I rejected this because two implementations inevitably drift apart over time: someone updates one and forgets the other, and the bug that results is exactly the dangerous kind — it passes casual testing because the client silently blocked the bad case, while the server would have quietly accepted it if reached directly.

Session Management

What it is. After a successful sign-in, the server needs a way to recognize the same user on their next request without asking for a password every time. A session is a server-side record of "this user is signed in," paired with an identifier stored in the browser that proves the connection between the two.

Why it is needed. Without sessions, every single page load or action would require re-entering credentials, which is unusable. Without doing sessions correctly, the alternative failure mode is worse: a session identifier that's readable by JavaScript can be stolen through a cross-site scripting attack, and a session that never properly expires or can't be revoked stays valid forever even after a user signs out.

How I implemented it. A database-backed session, not a JWT. The cookie holds nothing meaningful — just an opaque random token — with the real session record (userId, expiresAt) stored server-side in the Session table:

```typescript
function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
```

httpOnly prevents any client-side JavaScript from reading the cookie at all, closing off the main way a session token gets stolen via XSS. secure is conditional on the environment rather than hardcoded true — this was a deliberate practical choice: hardcoding it would break local development, since a real browser won't send a secure cookie over plain http://localhost. sameSite: 'lax' blocks the cookie from being sent on cross-site requests (protecting against CSRF) while still allowing it to be sent on a normal top-level link click, which matters because the password-reset flow depends on a link landing correctly from an email.

Expiry is checked directly against the database record every time getSessionUser() runs, not trusted from the cookie's own maxAge alone — an expired session is actively deleted and treated as signed out the moment it's encountered, tying this directly to R1.5 and R1.10.

What I chose against, and why. I chose an opaque, database-backed token over a signed JWT. A JWT would avoid a database lookup on every request, but it comes with a real cost: revoking a single session before its expiry means either maintaining a revocation blocklist or rotating the signing secret entirely — either of which adds real complexity. Because this token is opaque and the database is the source of truth, signing a user out (destroySession) is just deleting one row. Simpler, and correct by construction rather than by remembering to check a blocklist everywhere.

Token and Code Expiry

What it is. Verification codes and password reset tokens are only valid for a limited window of time — 10 minutes for a code, 30 minutes for a reset token — after which they stop working even if someone still has the correct value.

Why it is needed. A code or token that never expires is a permanent liability: if one is ever intercepted, glimpsed over someone's shoulder, or left in an old email, it would remain usable indefinitely. A short expiry window limits how long that exposure actually matters.

How I implemented it. Every code and token carries its own expiresAt timestamp in the database, set at creation time (new Date(Date.now() + CODE_TTL_MS) for codes, similarly for reset tokens). Crucially, expiry is checked by comparing this stored timestamp against the current time at the moment of use — not by trusting a countdown shown in the UI, which is exactly why it's enforceable even if the client displaying that countdown is bypassed entirely. This was confirmed directly by testing: entering an expired code returns a rejection with "verification expired, request for new one," and the database shows the row's usedAt remains null while expiresAt has already passed.


![Verification codes with expiresAt and usedAt](evidence/verification-code-expiry-db.png)

What I chose against, and why. I could have relied only on the client-side countdown timer to disable the input once time was up, without a real server-side check. I rejected this immediately — a countdown is purely cosmetic if the server will still accept the value after it visually expires. The same principle used throughout this slice applies here: anything the client shows is a convenience, never the actual enforcement.

Idempotency

What it is. An idempotent operation produces the same end result no matter how many times it's performed. Submitting a signup request once, or accidentally submitting it twice — from a double-click, a slow network triggering a retry, or someone deliberately replaying it — should never result in two accounts existing where there should be one.

Why it is needed. Without it, a simple double-click on the submit button could create two accounts sharing the same real person's information, or worse, leave the system in an inconsistent state depending on exactly which request happened to finish first.

How I implemented it. Two layers, not one — because a single check has a real gap the second layer closes. First, an application-level check before creating a user: look up the email, and if it exists, branch on whether it's already verified rather than blindly treating every existing email the same way (this is the exact fix from the Section 6 bug). Second, a database-level backstop for the case where two requests arrive close enough together that both pass the existence check before either has actually inserted its row — a genuine race condition no application-level check alone can fully close:

```typescript
catch (error) {
  // P2002 = unique constraint violation on email (R1.8). Treat a concurrent
  // duplicate create as idempotent success (R1.9).
  const code = (error as { code?: string }).code;
  if (code === 'P2002') {
    return NextResponse.json({ ok: true, message: 'Account already exists.' });
  }
  ```

When the database rejects a concurrent duplicate insert, that's caught and treated as an expected, idempotent outcome — not an error.

Evidence — hitting the endpoint directly, bypassing the browser entirely:

First signup for a new email:

$ curl.exe -s -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" --data-binary "@$env:TEMP\signup.json"
{"ok":true,"verified":false,"message":"Account created. Check your email for the verification code.","devCode":"286255"}

Same request repeated against an email that's already registered and verified:

$ curl.exe -s -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" --data-binary "@$env:TEMP\signup.json"
{"ok":false,"message":"This email is already registered. Please sign in instead."}

This confirms the idempotency fix holds at the server level, independent of the browser or any client-side logic — the exact scenario the "prove it works" evidence for this assessment requires.

What I chose against, and why. I could have relied only on the findUnique existence check before insert, without also catching the database-level conflict. I rejected that because it leaves a real timing window open: two near-simultaneous requests can both pass the existence check — finding nothing — before either has actually written its row. The second create call then fails against the database's unique constraint regardless of what the application-level check found earlier. Without explicitly catching that specific failure and treating it as a normal, expected case, a real user hitting this timing window would see a raw server error instead of the same clean response as anyone else who tried to sign up with an existing email.

Database Constraints as a Last Line of Defense
What it is:
Why it is needed:
How I implemented it:
What I chose against, and why:
Protected Routes

What it is. A protected route requires proof of an active, valid session before it renders anything at all — checked on the server before a response is sent, not hidden on the client after the fact.

Why it is needed. Without a server-side check, someone could reach the dashboard by typing its URL directly, returning via browser history after signing out, or simply disabling JavaScript to skip a client-side-only guard. This was confirmed directly by testing: navigating straight to /dashboard while signed out redirects to sign-in without ever showing dashboard content.

How I implemented it. DashboardPage is a Next.js Server Component — the session check runs on the server before any markup is returned:

```typescript
export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/signin');
  }
  ```

Because this check happens server-side before the response is generated, an unauthenticated request never receives any dashboard content as part of the response — not even briefly.

What I chose against, and why. I could have built this as a client component that fetches the current user after the page mounts, then redirects if none is found — a common pattern in older client-rendered React apps. I rejected this because it means the component (and potentially a flash of its shell) renders on the client before the check resolves, leaving a timing window where page structure or fetched data could be visible via dev tools before any redirect fires. A server-side check closes that gap entirely rather than relying on timing being fast enough.

Database Constraints as a Last Line of Defense

What it is. A database constraint is a rule enforced by the database engine itself, not by application code — making certain invalid states physically impossible to write, no matter what any code above it does or fails to check.

Why it is needed. Application code can have bugs, be skipped, race against itself, or simply be forgotten in a future change — which is exactly what happened with the duplicate-email bug in Section 6, where the application-level check didn't correctly distinguish a verified account from an unverified one. A database constraint doesn't depend on application logic being correct; it enforces the rule at the lowest possible level regardless.

How I implemented it. email String @unique on the User model, enforced by PostgreSQL itself:

```prisma
model User {
  email String @unique // R1.8: database-level uniqueness, not just app checks
}
```

This constraint is what actually closes the concurrent-signup race condition described in the Idempotency section — even in the moment two requests both pass the application's existence check, the database itself refuses the second insert.

What I chose against, and why. I could have relied purely on an application-level existence check before every insert, without a backing database constraint. I rejected this because application checks can race against themselves and can simply be wrong — which happened here in practice, not just in theory. The database constraint is the layer that holds even when the code above it doesn't, which is the entire point of treating it as a last line of defense rather than the only line

## Section 6: What Went Wrong

Problem 1
Symptom: attempting to sign up again with an email that already belonged to a fully verified, working account showed "Check your email — Account already exists" and offered a verification code, as if the signup were still incomplete.
Investigation: traced the signup handler's logic for existing emails. It had a single response path whenever it found an existing account with the submitted email — always offering a verification code — with no distinction between an account that had never finished verifying and one that had already completed it.
Cause: the signup handler treated every "email exists" case identically, checking only whether a user row existed rather than also checking emailVerified. This was correct for a genuinely unfinished signup (someone who registered but never verified), but wrong for an account that had already completed verification and could sign in normally.
Fix: added a branch on existing.emailVerified — an unverified existing account still receives a fresh verification code, but a verified account is now rejected outright with "This email is already registered. Please sign in instead." Confirmed fixed by testing the exact same duplicate-signup case again, both through the browser and directly via curl, bypassing the browser entirely.
Problem 2
Symptom: after initial scaffolding, the sign-up page rendered with no styling at all — default browser appearance, none of the design-token colors, spacing, or typography applied.
Investigation: asked the agent directly why none of the design tokens from AGENTS.md were being used. It traced the actual CSS import chain from the root layout down to the token files.
Cause: app/layout.tsx imports app/globals.css, which itself does @import url('../css/provly-design-system.css') — and that combined file pulls the real token definitions through six further nested @import statements. When Next.js's App Router bundled the CSS, this chained, cross-directory @import structure (crossing the ../css/ boundary, several imports deep) failed to resolve correctly, so none of the --provly-role-*, --provly-type-*, or --provly-spacing-* variables were ever actually defined in the browser. Every var(--provly-*) reference in the stylesheet fell back to nothing, which is indistinguishable from unstyled default HTML.
Fix: corrected the import resolution so the token definitions actually reach the bundled output — confirmed working by the UI rendering with the correct brand colors, spacing, and typography afterward.
Problem 3
Symptom: while trying to copy a curl command shown by the agent, pressing Ctrl+Shift+C did nothing, and pressing Ctrl+C in that same panel caused the entire agent session to stop and the running work to be lost.
Investigation: realized the panel was terminal-style, where Ctrl+C is a long-standing convention for interrupting a running process, not a copy shortcut.
Cause: expecting a standard "copy" keyboard shortcut to work inside a terminal-style pane, where the same key combination is bound to a different, destructive action.
Fix: switched to selecting the text with a mouse drag and using the right-click "Copy" option instead, which doesn't touch the terminal's interrupt shortcut at all.

## Section 7: What This Slice Does Not Handle

Rate limiting does not survive a server restart or scale across multiple instances. The in-memory sliding-window limiter (lib/auth/rateLimit.ts) resets whenever the process restarts, and if this were ever deployed across more than one server instance, each instance would track its own separate counts — effectively multiplying the real limit. Moving to a shared store (Redis or the database itself) would be required before this could run at any real scale. This was a deliberate scope decision for a 14-18 hour slice, not an oversight.

There is no real email delivery. Verification codes and reset links are logged to the console and returned directly in the API response when not in production (devCode), rather than sent through an actual email provider. This was explicitly out of scope for demonstrating the authentication logic itself, but a real deployment would need SMTP or a transactional email service wired in before any of this could reach a real user.

Expiry is enforced in application code, not by a database constraint. As noted in Section 4, nothing in the schema itself prevents a row's usedAt from theoretically being set after its expiresAt. The route handlers correctly check this on every use, confirmed through direct testing, but the enforcement lives one layer up from the database rather than in the schema itself.

There is no automated test suite. All verification for this assessment was done manually — direct database inspection, a curl request bypassing the browser, and deliberately triggering the rate limit — rather than through a written test suite that could be re-run automatically. This was sufficient to produce the required evidence for this assessment, but a growing codebase would need real automated tests before manual verification alone became unsustainable.

An unused, generic color-role system still exists in the design token source. The original Figma file contains a second, non-Provly color system (generic blue-based roles) alongside the real Provly-branded tokens. It's explicitly never referenced anywhere in this slice's code, and AGENTS.md forbids the agent from ever using it, but it hasn't been deleted from the source Figma file itself.

## Section 8: If I Built This Again

The single biggest thing I'd do differently is wiring in a real email provider from the start, instead of relying on the console-logged and devCode-returned verification codes I used for this assessment. Everything about the authentication logic itself — hashing, expiry, rate limiting, session handling — genuinely works, but without real email delivery, none of it is actually usable by a real person yet. A verification code that only exists in a dev-mode API response or a server log isn't a working feature from a user's point of view; it's a stand-in for one. If I rebuilt this, I'd treat "the code actually arrives in an inbox" as part of the core requirement from day one, not something to defer past the boundary of the assessment.
