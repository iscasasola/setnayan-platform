/**
 * READING THE CARD OUT OF THE IN-PROGRESS FORM.
 *
 * The zero-step maker has no "preview" pane and no separate save affordance for
 * a region: the CARD is the preview, and it must move while the vendor types.
 * This module is that read — a pure `FormData → what the card says` function,
 * so the canvas never keeps a second copy of any value it is also posting.
 *
 * ── WHY THIS IS ITS OWN MODULE ────────────────────────────────────────────
 * A defect the owner hit in the prototype (2026-07-28): the price sheet's
 * inputs had no bindings, so typing a price never reached the card and the
 * owner read it as "I cannot save the price". A price line that only appears
 * after a submit makes the whole canvas feel broken. Pulling the read out of
 * the component makes that property TESTABLE without a DOM — see
 * canvas-form-snapshot.test.ts, which types into a FormData and asserts the
 * card's own string, with no form submission anywhere in the test.
 *
 * Everything here reads SHIPPED field names. There is no new pricing model —
 * this is a rendering of `pricing_basis` and friends.
 */

import { priceIsSet } from './service-publish-gate';

export type CanvasFormSnapshot = {
  hasCover: boolean;
  /** Showcase gallery photos. The cover is a separate field and not counted. */
  photoCount: number;
  hasClip: boolean;
  /** The card's price line, spoken in the active basis's own terms. */
  priceLine: string;
  hasPrice: boolean;
  /**
   * Inclusion labels and discount conditions are CARD TEXT — a couple reads
   * them on the card exactly the way they read a customization option — and the
   * real save gate (`commitVendorService`) text-checks both. They are here so
   * card health can check the same fields the server does; a snapshot missing
   * them is how a vendor scored 100 / "Ready" and then got bounced.
   */
  inclusionLabels: string[];
  discountConditions: string[];
  /** The serialised ★ Customization draft, still on the wire. */
  customizationRaw: string;
  linkedCount: number;
};

export const EMPTY_CANVAS_SNAPSHOT: CanvasFormSnapshot = {
  hasCover: false,
  photoCount: 0,
  hasClip: false,
  priceLine: '',
  hasPrice: false,
  inclusionLabels: [],
  discountConditions: [],
  customizationRaw: '',
  linkedCount: 0,
};

function num(v: FormDataEntryValue | null | undefined): number | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/[^0-9.]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function php(n: number): string {
  return `₱${Math.round(n).toLocaleString('en-PH')}`;
}

/**
 * A MONEY field, which is not the same thing as a number.
 *
 * 🪤 ZERO IS NOT A PRICE, and reading it as one was a live drift between this
 * card and the save. `num()` happily returns 0 for a typed `0`, so the card
 * rendered "₱0 flat" and reported `hasPrice: true` — the meter called the card
 * complete and the couple would have read a free wedding. The save path stores
 * that 0 too (`parseInt0OrNull` accepts it), and the publish gate refuses it
 * (`priceIsSet`), so the screen and the gate disagreed by exactly one value.
 * One definition now, shared with the gate.
 */
function money(v: FormDataEntryValue | null | undefined): number | null {
  const n = num(v);
  return priceIsSet(n) ? n : null;
}

/**
 * The price line a couple reads, in the owner's own words for the three bases
 * (owner-locked 2026-07-27 / clarified 2026-07-28):
 *
 *   PER HOUR   `hour_base_php` covers `min_hours`, then `extra_hour_php` for
 *              each additional hour.        → "₱25,000 · first 4 hrs, +₱6,000/hr"
 *   PER PAX    `per_pax_price_php` per head, with `min_pax` as a billing FLOOR —
 *              fewer guests than the minimum are billed AT the minimum, which is
 *              why the anchor is rate × min.
 *                                           → "₱1,200 per head · min 50 pax"
 *   FIXED      flat, regardless of hours and pax. Pax BRACKETS still win the
 *              anchor when the vendor set them (the shipped card-preview rule).
 *                                           → "₱80,000 flat"
 *
 * No price at all returns `hasPrice: false` rather than a zero — and since
 * 2026-08-28 that is what holds Publish shut (lib/service-publish-gate.ts). The
 * real number is still quoted in the couple's inquiry; what the card must carry
 * is a STARTING figure, or a couple's budget has nothing to match it against.
 */
