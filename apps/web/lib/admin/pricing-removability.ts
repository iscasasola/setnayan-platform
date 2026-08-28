import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * pricing-removability.ts — "safe to remove" for a retired customer SKU.
 *
 * WHATS_NEXT_Managing_Prices_2026-08-26.md § 5, the rule the whole retirement
 * feature turns on: "a removability check must ask 'has this DONE anything',
 * not only 'does anything point at it'. An FK is a pointer, not a job."
 *
 * Measured live against prod 2026-08-26 (re-derived here, not copied from the
 * handoff doc, which itself warns its own numbers can go stale): of the 43
 * retired customer rows, a batch of them are pointed at ONLY by the Papic
 * tier-config tables (`papic_one_tiers` / `papic_pass_tiers` /
 * `papic_tier_config`), and every one of those pointers is inert — 0 seats
 * reference the code, 0 `papic_one_orders` rows exist at all, and the one
 * function that reads `PAPIC_CAMERA_MINI_DAY` by name already misses its
 * `is_active` filter and falls back to a hardcoded default. Those three
 * tables CASCADE on delete, so removing a catalog row cleans them up for
 * free — that is a feature, not a risk, for a row proven unused.
 *
 * What DOES block removal, because each is a real consequence:
 *   - the SKU is still a component of a bundle that is itself on sale
 *     (`bundle_components` → an active `platform_package_catalog` row)
 *   - a real customer's event still has it switched on
 *     (`event_software_activations_v2`)
 *   - it has ever been sold — `orders.service_key` is a loose text column
 *     with NO foreign key to the catalogue, so a sold-then-deleted SKU would
 *     orphan the receipt with nothing left to say what it was for
 *   - it is on the KNOWN_CODE_LITERAL_DEPENDENCIES list below: a row that
 *     nothing in the DATABASE points at, but that application CODE still
 *     reads by literal string regardless of `is_active`.
 *
 * 🚨 THE KNOWN_CODE_LITERAL_DEPENDENCIES LIST IS THE PART A GENERIC SCAN
 * CANNOT FIND. `lib/setnayan-ai-type-pricing.ts` hardcodes
 * `SETNAYAN_AI_B` / `_C` / `_D` as PRICE SOURCES for non-wedding event types —
 * their own migration (20271139128584) says outright "Their prices are read
 * regardless of is_active. Do not tidy them by activating or deleting them."
 * Deleting one would silently break Setnayan AI pricing for every debut,
 * corporate, gala, tournament, gender-reveal, date and hangout event with
 * ZERO foreign key ever complaining — the exact "gate with no handle" shape
 * this codebase keeps re-discovering. A full audit of every retired code for
 * this SAME failure mode (a literal string read by some other lib file) was
 * NOT exhaustively performed for all 43 rows — only this one family, found by
 * reading the migration that created it. Treat this list as a floor, not a
 * ceiling: read a row's own migration history before trusting "safe to
 * remove" on anything this file has not specifically vetted.
 */

export const KNOWN_CODE_LITERAL_DEPENDENCIES: ReadonlySet<string> = new Set([
  'SETNAYAN_AI_B',
  'SETNAYAN_AI_C',
  'SETNAYAN_AI_D',
  // Not itself read by literal string today, but it is the ONE MORE tier in
  // the same family and the same migration's docblock names it in the same
  // breath — kept out of the removable set on the same reasoning until it is
  // independently re-verified.
  'SETNAYAN_AI_RENEW',
]);

export type RetailRemovability = {
  neverSold: boolean;
  heldByActiveBundle: boolean;
  heldByLiveActivation: boolean;
  liveActivationCount: number;
  knownCodeDependency: boolean;
  /** Informational only — does NOT block removal (see file docblock). */
  papicConfigPointer: boolean;
  safeToRemove: boolean;
  reasons: string[];
};

export type RetailRemovabilityMap = ReadonlyMap<string, RetailRemovability>;

/**
 * Batch-computes removability for every RETIRED row in one pass — 4 queries
 * total regardless of row count, not N+1. Call once per page render and read
 * from the map; `recheckRetailRemovability` below re-derives a SINGLE row
 * server-side right before an actual delete (never trust the render-time
 * value for the mutation — it can be seconds to minutes stale).
 */
