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

<!-- Narrative, not a list. For each step: what the user does, what the
     frontend sends, what the server does with it, naming actual files/routes. -->

*(To be written once the flow is fully implemented — walk through signup → verification → dashboard, then sign-in, then password reset, naming real files each time.)*

## Section 4: The Data Model

<!-- Every table, one line each on what it holds. For decision-bearing
     columns: why that type, why that constraint. Then: which constraints
     make an invalid state impossible? -->

*(To be written once the Prisma schema is final.)*

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