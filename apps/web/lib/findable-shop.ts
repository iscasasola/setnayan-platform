/**
 * findable-shop.ts — WHO A COUPLE CAN FIND. One rule, asked by every list.
 *
 * ── THE RULING ──────────────────────────────────────────────────────────────
 * DECISION_LOG 2026-11-07 "🔎 AN UNVERIFIED SHOP IS FINDABLE UNTIL ITS FIRST
 * INQUIRY — THEN LOCKED OUT OF FIND UNTIL VERIFIED", reversing 2026-07-27's
 * "only show shops that are ready". Owner: *"they will be found for their first
 * inquiry and they will not get another inquiry unless … even if they are not
 * verified"* · *"first inquire will lock them already to prevent that loop hole"*.
 *
 *   · Verified shops always show (with the badge).
 *   · A shop Setnayan has not decided yet (`unverified` · `pending_review`) shows
 *     in search, Suppliers › Find, category pages and suggestions UNTIL its first
 *     inquiry — a couple's first message, never a view or a save.
 *   · The first inquiry, or the first customer the shop imports through its own
 *     invite/QR, LOCKS it out of those lists until it is verified. Permanent:
 *     deleting the inquiry does not unlock it. Only an admin lift does.
 *   · Rejected, demoted, archived and fraud-frozen shops never show.
 *
 * ── WHERE THE RULE LIVES ────────────────────────────────────────────────────
 * In the DATABASE, once: `vendor_profiles.is_findable`, a stored generated
 * column (migration 20271320303985), also on `vendor_market_stats`. Every list
 * filters on that one column through {@link FINDABLE_SHOP_GATE} /
 * {@link findableShopGate}; nothing re-types `public_visibility` +
 * `verification_state` for a list any more. {@link isShopFindable} is the
 * TypeScript twin for rows already in hand, pinned to the column by
 * `tests/db/an-unverified-shop-is-findable-until-its-first-inquiry.db.test.ts`.
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

import { parseVisibility } from './vendor-visibility';

/** The one column. */
export const FINDABLE_COLUMN = 'is_findable' as const;

/**
 * For `.match()` on `vendor_profiles` or `vendor_market_stats`.
 *
 * `.match()` and not a `<T extends Builder>(q: T) => T` helper for the reason
 * `lib/live-shops.ts` records: that generic makes tsc give up with "Type
 * instantiation is excessively deep" on postgrest-js's builder types.
 */
export const FINDABLE_SHOP_GATE = { [FINDABLE_COLUMN]: true } as const;

/**
 * The same gate on an EMBEDDED shop — `vendor_services` → `vendor_profiles!inner`
 * reads it as `{ 'vendor_profiles.is_findable': true }`.
 */
export function findableShopGate(embeddedAs?: string): Record<string, true> {
  return { [embeddedAs ? `${embeddedAs}.${FINDABLE_COLUMN}` : FINDABLE_COLUMN]: true };
}

/** The columns {@link isShopFindable} reads, for a `.select()`. */
export const FINDABLE_INPUT_COLUMNS =
  'public_visibility, verification_state, find_locked_at, fraud_suspended_at, fraud_banned_at, fraud_tombstoned' as const;

export type FindableInput = {
  public_visibility?: unknown;
  verification_state?: unknown;
  find_locked_at?: unknown;
  fraud_suspended_at?: unknown;
  fraud_banned_at?: unknown;
  fraud_tombstoned?: unknown;
};

const UNDECIDED = new Set(['unverified', 'pending_review']);

const present = (v: unknown) => v !== null && v !== undefined && v !== '';

/**
 * The TypeScript twin of `vendor_profiles.is_findable`. Fails CLOSED: an absent
 * or unreadable column can never read as findable.
 */
