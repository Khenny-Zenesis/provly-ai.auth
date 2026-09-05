# AGENTS.md — Assessment 1: Authentication Slice

## 1. What is this project

This is a standalone authentication slice — not the full Provly app. It builds account creation, sign-in, password reset, email verification, and a placeholder dashboard, as one working flow with nothing else around it.

The source of truth is `Assessment1_Auth_Slice_PRD.md`. If this file and the PRD ever conflict, the PRD wins on *what* to build; this file wins on *how* to build it. If genuinely unclear which applies, stop and flag it — do not guess (see Section 7).

Version being built: Assessment 1 only. Nothing from Assessments 2, 3, or 4 (payments, AI processing, records/access) is in scope here, even if it seems like natural next work.

## 2. What is locked — never change, swap, or "improve" these

- **Framework**: Next.js, App Router. Do not switch to Pages Router or a different framework.
- **Language**: TypeScript. No `.js` files in application code.
- **ORM**: Prisma. Do not introduce a second database access method.
- **Database**: PostgreSQL.
- **Build environment**: Antigravity.
- **Password hashing algorithm**: bcrypt. Never substitute SHA-256, MD5, or any general-purpose hash — this is a named, tested engineering requirement (PRD 5, R1.1), not a style preference.
- **Validation**: one schema library (Zod), used for both server and client validation from a single shared schema definition. Do not write two separate validation implementations.

Do not upgrade, replace, or "modernize" any of the above during this task, even if you believe an alternative is objectively better. Flag the suggestion in documentation instead of acting on it.

## 3. What must never happen

- **Never generate or reference any CSS variable from the generic, non-Provly token collections** — `primitives colors collection`, `color roles`, `spacing collection` (the un-prefixed ones). The source JSON contains both a generic placeholder system and the real Provly-branded system side by side. Only variables under `provly - primitives`, `provly color roles`, `provly spacing collection`, `provly border radius` are real. Using a generic role (e.g. the generic blue "primary") instead of the Provly one (teal) is a visible, silent bug — treat it as a failure on sight, not a style nitpick.

Every rule below is a hard failure if broken — even if the app runs and looks like it works. Each cites the PRD requirement it protects.

- **Never store a password in plain text, anywhere, at any point** — not in logs, not in a variable that outlives the hashing call. (R1.1)
- **Never trust client-side validation alone.** Every input must be validated server-side using the shared schema, independent of what the browser sent. (R1.2)
- **Never leave any of these four routes unprotected by rate limiting: signin, signup, password-reset-request, verification-code-resend.** The resend route is the one most likely to be forgotten — do not forget it. (R1.3)
- **Never configure the session cookie without `httpOnly`, `secure`, and `sameSite` set correctly.** (R1.4)
- **Never rely on a UI countdown as the real expiry mechanism for a verification code.** The database record itself must be unusable after expiry, independent of what the frontend displays or hides. (R1.5)
- **Never allow the resend cooldown to be enforced only by disabling a button client-side.** It must be enforced server-side. (R1.6)
- **Never make a password reset token reusable or unlimited in time.** Single-use, time-limited, enforced server-side. (R1.7)
- **Never allow two accounts to exist with the same email.** This must be a database-level unique constraint, not just an application-level check before insert. (R1.8)
- **Never allow a double-submitted signup request to create two accounts.** The signup endpoint must be idempotent. (R1.9)
- **Never allow the dashboard route to be reached without a valid session**, including by direct URL entry. (R1.10)
- **Never ship an input without a programmatically bound label and a visible focus state.** (R1.11)
- **Never commit a `.env` file.** Only `.env.example`, with placeholders, ever goes into the repository.
- **Never build anything outside the six named screens** — no landing page, no marketing page, no dashboard features beyond a name and a sign-out button, no profile editing, no settings, no social sign-in, no two-factor. Building extra, unrequested scope is a failure condition on this assessment, identical in severity to a missing engineering requirement — it is graded as scope violation, not generosity.

## 4. How the work is arranged

```
/app
  /(auth)
    /signin/page.tsx
    /signup/page.tsx
    /forgot-password/page.tsx
    /reset-password/page.tsx
    /verify-email/page.tsx
  /dashboard/page.tsx
  /api
    /auth
      /signup/route.ts
      /signin/route.ts
      /forgot-password/route.ts
      /reset-password/route.ts
      /verify-email/route.ts
      /resend-code/route.ts
/lib
  /auth
    password.ts        — hashing and comparison only
    session.ts          — session creation, validation, destruction
    rateLimit.ts         — shared rate-limit logic used by all 4 protected routes
  /validation
    authSchemas.ts       — the one shared Zod schema set, imported by both client and server
  /db
    prisma.ts            — single Prisma client instance
/prisma
  schema.prisma
  /migrations
.env.example
DOCUMENTATION.md
```

