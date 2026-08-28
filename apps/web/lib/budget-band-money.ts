/**
 * budget-band-money.ts — the ONE arithmetic that turns a couple's budget FEEL
 * BAND into pesos.
 *
 * WHY THIS FILE EXISTS. `budget_band_config`'s own table comment states the
 * identity the whole product leans on:
 *
 *     per_head_median_centavos x pax = events.estimated_budget_centavos
 *
 * That identity was implemented TWICE, in two flows, at two different points of
 * the same range, and neither knew about the other:
 *
 *   • the wedding onboarding (onboarding-shell `effectiveBudgetPesos`) stores
 *     the band's HIGH end — the slider default the couple is shown and can drag;
 *   • create-event (`lib/create-event-capture.ts`) stores med x pax, the MIDDLE,
 *     and shows the couple no figure at all.
 *
 * So the same band + the same guest count becomes two different budgets
 * depending on which door the couple came through. Neither writer is changed
 * here — a stored budget is the couple's own money plan and moving it is the
 * owner's call, not a refactor's — but from now on there is one place that
 * knows what a band is worth, and the drift is named rather than accidental.
 *
 * PURE. No I/O, no server imports: the band ladder itself is read by the caller
 * (lib/budget-bands `getBudgetBands`, DB-first with an in-code fallback) and the
 * per-head median is handed in as pesos.
 */

/** Low end of a band's range = 0.8 x the per-head median. */
export const BAND_SPREAD_LOW = 0.8;
/** High end of a band's range = 1.2 x the per-head median. */
export const BAND_SPREAD_HIGH = 1.2;
/** Every band figure is shown to the nearest ₱50,000 (the onboarding slider's
 *  grain), so the derived number matches what the couple actually read. */
export const BAND_ROUNDING_PHP = 50_000;

const round50k = (n: number): number =>
  Math.round(n / BAND_ROUNDING_PHP) * BAND_ROUNDING_PHP;

export type BandRangePhp = {
  /** Bottom of the band for this guest count, in PHP. */
  lowPhp: number;
  /** Top of the band for this guest count, in PHP. Always > lowPhp. */
  highPhp: number;
};

/**
 * The peso range one band covers at a given guest count — the very "₱600K –
 * ₱900K" the onboarding prints under the band pills.
 *
 * Returns null when the band carries no per-head median (`no_limit` is med 0 —
 * a couple with no ceiling has no budget to fit against) or the guest count is
 * unusable. Null is the honest answer, never 0: a zero budget would read as
 * "they can afford nothing" and sink every shop.
 */
export function bandRangePhp(
  medPerHeadPhp: number | null | undefined,
  pax: number | null | undefined,
): BandRangePhp | null {
  const med = typeof medPerHeadPhp === 'number' ? medPerHeadPhp : Number(medPerHeadPhp);
  const guests = typeof pax === 'number' ? pax : Number(pax);
  if (!Number.isFinite(med) || med <= 0) return null;
  if (!Number.isFinite(guests) || guests <= 0) return null;

  const lowPhp = round50k(med * BAND_SPREAD_LOW * guests);
  let highPhp = round50k(med * BAND_SPREAD_HIGH * guests);
  // Small events round both ends to the same ₱50k step (or to zero). Keep the
  // range a real range — a band whose top equals its bottom cannot be a band.
  if (highPhp <= lowPhp) highPhp = lowPhp + BAND_ROUNDING_PHP;
  return { lowPhp, highPhp };
}

/**
 * THE band's peso figure: the top of the range, and the ONE answer.
 *
 * It is what both doors store (owner 2026-08-29) and what the vendor search
 * falls back to when a couple stated no figure of their own. Those were two
 * different numbers until that ruling; they are the same one now, from here.
 *
 * It is the TOP of the band, and the direction is deliberate. This number does
 * not charge anybody anything — it decides which shops a couple is shown. An
 * estimate that is too LOW silently sinks shops the couple could have afforded
 * and they never learn those shops exist; an estimate that is too HIGH shows
 * them a few options at the edge of their range, which they can see and reject.
 * Reach fails OPEN, the same way every other read on this path does.
 *
 * Null (band unknown / no ceiling / no guest count) means "we do not know",
 * which every consumer already treats as a neutral fit — never as ₱0.
 */
export function bandReachBudgetPhp(
  medPerHeadPhp: number | null | undefined,
  pax: number | null | undefined,
): number | null {
  return bandRangePhp(medPerHeadPhp, pax)?.highPhp ?? null;
}

/**
 * ⛔ RETIRED 2026-08-29 — THE DRIFT IS SETTLED, AND THIS IS THE HALF THAT WENT.
 *
 * There used to be a `bandMidBudgetPhp` here: `per_head_median x pax`, the plain
 * identity written on `budget_band_config` itself. `create-event` stored it
 * while the wedding onboarding stored the TOP of the same band, so one band and
 * one guest count became two budgets about a fifth apart depending on which door
 * the couple came through — and that number decides which suppliers they see.
 *
 * ⚖ OWNER 2026-08-29, on the recommendation that both doors show the couple the
 * range before saving it: **"ok"**. So the short form now prints the range as
 * they type and stores what they were shown, exactly as the wedding flow always
 * has, and there is one answer instead of two.
 *
 * The middle is not kept beside the top "just in case": a second function nobody
 * calls is how the two crept apart in the first place. The arithmetic that
 * produced it is still here — it is `bandRangePhp`, whose ends are 0.8x and 1.2x
 * that same median.
 */

/** Look up one band's per-head median (PESOS) in a band ladder. Null when the
 *  slug is absent or carries no median. Accepts the legacy `nolimit` spelling
 *  the create-event form still normalises. */
export function bandMedianPerHeadPhp(
  bands: ReadonlyArray<{ value: string; med: number }>,
  bandSlug: string | null | undefined,
): number | null {
  const slug = (bandSlug ?? '').trim();
  if (!slug) return null;
  const canonical = slug === 'nolimit' ? 'no_limit' : slug;
  const band = bands.find((b) => b.value === canonical);
  if (!band || !Number.isFinite(band.med) || band.med <= 0) return null;
  return band.med;
}
