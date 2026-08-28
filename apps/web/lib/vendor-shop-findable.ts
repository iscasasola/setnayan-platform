/**
 * "WHY CAN'T COUPLES FIND ME?" — the one place that answer is decided.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * A shop that is not publicly listed earns nothing and is told nothing. The
 * order-of-operations rail (`lib/vendor-first-steps.ts`) covers the first half
 * of that problem beautifully — but it reads ONE column, `verification_state`,
 * and returns null the moment that column says 'verified'. Public findability
 * is decided by TWO columns (`isShopLive`), and the second one,
 * `public_visibility`, is the marketplace/moderation state an admin sets
 * separately.
 *
 * So a shop sitting at verification_state = 'verified' AND
 * public_visibility = 'hidden' gets:
 *   · no rail (the rail thinks it is finished),
 *   · no banner (nothing looked at the other column),
 *   · and the Today hero line "You're all caught up — new leads land here the
 *     moment a couple unlocks you", which cannot come true.
 *
 * That is the SAME defect the rail's own docblock was written to kill, one
 * column over. Production holds a shop in exactly that state today.
 *
 * 🔒 AND NOTHING ELSE TELLS THEM. `transitionVendorVisibility` in
 * `app/admin/verify/actions.ts` writes an audit row and a tier-history row and
 * calls no notifier at all — `notifyVendorStatusChange` is wired to the
 * APPLICATIONS path, not the visibility path. So this banner is not a nicer
 * version of an email that already goes out; it is the only telling there is.
 * Do not write copy here that promises a message we do not send.
 *
 * ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────
 * It never contradicts the rail. When the rail is on screen, the rail IS the
 * message — a second banner saying "couples can't find you" beside a numbered
 * list whose whole subject is getting found would be two voices on one screen.
 * `railShowing` is therefore an input, not an afterthought.
 *
 * Pure — no I/O, no clock, no env. `public_visibility` is already on the row
 * every vendor surface loads (`FULL_VENDOR_PROFILE_SELECT`), so answering this
 * costs zero extra queries.
 */

import { parseVisibility } from './vendor-visibility';

export type ShopFindability =
  /** Live: `public_visibility = 'verified'` and the rail is done. */
  | { findable: true; reason: 'live' }
  /** Still working through approval — the first-steps rail is saying so. */
  | { findable: false; reason: 'still_getting_verified' }
  /** Approved, but not switched on in the marketplace. Only Setnayan can. */
  | { findable: false; reason: 'not_listed' }
  /** Closed. */
  | { findable: false; reason: 'archived' };

export type ShopFindabilityInput = {
  /** Raw `vendor_profiles.public_visibility`. Anything unreadable fails closed. */
  publicVisibility: unknown;
  /**
   * True when the order-of-operations rail is rendering. It renders only while
   * `verification_state !== 'verified'`, so it is also the honest stand-in for
   * "the approval half is not done" WITHOUT a second read of that column — and
   * it guarantees the two can never disagree on screen.
   */
  railShowing: boolean;
};

/**
 * Why a shop is or is not reachable by a browsing couple.
 *
 * FAILS TOWARD SAYING SOMETHING. `parseVisibility` resolves null, junk and
 * unknown values to 'hidden', so an unreadable state produces "not listed"
 * rather than a silent claim of being live. Nagging a live shop is recoverable;
 * telling an invisible shop that everything is fine is the failure this module
 * exists to stop.
 */
export function shopFindability(input: ShopFindabilityInput): ShopFindability {
  if (input.railShowing) return { findable: false, reason: 'still_getting_verified' };
  const visibility = parseVisibility(input.publicVisibility);
  if (visibility === 'verified') return { findable: true, reason: 'live' };
  if (visibility === 'archived') return { findable: false, reason: 'archived' };
  return { findable: false, reason: 'not_listed' };
}

export type FindabilityNotice = {
  title: string;
  body: string;
  cta: { label: string; href: string } | null;
};

/**
 * The words. Null when there is nothing to say — a live shop, and the
 * getting-verified case where the rail is already saying it better.
 *
 * ⛔ NO FIX BUTTON WHERE THERE IS NO FIX. A vendor cannot list their own shop:
 * `public_visibility` is written by `/admin/verify` and by fraud enforcement,
 * and nothing in the vendor dashboard writes it. A "Publish my shop" control
 * here would be a door that refuses in silence — the exact shape this repo has
 * paid for six times. The link asks a human instead.
 */
export function findabilityNotice(state: ShopFindability): FindabilityNotice | null {
  switch (state.reason) {
    case 'live':
    case 'still_getting_verified':
      return null;
    case 'not_listed':
      return {
        title: 'Couples can’t find you yet.',
        body:
          'Your shop is approved, but it is not showing in the marketplace — nobody browsing Setnayan can open it, so no new enquiry can reach you. Only Setnayan can switch it on.',
        cta: { label: 'Ask us to list your shop', href: '/help#contact' },
      };
    case 'archived':
      return {
        title: 'Your shop is closed.',
        body:
          'It is archived, so couples cannot find it and nobody can book you. Your customers, bookings and messages are untouched.',
        cta: { label: 'Ask us to reopen it', href: '/help#contact' },
      };
  }
}
