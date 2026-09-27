/**
 * A COUNT, SPELLED ONCE — every plain quantity a person reads (shots, photos,
 * credits, guests, captures, views, points, bytes) is grouped with commas.
 *
 * Owner, 2026-09-27 (DECISION_LOG "EVERY NUMBER ON THE WEBSITE CARRIES
 * THOUSANDS COMMAS"), on the event Overview's Papic tile reading
 * "100050 shots ready": *"numbers with comma"* · *"all across the website. all
 * needs to have a ','"*. So it reads **100,050**.
 *
 * ⚖ MONEY DOES NOT COME THROUGH HERE. A peso figure goes through
 * `lib/php.ts` (`formatPhp` / `formatCentavosPhp` / `formatPhpRounded`), which
 * already groups AND owns the centavo rule. This is for figures that are not
 * money, and it never prints a currency sign.
 *
 * ⛔ IDENTIFIERS DO NOT COME THROUGH HERE EITHER: years, public ids, reference
 * and phone numbers, times, postcodes and table numbers are written as they
 * are — "2026", not "2,026". Grouping is for a quantity, never for a label.
 *
 * `100050` → `"100,050"` · `1234.5` → `"1,234.5"` · `-2500` → `"-2,500"` ·
 * absent / NaN → `"—"`. Fractions are kept (up to `maxFractionDigits`, default
 * 2) and never padded, so a whole count never grows a ".00".
 *
 * Pure module: no React, no I/O. Runs under `tsx --test`.
 */
export function formatCount(
  n: number | null | undefined,
  maxFractionDigits = 2,
): string {
  if (n === null || n === undefined) return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}
