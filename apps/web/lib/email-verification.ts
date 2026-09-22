/**
 * email-verification.ts — whether a new account must prove it owns its address.
 *
 * ── THE DEFECT (register L3, measured 2026-09-22) ───────────────────────────
 * **Every signup is auto-confirmed via the admin API immediately after
 * `auth.signUp`.** Nothing verifies that the person signing up controls the
 * address they typed. That is a launch blocker: a typo'd address silently
 * belongs to a stranger, a password reset goes to them, and every "we emailed
 * you" is a promise to somebody who never asked.
 *
 * ── WHY IT IS NOT SIMPLY DELETED ───────────────────────────────────────────
 * 🛑 THE AUTO-CONFIRM IS A DOCUMENTED WORKAROUND, NOT AN OVERSIGHT.
 * `OWNER_ACTIONS.md` records it: Supabase's default auth sender spam-folders,
 * so an unconfirmed account could not sign in at all. Removing the bypass
 * before Supabase Auth points at Resend would break **every new signup on the
 * platform**, immediately, for everyone.
 *
 * ✅ LIVE SINCE 2026-09-22. The flag is set to `true` in Vercel Production and
 * Supabase Auth now sends through Resend (`smtp.resend.com`, sender
 * `noreply@setnayan.com`). Verified end to end, not inferred: a real
 * `/recover` returned 200 with an empty error in `auth_logs` and the mail
 * arrived in a human inbox, not spam.
 *
 * 🪤 WHAT WENT WRONG ON THE WAY, because the next person will meet it. The
 * flag was set in Vercel ~20 minutes BEFORE the code that reads it reached
 * `main`, and for that window it did nothing at all — signup kept
 * auto-confirming. **A flag set in production is not a flag in force.**
 * Neither `vercel env ls` nor a green `deploy-prod` can tell you whether the
 * reader shipped; only `git grep` on `origin/main` plus a served deploy can.
 *
 * 🪤 And separately: the SMTP password had never saved (the field was empty
 * and Save stayed greyed), so for that same window every auth mail failed with
 * SMTP `535 "Authentication credentials invalid"` while `deploy-prod`, the
 * drift monitor and the migration ledger were all green. The mailer is
 * dashboard config — no deploy, ledger or drift check can see it. Re-measure
 * by firing `/recover` and reading `auth_logs`, never by reading a status page.
 *
 * ⚠ `RESEND_API_KEY` being set is NOT the same thing. That is Setnayan's own
 * transactional mail. Supabase Auth has its OWN sender configured in the
 * Supabase dashboard. Conflating the two is how this got flipped early.
 */

import { envFlagEnabled } from './env-flag';

/**
 * Must a new account confirm its email before it can sign in?
 *
 * Default FALSE — the auto-confirm bypass stays exactly as it is today. Set
 * `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true` in Vercel **only after**
 * Supabase Auth's sender is pointed at Resend and a test signup has been seen
 * to receive its confirmation mail.
 */
export function isEmailVerificationRequired(): boolean {
  // Inlined literally, not via a local: Next.js replaces the exact
  // `process.env.NEXT_PUBLIC_*` expression at build time by static analysis.
  return envFlagEnabled(process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION);
}

/**
 * What a freshly-signed-up person is told.
 *
 * With verification ON they cannot sign in yet, and a screen that does not say
 * so is the same silence this codebase keeps finding — the person waits at a
 * login box that will refuse them with no reason given.
 */
export function postSignupMessage(): string {
  return isEmailVerificationRequired()
    ? 'Check your email — we sent you a link to confirm your address. You can sign in once you have clicked it.'
    : 'Your account is ready — you can sign in now.';
}
