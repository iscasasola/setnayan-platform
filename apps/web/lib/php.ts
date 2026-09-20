/**
 * THE PESO, SPELLED ONCE — every money figure this app shows a person comes
 * from one of the three functions below, and nothing else defines them.
 *
 * ── WHY THIS MODULE EXISTS: A NAME COLLISION IS A SILENT REWRITE ────────────
 * 🔴 On 2026-09-20 there were FOUR exported functions called `formatPhp`:
 *
 *     lib/orders.ts   → exact; ₱837.50 prints as ₱837.50   (PR #5744)
 *     lib/budget.ts   → `maximumFractionDigits: 0`; ₱837.50 prints as ₱838
 *     lib/vendors.ts  → byte-identical to budget.ts's
 *     lib/vendor-autoreply/answer.ts → `Math.round(php)`, and '' for absent
 *
 * …and THREE called `formatCentavosPhp`: `lib/payouts.ts` kept the centavos
 * while `lib/vendor-packages.ts` and `lib/sku-catalog.ts` did
 * `Math.round(centavos / 100)`, so one centavo rendered as **₱1**.
 *
 * 🔑 THE CALL SITE READS THE SAME EITHER WAY. `formatPhp(owedPhp)` is the same
 * fourteen characters whether the import above it says `@/lib/orders` or
 * `@/lib/budget`; only the import line decides whether a couple is told to send
 * ₱837.50 or ₱838. That is the exact mechanism PR #5756 traced for
 * `centavosToPhp` (`Math.round(centavos/100)` in
 * `lib/vendor-service-payment-schedules.ts` beside a correct namesake in
 * `lib/payouts.ts`), and it is why this is a CONSOLIDATION and not four fixes:
 * four correct copies of one rule do not stay equal, and nothing goes red when
 * they part.
 *
 * ⚠ SO THE MODULES THAT USED TO DEFINE THESE NOW RE-EXPORT FROM HERE.
 * `lib/orders.ts`, `lib/payouts.ts`, `lib/vendor-packages.ts` and
 * `lib/sku-catalog.ts` each keep their public name — their ~50 importers are
 * untouched — but there is now exactly ONE definition behind all of them.
 * `lib/security/money-formatter-scan.ts` fails the build if a second one
 * appears.
 *
 * ── ⚖ THE FAIL-SAFE THAT MADE THIS SWEEP SAFE ──────────────────────────────
 * `formatPhp` and `formatPhpRounded` render a WHOLE-peso figure to the same
 * bytes: `₱125,000` either way. They part company only where centavos exist —
 * that is, only where the rounding one was already lying. So re-pointing a call
 * site at the exact formatter cannot change what today's whole-peso rows
 * display; it can only stop a centavo-bearing row from being misreported. The
 * risk is entirely one-directional, which is why the exact formatter is the
 * DEFAULT and rounding is the thing that must be argued for.
 *
 * ── 🚨 AND THIS IS DISPLAY ONLY ─────────────────────────────────────────────
 * Nothing here is a place to fix a stored figure. If a number is rounded before
 * it is WRITTEN or COMPARED, the fix belongs at the write, not at the render —
 * see `lib/vendor-service-payment-schedules.ts#centavosToPhp` and
 * `lib/proposal-payment-schedule.ts#php2` for what that looks like.
 *
 * Pure module: no React, no I/O, no env, no clock. Runs under `tsx --test`.
 */

/**
 * `837.5` → `"₱837.50"` · `2499` → `"₱2,499"` · absent → `"—"`.
 *
 * THE DEFAULT MONEY FORMATTER. Real money owed, asked for, paid, received or
 * refunded — and every total derived from any of those — is printed with this.
 *
 * Moved here verbatim from `lib/orders.ts`, which PR #5744 standardised on
 * after a real booking fee of `₱837.50` was printed as **₱838** in three places
 * on the screen whose only job is to name the figure to type into GCash.
 * `app/vendor-dashboard/booking-fees/the-exact-peso-reaches-every-surface.test.ts`
 * pins its output; do not change it without reading that suite.
 *
 * ⚠ CENTAVOS ARE SHOWN ONLY WHEN THERE ARE ANY, and then ALWAYS as two digits.
 * `₱837.5` is a THIRD spelling of this number — Intl's bare default caps at
 * three decimals and drops a trailing zero — and that suite calls it out by
 * name. Hence the `toFixed(2)` + slice rather than `maximumFractionDigits: 2`.
 */
export function formatPhp(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const exact = n.toFixed(2);
  const dot = exact.lastIndexOf('.');
  // `whole` keeps its own sign, so a negative renders exactly as it always did.
  const whole = exact.slice(0, dot);
  const centavos = exact.slice(dot + 1);
  const grouped = Number(whole).toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  });
  return `₱${grouped}${centavos === '00' ? '' : `.${centavos}`}`;
}

/**
 * `83750` → `"₱837.50"` · absent → `"—"`. The same rule, entered in centavos.
 *
 * Money is `BIGINT` centavos in a dozen tables (`amount_centavos`,
 * `total_price_centavos`, `price_delta_centavos`, `total_locked_centavos`, …),
 * so this exists so that a centavos column does not need a division at every
 * call site — NOT so that it can have its own rounding rule. It is literally
 * `formatPhp` of the divided figure.
 *
 * 🔑 `Math.round` IS ON THE CENTAVOS, NEVER ON THE PESOS. Rounding a centavos
 * integer is a no-op on real data and guards a fractional centavo; rounding
 * after the division is what turned one centavo into ₱1.
 */
export function formatCentavosPhp(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '—';
  const n = Number(centavos);
  if (!Number.isFinite(n)) return '—';
  return formatPhp(Math.round(n) / 100);
}

/**
 * `12500` → `"₱12,500"` · `12500.4` → `"₱12,500"` · absent → `"—"`.
 *
 * @rounds-to-the-peso A TARGET, BAND, BENCHMARK OR ALLOCATION — never money.
 *
 * ⚖ THE REASON, STATED SO THE GUARD CAN FIND IT: the figures this is for are
 * not amounts anybody transfers. They are the couple's stated budget
 * (`budget_builds.budget_php`), the planner's per-category split
 * (`budget_allocation_decisions.recommended_amount_php` /
 * `final_amount_php`) and the typical-range rails computed from them — and all
 * three of those columns are **INTEGER** in the schema
 * (`20260926000000_budget_builds.sql`, `20260824000000_budget_allocation_decisions.sql`),
 * with `lib/budget-allocation.ts` rounding every derived leaf through
 * `Math.round` / `clampMinZeroInt` before it is ever displayed. A centavo on
 * these surfaces would be noise in a suggestion, and showing `₱12,500.00`
 * beside "typical range" invites it to be read as a price.
 *
 * ⛔ IT IS NOT A STYLE CHOICE AND IT IS NOT FOR MONEY. If the figure is owed,
 * asked for, paid, received or summed from any of those, use `formatPhp`. The
 * two disagree ONLY on a centavo-bearing figure, which means the only thing
 * this function can ever do differently is hide one.
 */
export function formatPhpRounded(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return `₱${n.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
