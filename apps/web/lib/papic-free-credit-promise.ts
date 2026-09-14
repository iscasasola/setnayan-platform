/**
 * THE FREE-CREDIT PROMISE — what /papic is allowed to say about the free pool.
 *
 * ── THE DEFECT THIS EXISTS TO CURE (MONEY-1, 2026-09-14) ────────────────────
 * The public Papic page said, in four places, that a couple gets free credits
 * **on every celebration**. Measured against the live function in production
 * (`papic_claim_free_pool`, migration 20271208142357) that sentence is
 * TECHNICALLY TRUE AND MATERIALLY FALSE:
 *
 *   • `papic_free_grant_claims` has its PRIMARY KEY on `user_id`, and the
 *     arbiter is `ON CONFLICT (user_id) DO NOTHING` — so an ACCOUNT claims the
 *     free pool exactly ONCE, ever.
 *   • The first celebration gets `papic_event_pool_config.free_grant_points`
 *     (live value 50 when this was written, admin-editable).
 *   • Every celebration after it gets a `free_grant` row too — worth **1
 *     point**, i.e. ONE PHOTOGRAPH. It is a floor, not a perk: it exists only
 *     because `papic_event_pool_status()` fences on `SUM(points) > 0`, so a
 *     0-point row would read as "no pool at all" and revert the event to
 *     UNMETERED capture.
 *
 * A row existing is not a grant. A stranger deciding whether to sign up reads
 * "free credits on every celebration" as the second thing, so the page names
 * the condition now: **"{N} free credits on your first celebration"**.
 *
 * ⛔ AND THE FLOOR IS NOT A FEATURE. Nothing here may ever grow a sentence like
 * "and 1 credit on every celebration after". That would be a second materially
 * false sentence pointing the other way — dressing a fencing mechanism up as a
 * benefit.
 *
 * ── 🚨 THE SECOND HALF, WHICH WAS NOT IN THE BRIEF ──────────────────────────
 * "When the allowance is switched off, say nothing" could not be built on the
 * reader the page was using. `fetchPapicFreeGrantPoints()` collapses BOTH "the
 * column says 0" AND "I could not read the column" onto the seed fallback of
 * 50. So an admin who set `free_grant_points = 0` switched the grant off in
 * SQL — `papic_claim_free_pool` returns before the claim — while the public
 * page went on promising **50 free credits** in a confident voice. That is
 * strictly worse than the "0 free credits" the brief forbids, and the page's
 * existing `free > 0 ?` guards were unreachable code.
 *
 * So the three outcomes are kept apart here, and the mapping is not invented —
 * it is `papic_claim_free_pool`'s own, line for line:
 *
 *   | the column           | SQL grants        | this page says   |
 *   |----------------------|-------------------|------------------|
 *   | N > 0                | N                 | N                |
 *   | 0 (or below)         | NOTHING (RETURNs) | nothing at all   |
 *   | no row / unreadable  | COALESCE(…, 50)   | the same 50      |
 *
 * The last row is why an unreadable read still speaks: the SQL's own
 * `COALESCE(v_pts, 50)` means a missing config row really does mint 50, so
 * falling silent there would hide a grant that is genuinely being made.
 *
 * ── PURE ON PURPOSE ────────────────────────────────────────────────────────
 * No React, no `server-only`, no database. The render sites and the guard both
 * import this, so the sentence a customer reads and the sentence CI checks are
 * the same string by construction — see `the-free-credit-promise-is-true.test.ts`.
 */

import { PAPIC_FREE_GRANT_POINTS_FALLBACK, type PapicFreeGrantRead } from './papic-tier-copy';

/**
 * The condition, in the page's voice. ONE copy, shared by every surface, so the
 * hero, the bullet, the dial, the closing line and the structured data cannot
 * drift into saying different things about the same mechanism.
 */
export const PAPIC_FREE_CREDIT_CONDITION = 'on your first celebration' as const;

export type PapicFreeCreditPromise = {
  /** The figure, localised: `"50"`. Rendered on its own so JSX can style it. */
  count: string;
  /** What follows the figure: `"free credits on your first celebration"`. */
  rest: string;
  /** The whole sentence: `"50 free credits on your first celebration"`. */
  sentence: string;
  /**
   * The figure and its unit with NO frequency claim at all: `"50 free credits"`.
   * For the hero badge, which used to read "50 credits left" — a COUNTDOWN for
   * something that is not counting down, on a page a stranger reads before any
   * event exists.
   */
  size: string;
};

/**
 * The promise, or `null` when the page must say nothing.
 *
 * `null` is not an error path. It is the switched-off allowance, and silence is
 * the only honest rendering of it: "0 free credits" advertises an absence, and
 * the number the page would otherwise print (50) advertises a grant that
 * `papic_claim_free_pool` will refuse to make.
 */
export function papicFreeCreditPromise(read: PapicFreeGrantRead): PapicFreeCreditPromise | null {
  const points = papicFreeCreditPoints(read);
  if (points === null) return null;
  const count = points.toLocaleString('en-PH');
  const rest = `free credits ${PAPIC_FREE_CREDIT_CONDITION}`;
  return {
    count,
    rest,
    sentence: `${count} ${rest}`,
    size: `${count} free credits`,
  };
}

/**
 * The figure the page may quote, or `null` for "say nothing". Split out from
 * the sentence because the dial renders the same figure inside its own
 * arithmetic rather than as prose.
 */
export function papicFreeCreditPoints(read: PapicFreeGrantRead): number | null {
  if (read.kind === 'off') return null;
  if (read.kind === 'unknown') return PAPIC_FREE_GRANT_POINTS_FALLBACK;
  return read.points > 0 ? read.points : null;
}
