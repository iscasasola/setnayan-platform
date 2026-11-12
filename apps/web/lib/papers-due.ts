/**
 * papers-due.ts — 📄 ONE RENEWAL DAY: 30 MARCH (owner, 12 Nov 2026). Pure.
 *
 * Owner, verbatim: *"Renewal deadline. March 30. Shops who did not submit and get verified has no renewal. No deadline
 * for any shop until the submit. The renewal is for the shops who already submitted their documents last year. So their
 * goal is to renew their documents because it expired."* — and for the shops verified before the papers check and the
 * founders: *"Yes, their due is on March 30, 2027."*
 *
 * So a shop verified in year Y — its papers approved, or founders-verified — owes its papers by the END of 30 March of
 * Y + 1 (Manila). Approved in Nov 2026 → 30 Mar 2027; approved in Feb 2027 → 30 Mar 2028. A shop never verified has no
 * deadline at all (nothing here is ever written for it). The badge reads the date (`vendor_profiles.next_renewal_due_at`,
 * `lib/verified-badge.ts`); the 60-day reminder and the lapse follow it.
 */

/** Manila is UTC+8, with no daylight saving. */
const MANILA_MS = 8 * 3_600_000;

/** The END of 30 March of `year` in Manila — 23:59:59 +08, i.e. 15:59:59 UTC. */
export function papersDueIn(year: number): string {
  return `${String(year).padStart(4, '0')}-03-30T15:59:59.000Z`;
}

/** The renewal day for a shop verified at `verifiedAt`: 30 March of the NEXT year (by the Manila calendar). */
export function nextYearsPapersDue(verifiedAt: Date): string {
  const manilaYear = new Date(verifiedAt.getTime() + MANILA_MS).getUTCFullYear();
  return papersDueIn(manilaYear + 1);
}
