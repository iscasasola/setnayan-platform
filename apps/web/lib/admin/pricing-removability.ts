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
 * `papic_tier_config`), and those pointers are inert — 0 seats reference the
 * code and 0 `papic_one_orders` rows exist at all.
 *
 * 🛑 CORRECTED 2026-08-29 — THIS DOCBLOCK SAID "Those THREE tables CASCADE on
 * delete", AND ONE OF THEM DOES NOT. Read out of prod by the constraint, not
 * from a migration: `papic_one_tiers` and `papic_pass_tiers` are ON DELETE
 * CASCADE, but `papic_tier_config.rate_service_code` is ON DELETE **NO
 * ACTION**. So a pointer this file graded "informational" was in fact the
 * database refusing the delete outright — the admin pressed "remove for good"
 * on the four `PAPIC_CAMERA_*_DAY` rows and got a raw Postgres error instead of
 * a plain sentence. A `papicTierConfigPointer` now BLOCKS, with a reason
 * somebody can read; the two CASCADE tables stay informational, which is what
 * that grading was always right about.
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
  // ── lib/setnayan-ai-type-pricing.ts · AI_TIER_SKU ────────────────────────
  // The price of the assisted planner for 15 of 17 event types.
  'SETNAYAN_AI_B',
  'SETNAYAN_AI_C',
  'SETNAYAN_AI_D',
  // Not itself read by literal string today, but it is the ONE MORE tier in
  // the same family and the same migration's docblock names it in the same
  // breath — kept out of the removable set on the same reasoning until it is
  // independently re-verified.
  'SETNAYAN_AI_RENEW',

  // ── lib/papic-cameras.ts · fetchCameraRates ──────────────────────────────
  // ⚠ ADDED 2026-08-29, AND THE SWEEP THAT FOUND THEM IS THE POINT: the list
  // above was found by reading ONE migration's docblock, and this file said so
  // ("a floor, not a ceiling"). Enumerating every `from('platform_retail_
  // catalog_v2')` call site instead — rather than every code — turned up a
  // second family with the identical shape.
  //
  // `fetchCameraRates` reads all four by literal string with NO `is_active`
  // filter and substitutes a hardcoded constant when a row is missing. Its
  // output is not decoration:
  //   · studio/papic/page.tsx renders GuestCameraTierPicker from
  //     cameraRates.roll / .unlimited — a live buy surface gated on guest
  //     count, NOT on papic_tier_config.is_active;
  //   · studio/papic/actions.ts feeds the same rates to computeCameraQuote,
  //     which sets requested_total_php on a real `orders` row.
  // So two of these four price a charge a couple can make today. Deleting one
  // moves no number (catalogue 100/50/50/200 == the fallbacks 100/50/50/200)
  // — it moves the price out of the owner's reach and into a deploy.
  //
  // 🔑 All four are locked together, not just the two that render: the reader
  // cross-falls-back mini <-> roll, so half a rate table is worse than all of
  // it. And `fallback-prices-match-the-catalog.db.test.ts` EXEMPTS
  // papic-cameras.ts from its automatic pairing ("many constants, mostly
  // retired rungs"), so nothing else was watching these.
  'PAPIC_CAMERA_ROLL_DAY',
  'PAPIC_CAMERA_MINI_DAY',
  'PAPIC_CAMERA_LTD_DAY',
  'PAPIC_CAMERA_UNLIMITED_DAY',
]);

export type RetailRemovability = {
  neverSold: boolean;
  heldByActiveBundle: boolean;
  heldByLiveActivation: boolean;
  liveActivationCount: number;
  knownCodeDependency: boolean;
  /**
   * A pointer from `papic_one_tiers` / `papic_pass_tiers` — both ON DELETE
   * CASCADE, so they clean themselves up. Informational only; does NOT block.
   */
  papicConfigPointer: boolean;
  /**
   * A pointer from `papic_tier_config.rate_service_code`, which is ON DELETE
   * **NO ACTION** — the database will REFUSE the delete. This BLOCKS, so the
   * admin reads a sentence instead of a raw Postgres foreign-key error.
   */
  papicTierConfigPointer: boolean;
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
  // ⚠ SPLIT ON THE DELETE RULE, NOT ON THE TABLE FAMILY. These three tables
  // look interchangeable and are not: two CASCADE, one does not.
  const papicCascadePointer = new Set<string>([
    ...(oneTiers.data ?? []).map((r) => r.service_code as string),
    ...(passTiers.data ?? []).map((r) => r.service_code as string),
  ]);
  const papicTierConfigPointer = new Set<string>(
    (tierConfig.data ?? []).map((r) => r.rate_service_code as string),
  );

  for (const code of retiredServiceCodes) {
    map.set(
      code,
      classify(
        code,
        bundleHeld,
        activationCounts,
        everSold,
        papicCascadePointer,
        papicTierConfigPointer,
      ),
    );
  }
  return map;
}

function classify(
  code: string,
  bundleHeld: Set<string>,
  activationCounts: Map<string, number>,
  everSold: Set<string>,
  papicCascadePointer: Set<string>,
  papicTierConfigPointerSet: Set<string>,
): RetailRemovability {
  const heldByActiveBundle = bundleHeld.has(code);
  const liveActivationCount = activationCounts.get(code) ?? 0;
  const heldByLiveActivation = liveActivationCount > 0;
  const neverSold = !everSold.has(code);
  const knownCodeDependency = KNOWN_CODE_LITERAL_DEPENDENCIES.has(code);
  const papicConfigPointer = papicCascadePointer.has(code);
  const papicTierConfigPointer = papicTierConfigPointerSet.has(code);

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
  if (papicTierConfigPointer) {
    reasons.push('The Papic camera-rate settings still point at it — clear that first');
  }

  const safeToRemove =
    neverSold &&
    !heldByActiveBundle &&
    !heldByLiveActivation &&
    !knownCodeDependency &&
    !papicTierConfigPointer;

  return {
    neverSold,
    heldByActiveBundle,
    heldByLiveActivation,
    liveActivationCount,
    knownCodeDependency,
    papicConfigPointer,
    papicTierConfigPointer,
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
      papicTierConfigPointer: false,
      safeToRemove: !KNOWN_CODE_LITERAL_DEPENDENCIES.has(serviceCode),
      reasons: [],
    }
  );
}