export function cardPriceLine(fd: FormData): { priceLine: string; hasPrice: boolean } {
  const basis = String(fd.get('pricing_basis') ?? 'fixed');
  const isCrewMeals = String(fd.get('category') ?? '') === 'crew_meals';

  if (basis === 'per_pax') {
    const rate = money(fd.get('per_pax_price_php'));
    if (rate == null) return { priceLine: '', hasPrice: false };
    const minPax = num(fd.get('min_pax'));
    const unit = isCrewMeals ? 'per meal' : 'per head';
    const floor = isCrewMeals ? 'meals' : 'pax';
    return {
      priceLine: `${php(rate)} ${unit}${minPax ? ` · min ${minPax} ${floor}` : ''}`,
      hasPrice: true,
    };
  }

  if (basis === 'per_hour') {
    const base = money(fd.get('hour_base_php'));
    if (base == null) return { priceLine: '', hasPrice: false };
    const minHours = num(fd.get('min_hours'));
    const extra = num(fd.get('extra_hour_php'));
    const covers = minHours ? ` · first ${minHours} ${minHours === 1 ? 'hr' : 'hrs'}` : '';
    const more = extra ? `${minHours ? ',' : ' ·'} +${php(extra)}/hr` : '';
    return { priceLine: `${php(base)}${covers}${more}`, hasPrice: true };
  }

  const brackets = fd
    .getAll('bracket_price')
    .map((v) => money(v))
    .filter((n): n is number => n != null);
  if (brackets.length) {
    const low = Math.min(...brackets);
    return {
      priceLine: `from ${php(low)}${brackets.length > 1 ? ' · by guest count' : ' flat'}`,
      hasPrice: true,
    };
  }
  const flat = money(fd.get('starting_price_php'));
  if (flat == null) return { priceLine: '', hasPrice: false };
  return { priceLine: `${php(flat)} flat`, hasPrice: true };
}

/** Everything the card face and the health score read off the live form. */
export function readCanvasFormSnapshot(fd: FormData): CanvasFormSnapshot {
  const { priceLine, hasPrice } = cardPriceLine(fd);
  return {
    hasCover: String(fd.get('primary_photo_r2_key') ?? '').trim().length > 0,
    photoCount: fd
      .getAll('showcase_photo_r2_keys')
      .filter((v) => String(v).trim().length > 0).length,
    hasClip: String(fd.get('showcase_video_r2_key') ?? '').trim().length > 0,
    priceLine,
    hasPrice,
    // NOT trimmed-and-dropped the way labels are: the server's own
    // `parseDiscountRows` keeps a conditions string for every row it keeps, and
    // the gate reports it as `Discount N conditions` — an INDEX. Filtering
    // blanks out here would renumber the field the vendor is told to fix.
    // (`findVendorTextViolation` skips a blank value itself.)
    discountConditions: fd.getAll('discount_conditions_md').map((v) => String(v)),
    inclusionLabels: fd
      .getAll('inclusion_label')
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0),
    customizationRaw: String(fd.get('customization_draft') ?? ''),
    linkedCount: fd.getAll('linked').length,
  };
}

/**
 * A cheap identity for a snapshot.
 *
 * The canvas polls the form (the shipped editors write React-CONTROLLED hidden
 * inputs, which fire no DOM event), and a poll that calls setState with a fresh
 * object every tick re-renders the whole tree — including the editor the vendor
 * is currently typing into — several times a second for no reason. Comparing
 * this key first makes an unchanged poll a genuine no-op.
 */
export function canvasSnapshotKey(s: CanvasFormSnapshot): string {
  return [
    s.hasCover ? '1' : '0',
    s.photoCount,
    s.hasClip ? '1' : '0',
    s.priceLine,
    s.hasPrice ? '1' : '0',
    // Joined on a separator a vendor cannot type, rather than '', so that
    // ['ab','c'] and ['a','bc'] are different keys. Card TEXT belongs in
    // this key because card health text-checks it: an edit whose ONLY
    // effect is to introduce a contact-info violation must still wake the
    // score up.
    s.inclusionLabels.join('\u0001'),
    s.discountConditions.join('\u0001'),
    s.customizationRaw,
    s.linkedCount,
  ].join(' ');
}
