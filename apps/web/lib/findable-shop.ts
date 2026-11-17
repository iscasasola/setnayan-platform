/**
 * findable-shop.ts — WHO A COUPLE CAN FIND. One rule, asked by every list.
 *
 * ── THE RULING ──────────────────────────────────────────────────────────────
 * DECISION_LOG 2026-11-15 "🌐 AN UNVERIFIED SHOP HAS THE SAME WEBSITE AS A
 * VERIFIED ONE … THE ONLY REACH DIFFERENCE IS DISCOVER AND SUPPLIERS › FIND", and
 * the owner's answer the same day, "Verified only" — which SUPERSEDES 2026-11-07
 * "findable until its first inquiry". Owner: *"Verified adds them to discover and
 * suppliers>find"*.
 *
 *   · Verified shops show in search, Discover, Suppliers › Find, category pages
 *     and suggestions (with the badge).
 *   · A shop Setnayan has not decided yet (`unverified` · `pending_review`) shows
 *     in NONE of them. People reach it by its own link or QR, where it can be
 *     messaged and booked (with the booking fee) — {@link ownLinkOpensUnverified}.
 *   · `find_locked_at` still records a shop's first inquiry or import; it no
 *     longer decides anything.
 *   · Rejected, demoted, archived and fraud-frozen shops never show.
 *
 * ── WHERE THE RULE LIVES ────────────────────────────────────────────────────
 * In the DATABASE, once: `vendor_profiles.is_findable`, a stored generated
 * column (migration 20271320303985), also on `vendor_market_stats`. Every list
 * filters on that one column through {@link FINDABLE_SHOP_GATE} /
 * {@link findableShopGate}; nothing re-types `public_visibility` +
 * `verification_state` for a list any more. {@link isShopFindable} is the
 * TypeScript twin for rows already in hand, pinned to the column by
 * `tests/db/an-unverified-shop-is-booked-on-its-page-and-found-only-once-verified.db.test.ts`.
 * `lib/every-listing-asks-findable.test.ts` fails if a couple-facing list skips it.
 *
 * ⚠ DEMO SHOPS ARE NOT DECIDED HERE. They keep their own existing rule
 * (`is_demo`, excluded for real couples, shown to an admin in demo mode), applied
 * by each caller exactly as before.
 *
 * ⚠ THIS IS NOT THE PAGE GATE. Whether `setnayan.com/{slug}` opens is
 * `shopPageGate` (lib/own-shop-preview.ts) and whether a shop is bookable is
 * `isBookable` — both unchanged by this module.
 *
 * ⚠ RLS IS NOT WIDENED. An unverified shop reaches a couple only through these
 * server-side lists on the service-role client. `vendor_profiles_public_read`
 * stays verified-only, so a list that reads on a SESSION client still sees
 * verified shops only — move it to the admin client WITH this gate, never widen
 * the policy.
 */

import { isShopLive, parseVisibility } from './vendor-visibility';

/** The one column. */
export const FINDABLE_COLUMN = 'is_findable' as const;

/**
 * 📄 …and the papers stamp beside it (migration 20271348041863, owner 2026-11-14
 * "Keep them, block new" — answer B). A shop whose renewal day passed with no
 * renewed papers stays `verified` (so the couples who already booked it still see
 * it) but leaves every list: `papers_current` is generated `papers_lapsed_at IS NULL`.
 */
export const PAPERS_CURRENT_COLUMN = 'papers_current' as const;

/**
 * For `.match()` on `vendor_profiles` or `vendor_market_stats`.
 *
 * `.match()` and not a `<T extends Builder>(q: T) => T` helper for the reason
 * `lib/live-shops.ts` records: that generic makes tsc give up with "Type
 * instantiation is excessively deep" on postgrest-js's builder types.
 */
export const FINDABLE_SHOP_GATE = { [FINDABLE_COLUMN]: true, [PAPERS_CURRENT_COLUMN]: true } as const;

/**
 * The same gate on an EMBEDDED shop — `vendor_services` → `vendor_profiles!inner`
 * reads it as `{ 'vendor_profiles.is_findable': true }`.
 */
export function findableShopGate(embeddedAs?: string): Record<string, true> {
  const at = (c: string) => (embeddedAs ? `${embeddedAs}.${c}` : c);
  return { [at(FINDABLE_COLUMN)]: true, [at(PAPERS_CURRENT_COLUMN)]: true };
}

/** The columns {@link isShopFindable} reads, for a `.select()`. */
export const FINDABLE_INPUT_COLUMNS =
  'public_visibility, verification_state, find_locked_at, fraud_suspended_at, fraud_banned_at, fraud_tombstoned, papers_current' as const;

export type FindableInput = {
  public_visibility?: unknown;
  verification_state?: unknown;
  find_locked_at?: unknown;
  fraud_suspended_at?: unknown;
  fraud_banned_at?: unknown;
  fraud_tombstoned?: unknown;
  /** False once the shop's papers lapsed (the 30 March renewal passed unrenewed). */
  papers_current?: unknown;
};

const UNDECIDED = new Set(['unverified', 'pending_review']);

const present = (v: unknown) => v !== null && v !== undefined && v !== '';

/**
 * The TypeScript twin of `vendor_profiles.is_findable`. Fails CLOSED: an absent
 * or unreadable column can never read as findable.
 */
