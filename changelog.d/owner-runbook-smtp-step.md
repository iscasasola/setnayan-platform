## 2026-09-16 · docs(owner): the runbook carries the Auth-SMTP step, and two traps that were nowhere

`OWNER_ACTIONS.md` had no SMTP section at all, so the single change that lifts every
password reset, sign-in link and email confirmation off a **two-per-hour** platform-wide
budget was undocumented. Added it, with the exact Resend values (`smtp.resend.com:587`,
username the literal `resend`, sender `noreply@setnayan.com` — the address
`platform_settings.resend_from_address` already holds, on a domain `send.setnayan.com`
already carries SPF and DKIM for).

Two things it now says that nothing in the repo said before, both quoted from Supabase's
own documentation rather than remembered:

- **Setting custom SMTP moves the cap to 30/hour, not to unlimited** — *"The default rate
  limit for auth emails when using a custom SMTP provider is 30 new users per hour"* — and
  the new number is a **separate setting** under Authentication → Rate Limits that does not
  change when SMTP is saved. Doing step 2 and walking away only moves the wall.
- **Free-plan projects get PAUSED for inactivity** — *"We may pause applications on the Free
  Plan that exhibit low activity in a 7-day period"*, *"Upgrade to Pro to guarantee that we
  won't pause your project for inactivity"*. With ~13 accounts and almost no traffic this is
  exactly our profile, and a paused project is the whole platform offline with a manual
  restore. The 2026-08-10 *"let's stay free for the moment"* call was costed against losing
  backups; **the inactivity pause is the half nobody costed**, and that call's own note says
  *revisit before launch*.

Also ordered the two owner tasks relative to each other, which was not stated anywhere:
**SMTP before captcha.** Supabase captcha is global and gates the password-reset form, so
enabling the bot check first leaves a locked-out stranger facing a challenge *and* a
two-per-hour queue.

**No code changed.** The Turnstile wiring was already complete; taking that section's own
*"do not read a checklist as proof"* instruction literally, it was re-verified against
`origin/main` rather than trusted — every mount, `challenges.cloudflare.com` in both
`script-src` and the **enforced** `frame-src`, and the five-test
`lib/captcha-is-wired.test.ts` — and production re-checked to confirm it is still a strict
no-op (the live `/signup` bundle carries no site key and no `captcha_token`). That
verification is recorded inline with the commands to repeat it, so the next reader
re-measures instead of believing a second checklist.

Both remaining steps terminate in pasting a secret into a security settings form — the
Resend API key as the SMTP password, the Turnstile secret key into Supabase — so they are
owner actions by rule, and the Supabase MCP exposes no auth-configuration tool either.
The runbook now says so, so the next session does not try.

SPEC IMPACT: None. `OWNER_ACTIONS.md` is repo-local operator documentation; no decision,
price or schema changes. The free-plan pause finding is surfaced for owner sign-off rather
than resolved here — it is a card payment and therefore his alone.
