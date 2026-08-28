/**
 * onboarding-discount.ts — the house set-up discount, in ONE place.
 *
 * ⚖ OWNER, 2026-08-28: *"we give them a 10% discount if they purchase now. They
 * can order later, but they will lose the 10% discount."* · *"10% for all
 * purchase on onboarding"* · *"I want to be able to change 10% anytime. so I can
 * set discount on onboarding today and change it tomorrow. or anytime i want."*
 *
 * 🔴 THE FIRST ANSWER WAS A STAMP, NOT A DIAL. The 10% shipped as sixteen
 * per-row prices written once by a migration. That does not follow a reprice, an
 * admin cannot see what the discount currently is, and it could only ever go
 * DEEPER — a stored 10%-off price is cheaper than a 5%-off calculation, so
 * cheapest-wins would have pinned it there forever. The percentage is the rule
 * now, and the prices derive from it.
 *
 * 🔑 TWO INPUTS, AND THEY MEAN DIFFERENT THINGS:
 *   • `pct` — the house rule, one number on the settings singleton, editable at
 *     any moment. It applies to everything bought during the create flow.
 *   • `explicitPhp` — a DELIBERATE per-row override (`onboarding_price_php`),
 *     which is what Setnayan AI's ₱1,499 has always been. Not a copy of the
 *     rule; a decision somebody made about that one product.
 *
 * The buyer pays the cheaper of the two. That is what makes the house rule a
 * FLOOR — raise it to 50% and the planner follows; drop it to 5% and the
 * planner keeps its own better price — and it is why a row that merely follows
 * the rule must never store a copy of it.
 *
 * PURE. No I/O, no React: the card, the charge and the admin preview all read
 * the same function, so a screen cannot quote a figure the checkout will not
 * honour.
 */

/** Ceiling shared with the admin form and the column's CHECK constraint. */
export const MAX_ONBOARDING_DISCOUNT_PCT = 90;

/** What the house rule falls back to when the setting cannot be read. */
export const DEFAULT_ONBOARDING_DISCOUNT_PCT = 10;

/**
 * A percentage we are willing to act on, or the default.
 *
 * ⚠ FAILS TO THE DEFAULT, NEVER TO ZERO. A read error must not silently retract
 * a discount the screen has been advertising; and it must not invent a huge one
 * either, which is what the ceiling is for.
 */
export function readOnboardingDiscountPct(raw: unknown): number {
  /**
   * 🪤 `Number('')` IS 0, NOT NaN — and 0 is a legal discount, so an empty
   * string would sail through every range check and silently retract the whole
   * house discount. An unset column, a trimmed-to-nothing form field and a blank
   * env value all arrive looking exactly like "zero percent off". Caught by this
   * module's own test, not by review.
   */
  const str = typeof raw === 'string' ? raw.trim() : null;
  if (str === '') return DEFAULT_ONBOARDING_DISCOUNT_PCT;
  const n = str !== null ? Number(str) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n < 0 || n > MAX_ONBOARDING_DISCOUNT_PCT) {
    return DEFAULT_ONBOARDING_DISCOUNT_PCT;
  }
  return n;
}

/**
 * What a catalog row costs during the create flow.
 *
 * ⛔ NEVER ABOVE RETAIL. An override higher than the normal price is bad data,
 * not an offer — it would charge somebody MORE for buying early — so it is
 * ignored rather than honoured.
 *
 * 💰 Rounded to the peso. A price the checkout cannot render exactly is a price
 * somebody disputes, and the rungs are round numbers, so this is a floor on
 * fractions rather than a change to any real figure.
 */
export function setupPricePhp(
  retailPhp: number,
  explicitPhp: number | null | undefined,
  pct: number,
): number {
  if (!Number.isFinite(retailPhp) || retailPhp <= 0) return 0;
  const safePct = readOnboardingDiscountPct(pct);
  const derived = Math.round(retailPhp * (1 - safePct / 100) * 100) / 100;

  const explicit =
    typeof explicitPhp === 'number' && Number.isFinite(explicitPhp) && explicitPhp > 0
      ? explicitPhp
      : null;
  /**
   * 🪤 THERE WAS AN `explicit > retailPhp` GUARD HERE AND IT WAS UNREACHABLE.
   * `derived` is never above retail (the percentage is never negative), so
   * `Math.min` already refuses an override that costs more than the normal
   * price — no input can tell the two versions apart. Mutation testing proved
   * it: gutting the condition changed no answer, which is the signature of dead
   * code, not of a missing test. Deleted rather than left with a test pretending
   * to cover it. The null check IS load-bearing: `Math.min(null, x)` is 0, and
   * that would give the product away.
   */
  return explicit === null ? derived : Math.min(explicit, derived);
}

/** Is there anything to say? True only when the set-up price really is lower. */
export function hasSetupSaving(retailPhp: number, setupPhp: number): boolean {
  return Number.isFinite(retailPhp) && Number.isFinite(setupPhp) && setupPhp < retailPhp;
}
