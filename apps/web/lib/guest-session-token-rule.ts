/**
 * lib/guest-session-token-rule.ts — does a guest's cookie still match the code
 * their row holds? The decision, alone. PURE, so a test EXECUTES it.
 *
 * ── WHAT WAS BROKEN ────────────────────────────────────────────────────────
 * The re-validation itself was written, correct, and sitting at a chokepoint
 * every one of `readGuestSession`'s 24 consumers passes through. It was gated
 * behind `GUEST_SESSION_TOKEN_CHECK`, and that variable is NOT SET in
 * production — `envFlagEnabled` returns false for a non-string, so the check
 * never ran. Verified 2026-09-17: absent from `vercel env ls production`.
 *
 * 🔴 THE CONSEQUENCE IS THE OPPOSITE OF WHAT ROTATION IS FOR. A couple who
 * learns a guest's QR has leaked rotates it. With the check dark, the leaked
 * browser keeps its session — and because it is still a valid session, the app
 * happily shows it the REPLACEMENT code. Revoking the leak hands the leak the
 * new key.
 *
 * ⚠ THE FLAG IS DELETED, NOT SET. A flag whose production value nobody can read
 * is how this shipped dark for months; setting it would leave the same
 * mechanism in place for the next person to get wrong. The check is now
 * unconditional, and the only way to turn it off is a code change a reviewer
 * can see.
 *
 * ── FAIL OPEN ON A TRANSPORT ERROR — DELIBERATELY, AND UNCHANGED ───────────
 * A definitive mismatch revokes. A lookup that could not COMPLETE does not:
 * a database blip must not sign out every guest at a wedding simultaneously,
 * whose only way back in is re-scanning a QR they may no longer have. That
 * asymmetry is the whole design, and it is why "did the lookup finish" is a
 * separate input here rather than being collapsed into "did it match".
 */

export type GuestTokenFacts = {
  /** The `qr_token` carried by the signed cookie. */
  cookieToken: string;
  /**
   * The `qr_token` on the guest's row, or null when the row is missing,
   * soft-deleted, or has no token.
   */
  dbToken: string | null;
  /**
   * TRUE when the lookup could not complete (transport error, admin client
   * unavailable). Distinct from "completed and found nothing" — see below.
   */
  lookupFailed: boolean;
};

/**
 * May this cookie still act as a guest session?
 *
 * ⚠ `lookupFailed` IS CHECKED FIRST AND SEPARATELY. Collapsing it into the
 * comparison — treating an errored lookup as `dbToken = null` — would turn
 * every database blip into a mass sign-out, which is precisely the outcome the
 * fail-open policy exists to prevent.
 *
 * ⚠ AND A MISSING ROW IS NOT AN ERROR. A completed lookup that found no row (a
 * deleted guest, a removed seat) returns `dbToken: null` and MUST revoke — that
 * is a definitive answer, not a failure to get one.
 */
export function guestSessionSurvivesTokenCheck(facts: GuestTokenFacts): boolean {
  if (facts.lookupFailed) return true;
  if (facts.dbToken === null) return false;
  // An empty cookie token must never match an empty column value.
  if (facts.cookieToken.length === 0) return false;
  return facts.dbToken === facts.cookieToken;
}