export function isShopFindable(row: FindableInput | null | undefined): boolean {
  if (!row) return false;
  const visibility = parseVisibility(row.public_visibility);
  const state = typeof row.verification_state === 'string' ? row.verification_state : null;
  if (visibility === 'verified' && state === 'verified') return true;
  if (!state || !UNDECIDED.has(state)) return false;
  // parseVisibility resolves junk to 'hidden', so only a real 'archived' shuts it.
  if (visibility === 'archived') return false;
  if (present(row.find_locked_at)) return false;
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
  const state = typeof row.verification_state === 'string' ? row.verification_state : null;
  if (!state || !UNDECIDED.has(state)) return false;
  return isShopFindable({ ...row, find_locked_at: null });
}

// ── The lock, as the shop and the admin desk see it ──────────────────────────

export type FindLockReason = 'inquiry' | 'import';

export type FindLockState =
  /** Verified: always found, with the badge. */
  | { state: 'verified' }
  /** Not decided yet and not locked: found until the first inquiry. */
  | { state: 'findable_until_first_inquiry' }
  /** Not decided yet and locked by its first inquiry or import. */
  | { state: 'locked'; reason: FindLockReason; since: string }
  /** Rejected, demoted, archived, frozen — not found, and not because of the lock. */
  | { state: 'not_findable' };

export type FindLockInput = FindableInput & { find_lock_reason?: unknown };

export function findLockState(row: FindLockInput | null | undefined): FindLockState {
  if (!row) return { state: 'not_findable' };
  const visibility = parseVisibility(row.public_visibility);
  if (visibility === 'verified' && row.verification_state === 'verified') return { state: 'verified' };
  if (isShopFindable(row)) return { state: 'findable_until_first_inquiry' };
  // Locked only when the lock is the ONLY thing standing between the shop and Find.
  if (present(row.find_locked_at) && isShopFindable({ ...row, find_locked_at: null })) {
    return {
      state: 'locked',
      reason: row.find_lock_reason === 'import' ? 'import' : 'inquiry',
      since: String(row.find_locked_at),
    };
  }
  return { state: 'not_findable' };
}

/** Where a shop goes to get verified — the shipped documents step (the same door the first-steps rail opens). */
export const VERIFY_HREF = '/vendor-dashboard/profile#docs';

/**
 * The supplier's notice when locked. Ruling (5), verbatim title for an inquiry:
 * "You've had your first inquiry — get verified to be found again" + Verify.
 * Detail lives in the ⓘ (`info`), never in the visible line.
 */
export function findLockNotice(state: FindLockState): {
  title: string;
  body: string;
  info: string;
  cta: { label: string; href: string };
} | null {
  if (state.state !== 'locked') return null;
  return {
    title:
      state.reason === 'import'
        ? 'You’ve had your first booking — get verified to be found again'
        : 'You’ve had your first inquiry — get verified to be found again',
    body: 'Couples can’t find you in search or Suppliers › Find until you’re verified. Your page link and QR codes still work.',
    info:
      state.reason === 'import'
        ? 'Bringing in your own customer counts as your first booking. Until Setnayan verifies your shop, it stays out of search, Suppliers › Find and suggestions. Your own page link and QR codes keep working, and couples who open them are told your shop is not yet verified.'
        : 'An unverified shop is shown to couples until its first inquiry. After that it stays out of search, Suppliers › Find and suggestions until Setnayan verifies it. Your own page link and QR codes keep working, and couples who open them are told your shop is not yet verified.',
    cta: { label: 'Verify', href: VERIFY_HREF },
  };
}

/** What a couple is told on an unverified shop's chat and page (ruling (4)). In-app only, never email. */
export const NOT_YET_VERIFIED_LINE = 'This shop is not yet verified by Setnayan';

/** The admin desk's one line per state. */
export function findLockAdminLine(state: FindLockState): string {
  switch (state.state) {
    case 'verified':
      return 'Found by couples · verified';
    case 'findable_until_first_inquiry':
      return 'Found by couples until its first inquiry';
    case 'locked':
      return state.reason === 'import'
        ? 'Out of Find since its first imported customer'
        : 'Out of Find since its first inquiry';
    case 'not_findable':
      return 'Not found by couples';
  }
}
