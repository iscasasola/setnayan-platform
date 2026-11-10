/**
 * Which plans END on their own when `tier_expires_at` passes — the app's twin of the tier list inside
 * `sweep_vendor_tier_expiry` (latest definition: `a_solo_plan_lapses_too`, 20271286893359, then
 * `retire_the_custom_supplier_plan`, 20271310256381).
 *
 * 🔑 WHY THIS IS ONE CONSTANT (Lane G · Step 0 rows 14–15, 2026-11-10). On 2026-10-23 the SQL sweep learned
 * that Solo lapses too, and its header promised the one ended Solo comp would lapse "on its next dashboard
 * visit". It never did: the only caller (`app/vendor-dashboard/layout.tsx`) fires the sweep only for a tier in
 * its own inline `['pro', 'enterprise']` — so the database knew Solo lapses and was never asked. SetnaProd's
 * gift ended 19 Oct and still read Solo on 10 Nov, and the Plan page printed the past date as the future.
 * The list is held equal to the SQL by `lib/a-solo-plan-is-asked-to-lapse.test.ts`.
 */
export const LAPSING_TIERS = ['solo', 'pro', 'enterprise'] as const;

/** True when the shop is on a plan that can lapse — i.e. the sweep is worth calling. */
export function tierMayLapse(tier: string | null | undefined): boolean {
  return typeof tier === 'string' && (LAPSING_TIERS as readonly string[]).includes(tier);
}

/** True when the row's plan has already run out and the sweep has not yet written it back. */
export function tierHasLapsed(
  row: { tier_state?: string | null; tier_expires_at?: string | null } | null | undefined,
  nowMs: number,
): boolean {
  if (!row || !tierMayLapse(row.tier_state) || !row.tier_expires_at) return false;
  const endMs = Date.parse(row.tier_expires_at);
  return Number.isFinite(endMs) && endMs < nowMs;
}
