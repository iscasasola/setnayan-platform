/**
 * ONE SIGN-UP DISCOUNT PER FAMILY — pure, no I/O.
 *
 * ⚖ OWNER RULING 2026-08-28: *"setnayan AI will have a single discount saving
 * for all Setnayan AI instead of each row having their own discount. Papic will
 * also have that 1 discount savings instead of each row."*
 *
 * So each row carries ONE typed price (the regular one) and the sign-up price is
 * DERIVED from its family's single discount. `onboarding_price_php` is NOT
 * retired — it stays the stored, charged value that every existing reader reads.
 * The discount is how that value is COMPUTED on save, not a replacement for it.
 *
 * ⚠ WHOLE PESOS ARE A RULE HERE, NOT A ROUNDING DETAIL. Migration
 * 20271176315255 ships a post-condition that RAISES if any PAPIC_GUEST% or
 * SETNAYAN_AI% sign-up price is fractional — *"a price the checkout cannot
 * render exactly is a price somebody disputes"* — and that migration is
 * explicitly designed to be re-run. All 66 priced catalog rows are whole pesos
 * today; not one is fractional. 40% of ₱2,499 is ₱1,499.40, so an unrounded
 * discount would both break that rule and make the migration fail on its next
 * run.
 *
 * ⇒ `signupPriceFor` rounds to the NEAREST peso, and ties fall DOWN. Rounding
 * down is the safe direction: the customer is never charged more than the
 * advertised discount implies, so the EFFECTIVE discount is always ≥ the
 * nominal one, never less. At the live numbers nearest and down agree on every
 * band (every tail is .40), so the choice is invisible today and load-bearing
 * the next time a percentage is nudged.
 */

/** The two families that carry a single shared sign-up discount. */
export type DiscountFamily = 'papic' | 'ai';

/**
 * 🔒 THE FLOOR IS PAPIC-ONLY (owner 2026-08-28: *"we will use the discount
 * created for Papic Service Only instead of both"*). Setnayan AI's bands answer
 * to no floor — they carry their own, deeper discount.
 *
 * ⚖ OWNER RULED 2026-08-29: the server REFUSES a Papic sign-up price below this
 * floor. Until then it was a browser warning and a data fact set once by
 * migration 20271176315255 — every server path accepted a value under it.
 *
 * 🔑 THE FLOOR IS ENFORCED IN TWO PLACES BECAUSE THERE ARE TWO WRITERS, AND
 * THEY MUST NOT DRIFT. `saveFamilyDiscount` sets it as a PERCENTAGE for a whole
 * family; the per-row card in `pricing-row-diff.ts` sets one row's sign-up PESO
 * amount directly. Both resolve to a percentage and compare it against this one
 * constant — never against a re-typed 10.
 */
export const PAPIC_DISCOUNT_FLOOR_PCT = 10;

/**
 * Percentages that came from dividing pesos are never exactly equal to a whole
 * number. A sign-up price computed to land ON the floor must not be refused by
 * a rounding tail, so comparisons allow this much slack.
 */
export const DISCOUNT_FLOOR_EPSILON_PCT = 0.005;

/** True when a discount clears the Papic floor, ties included. */
export function meetsPapicFloor(discountPct: number): boolean {
  return discountPct >= PAPIC_DISCOUNT_FLOOR_PCT - DISCOUNT_FLOOR_EPSILON_PCT;
}

/** Defaults — the values live in prod today. Fallbacks when settings are unreadable. */
export const FAMILY_DISCOUNT_DEFAULT_PCT: Readonly<Record<DiscountFamily, number>> = {
  papic: 10,
  // ⚖ Owner-set 2026-08-28, chosen with the arithmetic in front of him and
  // knowing two sign-up prices move. Not a computed value — his number.
  ai: 40,
};

/** Which family a catalog row belongs to, or null when it is in neither. */
export function familyForServiceCode(code: string): DiscountFamily | null {
  if (code.startsWith('PAPIC_GUEST')) return 'papic';
  // ⚠ SETNAYAN_AI_RENEW is deliberately EXCLUDED: a renewal is not an
  // onboarding purchase — nobody renews during the create flow — and it is the
  // one row where a discount lands on a fraction of a peso. Same exclusion the
  // shipped migration 20271176315255 makes, for the same reason.
  if (code === 'SETNAYAN_AI' || /^SETNAYAN_AI_[BCD]$/.test(code)) return 'ai';
  return null;
}

/**
 * The sign-up price a regular price and a family discount produce.
 *
 * Returns `null` when the inputs cannot produce an honest price, so a caller can
 * never mistake a failure for a free row. A 0% discount legitimately returns the
 * regular price.
 */
export function signupPriceFor(regularPhp: number, discountPct: number): number | null {
  if (!Number.isFinite(regularPhp) || regularPhp < 0) return null;
  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct >= 100) return null;
  return roundPesoTiesDown(regularPhp * (1 - discountPct / 100));
}

/**
 * THE HOUSE ROUNDING RULE, in one place: nearest peso, ties DOWN.
 *
 * `Math.round` rounds .5 UP, so the tie case is handled explicitly rather than
 * inherited. Down is the safe direction — the customer is never charged more
 * than the advertised discount implies, so the EFFECTIVE discount is always ≥
 * the nominal one.
 *
 * 🔑 EXTRACTED 2026-08-31 SO THE SECOND DISCOUNT MECHANIC SHARES IT. The
 * comeback offer (lib/setnayan-ai-comeback-offer.ts) rounds a MIDPOINT rather
 * than a percentage, so it cannot call `signupPriceFor` — but it must round the
 * same way, or two prices for the same product could land a peso apart. A money
 * rule written twice drifts; this repo has paid for that more than once.
 */
