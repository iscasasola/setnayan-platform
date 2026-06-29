/**
 * First-Look Window (Wave 2 of the "Soon" vendor benefits) — the small,
 * defensively-read config + eligibility helpers that ACTIVATE the responsiveness
 * head-start already baked into lib/compat-score (`respondsFast` + `boostWeight`).
 *
 * The two admin-managed knobs live on `platform_settings` (single row, id=1):
 *   - `firstlook_sla_hours`   INT     · default 24 — a vendor must have replied to
 *                                       recent in-region inquiries within this SLA
 *                                       to earn the boost / "Replies fast" badge.
 *   - `firstlook_boost_weight` NUMERIC · default 0.10 — the blend weight passed to
 *                                       computeCompatScore (0 → no-op).
 *
 * DEFENSIVE READ (deliberate): the migration that adds these two columns may
 * still be mid-apply in prod, so we do NOT fold them into the shared
 * `fetchPlatformSettings` SELECT (that would break the main settings fetch during
 * the apply window). Instead this is a tiny dedicated reader that selects ONLY
 * the two columns and falls back to the documented defaults on ANY error or
 * missing value. Net effect while the column is absent: boost_weight resolves to
 * the default 0.10 only if the column exists; on a "column does not exist" error
 * we fall back to the same documented defaults — never throwing into the matcher.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type FirstLookConfig = {
  /** Hours within which a reply counts as "fast". Admin-managed; default 24. */
  slaHours: number;
  /** Blend weight handed to computeCompatScore (0 = no-op). Default 0.10. */
  boostWeight: number;
};

export const FIRSTLOOK_DEFAULTS: FirstLookConfig = {
  slaHours: 24,
  boostWeight: 0.1,
};

/**
 * Responsiveness-rate floor (%). A vendor must answer at least this share of
 * recent inquiries to earn First-Look — fast-but-flaky shouldn't get the boost.
 * Hardcoded for now; can later move to admin config alongside the SLA.
 */
export const FIRSTLOOK_RESPONSE_RATE_FLOOR_PCT = 70;

/**
 * Read the two First-Look knobs defensively. Selects ONLY the two columns from
 * platform_settings.id=1, wrapped in try/catch, and falls back to
 * FIRSTLOOK_DEFAULTS on ANY error (incl. "column does not exist" mid-apply) or a
 * missing row/value. Never throws — the matcher can always `await` this safely.
 */
export async function fetchFirstLookConfig(
  supabase: SupabaseClient,
): Promise<FirstLookConfig> {
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('firstlook_sla_hours, firstlook_boost_weight')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return FIRSTLOOK_DEFAULTS;
    const row = data as {
      firstlook_sla_hours: number | null;
      firstlook_boost_weight: number | null;
    };
    const slaHours =
      typeof row.firstlook_sla_hours === 'number' && row.firstlook_sla_hours > 0
        ? row.firstlook_sla_hours
        : FIRSTLOOK_DEFAULTS.slaHours;
    const boostWeight =
      typeof row.firstlook_boost_weight === 'number' &&
      row.firstlook_boost_weight >= 0
        ? row.firstlook_boost_weight
        : FIRSTLOOK_DEFAULTS.boostWeight;
    return { slaHours, boostWeight };
  } catch {
    return FIRSTLOOK_DEFAULTS;
  }
}

/**
 * First-Look eligibility for one vendor from its vendor_activity_stats row.
 * EARNED when the vendor replies within the SLA *and* clears the response-rate
 * floor. Missing/unknown stats → NOT earned (sits at neutral in the score; never
 * a penalty). Pure + synchronous so both the matcher and the vendor dashboard
 * chip share one definition.
 */
export function isFirstLookEligible(
  stats: { avg_response_minutes: number | null; response_rate_pct: number | null } | undefined | null,
  slaHours: number,
): boolean {
  if (!stats) return false;
  const avg = stats.avg_response_minutes;
  // avg_response_minutes === 0 is the "not enough data yet" sentinel (see
  // vendor-stats-panel) — treat it as unknown, not as instant.
  if (avg == null || avg <= 0) return false;
  const withinSla = avg <= slaHours * 60;
  const rate = stats.response_rate_pct ?? 0;
  return withinSla && rate >= FIRSTLOOK_RESPONSE_RATE_FLOOR_PCT;
}