Rules about this layout:
- Route handlers in `/app/api` stay thin — they call functions in `/lib`, they do not contain business logic themselves.
- Nothing in `/lib/auth` imports from `/app` — logic must not depend on routing.
- One Prisma client instance, imported everywhere it's needed. Never instantiate a new client per request.

## 5. How the code should look

- Clean, readable, and boring on purpose. This is not the place for cleverness.
- No `any` types. If a type is genuinely unknown, define it properly rather than escaping the type system.
- Small, single-purpose functions — a function that hashes a password does not also validate it.
- Comments explain *why* a decision was made, not what the code obviously does.
- Consistent naming across the whole slice — do not vary between `userId` and `user_id` in different files.
- No dead code, no commented-out attempts left behind, no unused imports at submission.

### Design tokens — how to use the Provly design system correctly

The design system is a two-tier token model: primitives (foundation, never used directly) and roles (semantic, always used in UI). This is already generated as CSS custom properties — do not hardcode colors, spacing, radius, or type values anywhere in this slice.

- **Load it via the single combined file only**: `provly-design-system.css`. Never import the individual primitive/role/spacing/etc. files separately in component code.
- **Never reference a `--provly-primitive-*` variable in any component, ever.** These exist only as the foundation the role tokens are built from. If a component is reaching for a primitive, that's a signal the right role token hasn't been identified yet — stop and find it rather than reaching past the rule.
- **Color role usage for this slice specifically:**
  - Primary actions (Create Account, Sign In, Reset Password buttons): background `--provly-role-provly-primary`, text `--provly-role-provly-on-primary`.
  - Validation errors and invalid input states: background `--provly-role-provly-error-container`, text `--provly-role-provly-on-error-container`.
  - Success confirmations (e.g. "email verified"): the success role tokens, container variant for any background surface, base variant for icons/accents.
  - Body text, borders, form backgrounds: the neutral role tokens — never a raw gray value.
- **Spacing**: use `--provly-spacing-provly-*` tokens exclusively, matched to the established scale (0, 4, 8, 12, 16, 24, 32, 40, 48, 64 → no-spacing through 4x-large). No arbitrary pixel or rem values anywhere in component CSS.
- **Border radius**: use `--provly-radius-provly-*` tokens. Keep radius consistent across all inputs and buttons in this slice — do not mix values.
- **Typography**: use `--provly-type-provly-*` tokens only.
  - Form labels and buttons → Label scale (this is what Label is designated for in the system).
  - Helper text and error messages → Body scale, small.
  - Screen headings ("Create account", "Sign in", etc.) → Title scale.
- **Shadows**: use `--provly-shadow-provly-*` sparingly. This is a minimal auth slice — a soft shadow on the form card is enough. Do not add elevation to every element.
- **Focus states (ties directly to R1.11)**: the visible focus ring must use a role token with real, checked contrast against its background — not a default browser outline, and not an arbitrary color. If contrast is uncertain, verify it the same way the rest of this design system has been verified — with an actual contrast ratio, not a visual guess.
- **Never invent a new color, spacing value, or font size outside this token system**, even for a small one-off need. If a genuine gap exists — no token fits a real requirement — flag it in the documentation's limitations section rather than hardcoding a new value silently.

## 6. What counts as done

Before considering this complete, confirm every item below, and produce this list as an actual checklist in the final submission:

- [ ] All 6 screens present and functioning (R1 behavior list)
- [ ] R1.1 through R1.11 each implemented and verifiable
- [ ] Project builds and runs from a fresh clone using only `.env.example` + Section 2 steps of the PRD
- [ ] `.env` is not in the repository (verified by checking in a private browser window, not from memory)
- [ ] Screenshot captured: `users` table showing a bcrypt hash, no plain password
- [ ] `curl` command and response captured for direct signup endpoint test
- [ ] Rate limit trigger captured, showing the actual status code returned
- [ ] Verification code shown in the database both before and after expiry
- [ ] Zero build errors, zero TypeScript errors
- [ ] Nothing exists in the repository outside the six named screens and their supporting logic

## 7. What to do when unsure

Never invent a new feature or expand scope to resolve uncertainty. If the PRD and this file don't clearly cover a situation:

1. Implement the smallest, safest default that satisfies the letter of the existing rules.
2. Do not silently weaken a security rule to make something easier (e.g. do not skip rate limiting "temporarily" or widen a validation rule to make a test pass).
3. Write the open question into the documentation's limitations section rather than guessing silently and hoping it's not noticed.
4. When truly blocked, stop and surface the question rather than producing speculative, untested code to fill the gap.

---

**Self-check before use**: every "must never" rule above traces back to a specific PRD requirement or an explicit assignment rule (the known traps list). Nothing in Section 3 is a style preference — each one passes the test of "would this be a failure even if the code technically runs." The one rule that doesn't map to a numbered engineering requirement — the scope boundary — is treated with equal weight because the assignment itself states extra scope is graded as a failure, not a bonus.