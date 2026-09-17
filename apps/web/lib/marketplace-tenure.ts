/**
 * lib/marketplace-tenure.ts — "On the marketplace since ⟨Month Year⟩".
 * Pure, so its test EXECUTES it.
 *
 * ── WHAT THIS IS, AND THE THING IT MUST NEVER BE MISTAKEN FOR ──────────────
 * Two different tenures exist for a shop and the product already treats them
 * as different:
 *
 *   · HOW LONG THEY HAVE BEEN IN BUSINESS — `in_business_since_year`, surfaced
 *     on the shop page as the experience block and, when an admin has checked
 *     it, marked verified. This is the credential.
 *   · HOW LONG THEY HAVE BEEN ON SETNAYAN — `vendor_profiles.created_at`.
 *     That is this module, and it is NOT a credential.
 *
 * ⚠ THE REPO ALREADY HAS A REASONED POSITION ON CONFUSING THE TWO.
 * `lib/vendor-milestone.ts` says it plainly: "an established shop that merely
 * joined Setnayan recently shows its real '11th year in business', never '3rd
 * month in business'." A florist of eleven years who signed up last month must
 * not be made to look new by a line we added.
 *
 * 🔑 SO THE WORDING CARRIES THE DISTINCTION, not the placement. "On the
 * marketplace since September 2026" says what it measures in its own words; a
 * bare "Since September 2026" beside an experience block would read as the
 * founding date and actively mislead. That is why this returns a whole labelled
 * sentence and not a date.
 *
 * ⚠ AND IT IS NEVER HIDDEN TO FLATTER. Suppressing it for new shops would make
 * its presence a badge and its absence a tell, which is a worse dishonesty than
 * the one it avoids. Every published shop with a readable join date gets it.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * The labelled tenure line, or null when the join date is unusable.
 *
 * Null means "we do not know when they joined" — never "they are new". The
 * caller renders nothing, which is the honest output for an unknown.
 *
 * @param createdAtISO `vendor_profiles.created_at`
 * @param nowISO       today, passed in so this stays pure and testable
 */
export function marketplaceTenureLine(
  createdAtISO: string | null | undefined,
  nowISO: string,
): string | null {
  if (!createdAtISO) return null;
  const joined = new Date(createdAtISO);
  const now = new Date(nowISO);
  if (Number.isNaN(joined.getTime()) || Number.isNaN(now.getTime())) return null;

  /*
    ⚠ A FUTURE JOIN DATE IS A DATA FAULT, NOT A SENTENCE. Clock skew or a bad
    backfill would otherwise print "On the marketplace since March 2027" on a
    live shop page. Refusing is the only honest answer; a clamp would invent a
    date we have no basis for.
  */
  if (joined.getTime() > now.getTime()) return null;

  const month = MONTHS[joined.getUTCMonth()];
  if (!month) return null;
  return `On the marketplace since ${month} ${joined.getUTCFullYear()}`;
}
