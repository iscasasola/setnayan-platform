## 2026-09-18 · fix(auth): a password reset completes in any browser

`/forgot-password` called `supabase.auth.resetPasswordForEmail`, which under
`@supabase/ssr` is a **PKCE** flow: the code verifier is stored in a cookie on
the browser that asked, so the emailed `?code=` could only be exchanged there.
Measured on production that morning:

    curl -sD - "https://www.setnayan.com/auth/callback?code=probe&next=%2Freset-password"
    → 307 /login?error=PKCE%20code%20verifier%20not%20found%20in%20storage…

Ask on the laptop, open the mail on the phone — the most ordinary way anybody
does this — and the reset could not complete. Not flaky: structurally unable to
finish, on the one page a locked-out person reaches.

- **NEW** `app/auth/confirm/route.ts` verifies a `token_hash` with `verifyOtp`.
  The whole proof is in the URL, so it completes on any device. Deliberately a
  sibling of `/auth/callback`, not a change to it — PKCE stays correct for
  OAuth.
- `lib/password-recovery-link.ts` mints the link with the admin API and posts it
  through Resend, extending the shape `lib/event-account-link.ts` has shipped
  since June.
- `lib/auth-confirm-link.ts` holds the two things that can be got wrong — the
  OTP-type **allowlist** (`type` arrives on a query string) and the URL spelling
  — as pure functions, so the guard executes them instead of grepping a
  `server-only` route.
- **Two protections were restored, not lost with the move off GoTrue.** GoTrue
  capped this as a side effect of being the mailer, so `/forgot-password` now
  rate-limits per-email and per-IP itself; and GoTrue verified the Turnstile
  token, so `lib/turnstile-verify.ts` now does — inert until
  `TURNSTILE_SECRET_KEY` is set, fail-closed once it is.
- `lib/human-auth-error.ts` fails closed on developer prose. The 246-character
  Supabase paragraph reached a customer-facing card because the gate only asked
  whether a string *reads* like a sentence, never whom it is addressed to. Now
  refused by shape — package specifier, code identifier, or length — never by a
  list of phrasings.

Anti-enumeration is unchanged: every outcome but our own rate-limit still
collapses to one neutral `?sent=1`, asserted by a guard that counts it.

⚠ OWNER: Supabase Auth still has no custom SMTP, so *other* auth mail shares the
platform cap of ~2/hour. Recovery mail no longer does — it goes through Resend.

SPEC IMPACT: None — the recovery flow's user-visible behaviour is unchanged
except that the link now works. `OWNER_ACTIONS.md` gains the optional
`TURNSTILE_SECRET_KEY`.
