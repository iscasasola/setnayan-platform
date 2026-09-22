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
 * 🔑 SO THIS SHIPS OFF, AND THE DEFAULT IS TODAY'S BEHAVIOUR. Merging this
 * changes nothing. The flag is the owner's to flip, AFTER the Supabase Auth
 * SMTP change in `OWNER_ACTIONS.md` Phase 2 — and the order matters: flipped
 * first, nobody can sign in.
 *
 * ⚠ `RESEND_API_KEY` being set is NOT the same thing. That is Setnayan's own
 * transactional mail (20 deliveries accepted). Supabase Auth has its OWN sender
 * configured in the Supabase dashboard, and it is that one which must be
 * pointed at Resend. Conflating the two is how this would get flipped early.
 */

/**
 * Must a new account confirm its email before it can sign in?
 *
 * Default FALSE — the auto-confirm bypass stays exactly as it is today. Set
 * `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true` in Vercel **only after**
 * Supabase Auth's sender is pointed at Resend and a test signup has been seen
 * to receive its confirmation mail.
 */
export function isEmailVerificationRequired(): boolean {
  const v = process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION;
  return v === 'true' || v === '1' || v === 'TRUE';
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