export function roundPesoTiesDown(exact: number): number {
  const floor = Math.floor(exact);
  return exact - floor === 0.5 ? floor : Math.round(exact);
}

/**
 * The discount a stored pair actually represents, as a percentage — the
 * read-only figure the screen shows beside every row.
 *
 * `null` when it cannot be computed (no sign-up price, or a free regular price).
 */
export function effectiveDiscountPct(
  regularPhp: number,
  signupPhp: number | null,
): number | null {
  if (signupPhp == null) return null;
  if (!Number.isFinite(regularPhp) || regularPhp <= 0) return null;
  if (!Number.isFinite(signupPhp) || signupPhp < 0) return null;
  return (1 - signupPhp / regularPhp) * 100;
}

/** What is wrong with a family's discount, in words. Empty = fine. */
export type DiscountComplaint = {
  kind: 'out_of_range' | 'below_floor' | 'not_a_discount';
  message: string;
};

/**
 * THE GUARDS, and which family each one applies to.
 *
 *   • out_of_range   — BOTH families, REFUSES. Negative, or 100%+, is nonsense.
 *   • not_a_discount — BOTH families, WARNS. At 0% there is no reason to buy
 *     early. It is legal — a family may run without a sign-up saving — so it is
 *     reported, not blocked. This is NOT the floor and does not narrow with it.
 *   • below_floor    — PAPIC ONLY, REFUSES (owner 2026-08-29).
 *
 * 🔑 WHICH ONES BLOCK IS NOT DECIDED HERE. This function reports; the two
 * callers decide. `BLOCKING_COMPLAINTS` below is the single list they both read,
 * so a rule can never block on one writer and pass on the other.
 *
 * ⚠ NOTHING HERE CLAMPS. Each returns a complaint for the screen to show; the
 * typed value is never quietly rewritten. A screen that corrects your input
 * without saying so is worse than one that refuses.
 */
export function discountComplaints(
  family: DiscountFamily,
  discountPct: number,
): DiscountComplaint[] {
  const out: DiscountComplaint[] = [];

  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct >= 100) {
    out.push({
      kind: 'out_of_range',
      message: 'A discount has to be between 0% and 100%.',
    });
    // Everything below assumes a usable number.
    return out;
  }

  if (discountPct === 0) {
    out.push({
      kind: 'not_a_discount',
      message:
        'At 0% the sign-up price equals the regular price — there is no reason to buy during set-up.',
    });
  }

  if (family === 'papic' && !meetsPapicFloor(discountPct)) {
    out.push({
      kind: 'below_floor',
      message:
        `Papic sign-up prices have to be at least ${PAPIC_DISCOUNT_FLOOR_PCT}% off the regular price. ` +
        `${discountPct}% is less than that, so this was not saved.`,
    });
  }

  return out;
}

/**
 * THE COMPLAINTS THAT REFUSE A SAVE, as opposed to the ones that only speak up.
 *
 * 🔑 ONE LIST, READ BY EVERY WRITER. A money rule written twice drifts — this
 * repo has paid for that more than once — so neither the family-wide save nor
 * the per-row card carries its own opinion about which complaints are fatal.
 * Adding a kind here makes it block everywhere at once.
 */
export const BLOCKING_COMPLAINTS: ReadonlySet<DiscountComplaint['kind']> = new Set([
  'out_of_range',
  'below_floor',
]);

/** The first complaint that must stop a save, or null when none does. */
export function blockingComplaint(
  complaints: readonly DiscountComplaint[],
): DiscountComplaint | null {
  return complaints.find((c) => BLOCKING_COMPLAINTS.has(c.kind)) ?? null;
}

/** One row as the screen shows it after a discount is applied. */
export type FamilyRowPreview = {
  serviceCode: string;
  title: string;
  regularPhp: number;
  /** What is stored right now. */
  currentSignupPhp: number | null;
  /** What this discount would store. */
  nextSignupPhp: number | null;
  /** True when saving would move this row's sign-up price. */
  moves: boolean;
};

/**
 * What a family-wide save would DO, row by row.
 *
 * ⚠ THIS IS THE WHOLE RISK OF THE SINGLE-DISCOUNT SHAPE AND IT IS WHY THIS
 * FUNCTION EXISTS. Nudging one box silently reprices every row in the family —
 * sixteen of them for Papic. The screen must be able to say how many change and
 * show each before → after BEFORE the save, so a family-wide move is never
 * something somebody discovers afterwards.
 */
export function previewFamilySave(
  rows: readonly { serviceCode: string; title: string; regularPhp: number; signupPhp: number | null }[],
  discountPct: number,
): FamilyRowPreview[] {
  return rows.map((r) => {
    const next = signupPriceFor(r.regularPhp, discountPct);
    return {
      serviceCode: r.serviceCode,
      title: r.title,
      regularPhp: r.regularPhp,
      currentSignupPhp: r.signupPhp,
      nextSignupPhp: next,
      moves: next !== r.signupPhp,
    };
  });
}