export async function computeRetailRemovabilityMap(
  admin: SupabaseClient,
  retiredServiceCodes: readonly string[],
): Promise<RetailRemovabilityMap> {
  const map = new Map<string, RetailRemovability>();
  if (retiredServiceCodes.length === 0) return map;

  // Two plain queries + a JS intersection instead of a `!inner` embed — a
  // retired SKU only counts as "held by a bundle" when that BUNDLE is itself
  // on sale (a component of a bundle that is ALSO retired blocks nothing).
  const [bundleCompRes, activeBundleRes, activationRes, ordersRes, papicRes] = await Promise.all([
    admin
      .from('bundle_components')
      .select('component_service_code, bundle_sku_code')
      .in('component_service_code', retiredServiceCodes),
    admin.from('platform_package_catalog').select('package_code').eq('is_active', true),
    admin
      .from('event_software_activations_v2')
      .select('service_code')
      .in('service_code', retiredServiceCodes),
    admin
      .from('orders')
      .select('service_key')
      .in('service_key', retiredServiceCodes),
    Promise.all([
      admin.from('papic_one_tiers').select('service_code').in('service_code', retiredServiceCodes),
      admin.from('papic_pass_tiers').select('service_code').in('service_code', retiredServiceCodes),
      admin.from('papic_tier_config').select('rate_service_code').in('rate_service_code', retiredServiceCodes),
    ]),
  ]);

  const activeBundleCodes = new Set<string>(
    (activeBundleRes.data ?? []).map((r) => r.package_code as string),
  );
  const bundleHeld = new Set<string>(
    (bundleCompRes.data ?? [])
      .filter((r) => activeBundleCodes.has(r.bundle_sku_code as string))
      .map((r) => r.component_service_code as string),
  );
  const activationCounts = new Map<string, number>();
  for (const r of activationRes.data ?? []) {
    const code = r.service_code as string;
    activationCounts.set(code, (activationCounts.get(code) ?? 0) + 1);
  }
  const everSold = new Set<string>((ordersRes.data ?? []).map((r) => r.service_key as string));
  const [oneTiers, passTiers, tierConfig] = papicRes;
  const papicPointer = new Set<string>([
    ...(oneTiers.data ?? []).map((r) => r.service_code as string),
    ...(passTiers.data ?? []).map((r) => r.service_code as string),
    ...(tierConfig.data ?? []).map((r) => r.rate_service_code as string),
  ]);

  for (const code of retiredServiceCodes) {
    map.set(code, classify(code, bundleHeld, activationCounts, everSold, papicPointer));
  }
  return map;
}

function classify(
  code: string,
  bundleHeld: Set<string>,
  activationCounts: Map<string, number>,
  everSold: Set<string>,
  papicPointer: Set<string>,
): RetailRemovability {
  const heldByActiveBundle = bundleHeld.has(code);
  const liveActivationCount = activationCounts.get(code) ?? 0;
  const heldByLiveActivation = liveActivationCount > 0;
  const neverSold = !everSold.has(code);
  const knownCodeDependency = KNOWN_CODE_LITERAL_DEPENDENCIES.has(code);
  const papicConfigPointer = papicPointer.has(code);

  const reasons: string[] = [];
  if (heldByActiveBundle) reasons.push('It is still listed inside a bundle that is on sale');
  if (heldByLiveActivation) {
    reasons.push(
      liveActivationCount === 1
        ? "1 customer's event still has it switched on"
        : `${liveActivationCount} customers' events still have it switched on`,
    );
  }
  if (!neverSold) reasons.push('It has been sold before — receipts still name it');
  if (knownCodeDependency) {
    reasons.push('Its price is still read directly by app code even though it is off the price page');
  }

  const safeToRemove =
    neverSold && !heldByActiveBundle && !heldByLiveActivation && !knownCodeDependency;

  return {
    neverSold,
    heldByActiveBundle,
    heldByLiveActivation,
    liveActivationCount,
    knownCodeDependency,
    papicConfigPointer,
    safeToRemove,
    reasons,
  };
}

/**
 * Single-row, delete-time re-check. NEVER trust a client-supplied or
 * render-time "safe to remove" flag when actually deleting — data changes
 * between page load and button press (an order could land, a bundle could
 * flip on). This is the only measurement the delete action itself trusts.
 */
export async function recheckRetailRemovability(
  admin: SupabaseClient,
  serviceCode: string,
): Promise<RetailRemovability> {
  const map = await computeRetailRemovabilityMap(admin, [serviceCode]);
  return (
    map.get(serviceCode) ?? {
      neverSold: true,
      heldByActiveBundle: false,
      heldByLiveActivation: false,
      liveActivationCount: 0,
      knownCodeDependency: KNOWN_CODE_LITERAL_DEPENDENCIES.has(serviceCode),
      papicConfigPointer: false,
      safeToRemove: !KNOWN_CODE_LITERAL_DEPENDENCIES.has(serviceCode),
      reasons: [],
    }
  );
}