export function isShopFindable(row: FindableInput | null | undefined): boolean {
  if (!row) return false;
  // A lapsed shop leaves every list, verified or not. Only an explicit `false`
  // refuses here — the database gate (`FINDABLE_SHOP_GATE`) is the strict half.
  if (row.papers_current === false) return false;
  // 15 Nov, "Verified only": nothing but a verified, listed shop is found.
  return isShopLive(row);
}

/**
 * A shop Setnayan has not decided yet (`unverified` · `pending_review`) that is open: not archived, not
 * fraud-frozen. Its own page, link and QR open, and it can be messaged and booked there (15 Nov) — it is just not
 * found in any list. The first-inquiry lock plays no part.
 */
export function undecidedShopOpens(row: FindableInput | null | undefined): boolean {
  if (!row) return false;
  const state = typeof row.verification_state === 'string' ? row.verification_state : null;
  if (!state || !UNDECIDED.has(state)) return false;
  // parseVisibility resolves junk to 'hidden', so only a real 'archived' shuts it.
  if (parseVisibility(row.public_visibility) === 'archived') return false;
  if (present(row.fraud_suspended_at) || present(row.fraud_banned_at)) return false;
  if (row.fraud_tombstoned === true) return false;
  return true;
}

/**
 * 🔗 RULING (3): a not-yet-decided shop's OWN page link and QR codes open —
 * before its first inquiry (a couple found it in a list and taps through) and
 * after it (*"they can use their website manually. they can still use their QR
 * codes"*). True for an undecided shop, locked or not, that is not archived and
 * not fraud-frozen. Verified shops are `isShopLive`'s, not this function's.
 *
 * FAILS CLOSED ON A SHORT SELECT: every fraud column must be ON the row — an
 * absent column is "not read", never "not frozen".
 */
export function ownLinkOpensUnverified(row: FindableInput | null | undefined): boolean {
  if (!row) return false;
  if (!('fraud_suspended_at' in row) || !('fraud_banned_at' in row) || !('fraud_tombstoned' in row)) return false;
  return undecidedShopOpens(row);
}

/**
 * 💬 RULING (1)+(4) of 2026-11-07, widened 15 Nov: a couple may MESSAGE a shop Setnayan has not decided yet from
 * its page (reached by its own link or QR), and — since 15 Nov — book it there too (`shopBookingRefusal`,
 * lib/vendor-visibility.ts, and its database twin `enforce_booking_requires_verified_vendor`).
 *
 * `bookable` is passed in, not recomputed. A demo shop keeps its own rule: only `bookable` opens it.
 */
export function shopTakesMessages(
  row: (FindableInput & { is_demo?: unknown }) | null | undefined,
  bookable: boolean,
): boolean {
  if (bookable) return true;
  if (!row || row.is_demo === true) return false;
  return ownLinkOpensUnverified(row);
}

/** The ⓘ under {@link NOT_YET_VERIFIED_LINE}, on the shop page and the chat thread alike. */
export const NOT_YET_VERIFIED_INFO =
  'Setnayan has not checked this shop’s documents yet, so it has no Verified badge. You can message and book them here; Setnayan’s booking fee applies as usual. Verified shops show the badge beside their name.';

// ── The lock, as the shop and the admin desk see it ──────────────────────────

export type FindLockReason = 'inquiry' | 'import';

export type FindLockState =
  /** Verified: always found, with the badge. */
  | { state: 'verified' }
  /** Not decided yet and open: not found in any list until verified; its own link and QR open (15 Nov). */
  | { state: 'until_verified' }
  /** Rejected, demoted, archived, frozen — not found, and its page does not open either. */
  | { state: 'not_findable' };

export type FindLockInput = FindableInput & { find_lock_reason?: unknown };

export function findLockState(row: FindLockInput | null | undefined): FindLockState {
  if (!row) return { state: 'not_findable' };
  const visibility = parseVisibility(row.public_visibility);
  if (visibility === 'verified' && row.verification_state === 'verified') return { state: 'verified' };
  if (undecidedShopOpens(row)) return { state: 'until_verified' };
  return { state: 'not_findable' };
}

/** Where a shop goes to get verified — the shipped documents step (the same door the first-steps rail opens). */
export const VERIFY_HREF = '/vendor-dashboard/profile#docs';


/** What a couple is told on an unverified shop's chat and page (ruling (4)). In-app only, never email. */
export const NOT_YET_VERIFIED_LINE = 'This shop is not yet verified by Setnayan';

/**
 * 💬 RULING (4), the chat half: does the couple's thread with this shop carry {@link NOT_YET_VERIFIED_LINE}?
 * True only for a READ row that says the shop is not verified and is not a demo shop. A missing or unreadable row
 * answers false — the line is a claim about the shop, so it is never drawn from an absence.
 */
export function threadShowsNotYetVerified(
  row: { verification_state?: unknown; is_demo?: unknown } | null | undefined,
): boolean {
  if (!row || row.is_demo === true) return false;
  const state = typeof row.verification_state === 'string' ? row.verification_state : null;
  return state !== null && state !== 'verified';
}

/** The admin desk's one line per state. */
export function findLockAdminLine(state: FindLockState): string {
  switch (state.state) {
    case 'verified':
      return 'Found by couples · verified';
    case 'until_verified':
      return 'Not in Discover or Find until verified · its link and QR open';
    case 'not_findable':
      return 'Not found by couples';
  }
}
