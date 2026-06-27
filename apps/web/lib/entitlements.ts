import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the active comp_grant scopes + scoped_skus for the authenticated
 * user. Used to bypass entitlement gates without needing per-event orders.
 *   - scope='all_services' → every SKU is unlocked
 *   - scope='specific_skus' → only the listed sku codes are unlocked
 * Degrades gracefully on schema errors (42P01/42703 → empty result).
 */
async function fetchActiveCompGrants(
  supabase: SupabaseClient,
): Promise<{ allServices: boolean; specificSkus: Set<string> }> {
  const { data, error } = await supabase
    .from('comp_grants')
    .select('scope, scoped_skus')
    .in('scope', ['all_services', 'specific_skus'])
    .is('revoked_at', null);
  if (error) {
    if (error.code === '42P01' || error.code === '42703')
      return { allServices: false, specificSkus: new Set() };
    throw new Error(`fetchActiveCompGrants failed: ${error.message}`);
  }
  let allServices = false;
  const specificSkus = new Set<string>();
  for (const row of data ?? []) {
    if (row.scope === 'all_services') { allServices = true; break; }
    if (row.scope === 'specific_skus' && Array.isArray(row.scoped_skus)) {
      for (const sku of row.scoped_skus) specificSkus.add(sku as string);
    }
  }
  return { allServices, specificSkus };
}

async function hasAllServicesGrant(supabase: SupabaseClient): Promise<boolean> {
  const { allServices } = await fetchActiveCompGrants(supabase);
  return allServices;
}

/**
 * apps/web/lib/entitlements.ts
 *
 * Single source of truth for couple-SKU ownership ("does this event own a
 * paid <serviceKey> order?"). Extracted from the 5 identical eventOwns*
 * helpers (pro-website / indoor-blueprint / animated-monogram / papic-seats /
 * papic-guest) + the inline custom-qr-guest gates so every couple SKU gate
 * reads orders ONE way: refund-aware, graceful-degrade, defense-in-depth.
 *
 * Behavior preserved verbatim from eventOwnsProWebsite():
 *   • a row with the matching service_key whose status is NOT in
 *     {cancelled, refunded, lapsed} confers ownership;
 *   • a still-in-reconciliation order (submitted / awaiting_payment / paid /
 *     fulfilled) counts as owned so the couple can't double-buy mid-review;
 *   • 42P01 (undefined_table) / 42703 (undefined_column) → false (safe
 *     pre-bootstrap default = "not owned" = show upgrade CTA), never throws;
 *   • any OTHER DB error still throws so we don't silently mis-gate in prod.
 *
 * NO migration — activation state IS orders.status. This helper does NOT
 * read or write any new column.
 */

/**
 * Statuses that mean an order no longer confers ownership. Anything else
 * (submitted · awaiting_payment · paid · fulfilled) keeps the capability
 * unlocked. Values align with OrderStatus (lib/orders.ts).
 */
export const RELINQUISHED_STATUSES = new Set<string>([
  'cancelled',
  'refunded',
  'lapsed',
]);

/**
 * Statuses that mean an order is ADMIN-APPROVED and the feature is unlocked —
 * the handshake (owner 2026-06-18: "must be approved by admin before they can
 * access it"). 'paid' is terminal for digital couple SKUs; 'fulfilled' covers
 * the vendor/delivery path. A still-pending 'submitted' / 'awaiting_payment'
 * order is NOT active: the couple has applied but the Setnayan team hasn't
 * verified the payment yet, so the FEATURE stays dark. (eventOwnsSku still
 * counts a pending order as a LIVE order so buy surfaces don't offer a second
 * purchase — that's double-buy prevention, a separate concern from access.)
 */
export const ACTIVE_STATUSES = new Set<string>(['paid', 'fulfilled']);

export async function checkOrderOwnership(
  supabase: SupabaseClient,
  eventId: string,
  serviceKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('event_id', eventId)
    .eq('service_key', serviceKey)
    .not('status', 'in', '("cancelled","refunded","lapsed")');

  // Pre-bootstrap / schema-drift tolerance — undefined table or column means
  // the orders substrate isn't there yet; treat as "not owned" so gated
  // surfaces show the upgrade entry point safely. A real error still surfaces.
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return false;
    throw new Error(
      `Failed to resolve ownership for ${serviceKey}: ${error.message}`,
    );
  }

  // Defense-in-depth: also filter client-side in case the DB-side enum filter
  // ever drifts — only a row in a live status confers ownership.
  return (data ?? []).some(
    (row) => !RELINQUISHED_STATUSES.has((row.status as string | null) ?? ''),
  );
}

/**
 * Approved-only ownership — the FEATURE-GATE reader (the handshake). TRUE only
 * when an order for `serviceKey` is in an ACTIVE status (paid/fulfilled); a
 * pending 'submitted' order does NOT count, so a paid feature stays dark until
 * the admin verifies the payment. Same graceful-degrade (42P01/42703 → false)
 * + throw-on-unknown-error contract as checkOrderOwnership.
 */
export async function checkOrderActive(
  supabase: SupabaseClient,
  eventId: string,
  serviceKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('event_id', eventId)
    .eq('service_key', serviceKey)
    .in('status', ['paid', 'fulfilled']);

  if (error) {
    if (error.code === '42P01' || error.code === '42703') return false;
    throw new Error(
      `Failed to resolve active entitlement for ${serviceKey}: ${error.message}`,
    );
  }

  // Defense-in-depth: re-filter client-side in case the DB-side filter drifts —
  // only a paid/fulfilled row counts as an unlocked feature.
  return (data ?? []).some((row) =>
    ACTIVE_STATUSES.has((row.status as string | null) ?? ''),
  );
}

/**
 * Bundle composition — which child SKUs each package bundle grants.
 *
 * WHY (PR4 dead-unlock repair, 2026-06-15): a bundle purchase lands as a SINGLE
 * orders row keyed service_key='GUIDED_PACK' | 'MEDIA_PACK' (see
 * app/dashboard/[eventId]/studio/bundle/page.tsx — "no member-SKU
 * decomposition"). So checkOrderOwnership(eventId, 'PANOOD_SYSTEM') is FALSE for
 * a couple who bought the Media Pack, even though the bundle includes it. The
 * old fan-out lived only in the DEAD DB fn verify_and_activate_manual_payment()
 * (migration 20260903000000 · zero app callers), so a bundle child SKU could
 * never unlock by paying. eventOwnsSku() below closes that on the READ side: it
 * grants a child SKU when the event owns a bundle that contains it. No
 * migration — ownership still IS orders.status, read one extra way.
 *
 * Canonical source of the membership list: BUNDLE_MEMBERS in
 * app/onboarding/wedding/_components/onboarding-pricing.ts (the bundle "what's
 * included" surface the customer actually buys). This map is the entitlement-
 * layer mirror of that fact, kept here so the read-side gate has no app→lib
 * import inversion. KEEP IN SYNC if BUNDLE_MEMBERS changes.
 *
 * Keyed by BUNDLE service_key → the child catalog service_codes it grants.
 */
export const BUNDLE_CHILD_SKUS: Readonly<{
  GUIDED_PACK: ReadonlyArray<string>;
  MEDIA_PACK: ReadonlyArray<string>;
  PAPIC_UNLOCK: ReadonlyArray<string>;
}> = Object.freeze({
  // Essentials — owner's 7 (onboarding-pricing.ts BUNDLE_MEMBERS.essentials).
  GUIDED_PACK: Object.freeze([
    'SETNAYAN_AI',
    'ANIMATED_MONOGRAM',
    'CUSTOM_QR_GUEST',
    'PRO_RSVP',
    'PAPIC_GUEST',
    'EVENT_WEBSITE',
    'PRO_WEBSITE',
  ]),
  // Complete — the canonical 18 paid SKUs (BUNDLE_MEMBERS.complete). Includes
  // every crew-delivered media child (LIVE_WALL, PANOOD_SYSTEM, SDE, …) that
  // the dead verify_and_activate_manual_payment() MEDIA_PACK branch used to
  // fan out.
  MEDIA_PACK: Object.freeze([
    'SETNAYAN_AI',
    'ANIMATED_MONOGRAM',
    'CUSTOM_QR_GUEST',
    'PRO_RSVP',
    'EVENT_WEBSITE',
    'PRO_WEBSITE',
    'PAPIC_GUEST',
    'PAPIC_ADDON_STORIES',
    'PAPIC_SEATS',
    'CAMERA_BRIDGE',
    'PABATI',
    'PATIKTOK_COMPILER',
    'PAPIC_ADDON_THANK_YOU',
    'SDE',
    'LIVE_WALL',
    'LIVE_BACKGROUND',
    'PANOOD_SYSTEM',
    'PAKANTA',
  ]),
  // Papic "Unlock all" — the per-Papic umbrella bundle (owner 2026-06-26). Grants
  // every Papic feature SKU so eventSkuActive(KWENTO / LIVE_WALL / …) resolves via
  // this bundle (app-side). The `lint:entitlement-gates` Guard 2 only validates
  // GUIDED_PACK/MEDIA_PACK by name, so a 3rd key is fine.
  //
  // The per-camera UNLI ALLOWANCE (unlimited cameras) + the guest 150-credit cap
  // lift — flagged as deferred when PR9 (#2269) shipped the bundle — now land via
  // eventHasPapicUnlock() below: a capture-gate bypass in the lib/papic-cameras
  // call sites + the papic_record_guest_capture RPC. PAPIC_GUEST is in the list
  // so the guest disposable camera surface unlocks (its cap is then lifted =
  // "unli guests"). PAPIC_SEATS stays OUT — it's the deprecated ₱2,999 crew pack
  // (superseded by the per-camera model, whose cameras the bypass makes
  // unlimited regardless). Still deferred: the DB-side bundles_granting_sku()
  // mirror for PAPIC_UNLOCK.
  PAPIC_UNLOCK: Object.freeze([
    'KWENTO',
    'LIVE_WALL',
    'PAPIC_ADDON_THANK_YOU',
    'PAPIC_ADDON_STORIES',
    'PABATI',
    'CAMERA_BRIDGE',
    'PAPIC_GUEST',
    'SDE',
    'PATIKTOK_COMPILER',
  ]),
});

/**
 * Reverse index: child service_code → the bundle service_keys that grant it.
 * Built once at module load from BUNDLE_CHILD_SKUS.
 */
const BUNDLES_GRANTING_SKU: ReadonlyMap<string, ReadonlyArray<string>> = (() => {
  const m = new Map<string, string[]>();
  for (const [bundleKey, children] of Object.entries(BUNDLE_CHILD_SKUS)) {
    for (const child of children) {
      const list = m.get(child) ?? [];
      list.push(bundleKey);
      m.set(child, list);
    }
  }
  return m;
})();

/**
 * Bundle-aware ownership: does this event own `serviceKey` — either by a direct
 * order for it, OR by owning a bundle (GUIDED_PACK / MEDIA_PACK) that includes
 * it? This is the canonical gate every couple-SKU surface should call (it
 * supersedes a bare checkOrderOwnership() for any SKU that can be bundled).
 *
 * Correctness for BOTH purchase shapes:
 *   • Direct child purchase  → checkOrderOwnership(eventId, childKey) = true.
 *   • Bundle purchase        → no child order exists, but the bundle order does,
 *                              so the bundle pass below returns true.
 *
 * Refund-aware end to end: a refunded/cancelled/lapsed bundle order stops
 * conferring the children (checkOrderOwnership already filters those statuses),
 * so revoking the bundle revokes its children too.
 *
 * Same graceful-degrade + throw-on-unknown-error contract as checkOrderOwnership
 * (it delegates to it). Passing a bundle code itself still works via the direct
 * check.
 */
export async function eventOwnsSku(
  supabase: SupabaseClient,
  eventId: string,
  serviceKey: string,
): Promise<boolean> {
  // 0. Comp grant bypass — all_services OR specific SKU match.
  const grants = await fetchActiveCompGrants(supabase);
  if (grants.allServices) return true;
  if (grants.specificSkus.has(serviceKey)) return true;

  // 1. Direct order for the SKU (covers à-la-carte purchase AND a bundle code
  //    passed directly).
  if (await checkOrderOwnership(supabase, eventId, serviceKey)) return true;

  // 2. Any bundle that includes this child SKU, owned by the event.
  const grantingBundles = BUNDLES_GRANTING_SKU.get(serviceKey);
  if (!grantingBundles || grantingBundles.length === 0) return false;
  for (const bundleKey of grantingBundles) {
    if (await checkOrderOwnership(supabase, eventId, bundleKey)) return true;
  }
  return false;
}

/**
 * Bundle-aware ACTIVE entitlement — THE HANDSHAKE GATE. Mirrors eventOwnsSku but
 * requires the order (direct OR the granting bundle) to be ADMIN-APPROVED
 * (paid/fulfilled), so a paid feature unlocks only AFTER the Setnayan team
 * verifies the payment (owner 2026-06-18). Refund/cancel revokes it the same way
 * (a relinquished order is also not active).
 *
 *   • FEATURE GATES (render/unlock the feature) call THIS.
 *   • BUY SURFACES keep eventOwnsSku (which counts a pending 'submitted' order)
 *     so a couple mid-review can't double-buy — and pair it with this to show a
 *     "payment under review" state instead of a misleading "unlocked".
 */
export async function eventSkuActive(
  supabase: SupabaseClient,
  eventId: string,
  serviceKey: string,
): Promise<boolean> {
  // Comp grant bypass — all_services OR specific SKU match.
  const grants = await fetchActiveCompGrants(supabase);
  if (grants.allServices) return true;
  if (grants.specificSkus.has(serviceKey)) return true;

  if (await checkOrderActive(supabase, eventId, serviceKey)) return true;
  const grantingBundles = BUNDLES_GRANTING_SKU.get(serviceKey);
  if (!grantingBundles || grantingBundles.length === 0) return false;
  for (const bundleKey of grantingBundles) {
    if (await checkOrderActive(supabase, eventId, bundleKey)) return true;
  }
  return false;
}

/** The "Unlock all of Papic" umbrella package code (PR9 · #2269). */
export const PAPIC_UNLOCK_SKU = 'PAPIC_UNLOCK';

/**
 * Does this event own an ACTIVE (admin-approved) "Unlock all of Papic" pass? The
 * Papic ALLOWANCE-bypass reader: the per-camera day-quota gates (lib/papic-cameras
 * call sites) and the guest disposable 150-credit cap read this to switch a
 * camera/guest to "unlimited" — the deferred half of PR9 (#2269), which unlocked
 * the add-on FEATURES via BUNDLE_CHILD_SKUS.PAPIC_UNLOCK but left the metered
 * allowances in place. Active-only (paid/fulfilled) — a pending pass never lifts
 * a limit. Same graceful-degrade contract as checkOrderActive (42P01/42703 →
 * false, throws on unknown). Pass an ADMIN client on public/claimer surfaces
 * (orders RLS is purchaser-scoped).
 */
export async function eventHasPapicUnlock(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return checkOrderActive(supabase, eventId, PAPIC_UNLOCK_SKU);
}

/**
 * BATCH bundle-aware entitlement for a whole event — the same logic as
 * eventSkuActive (active) + eventOwnsSku's pending notion, but resolved in ONE
 * query instead of N per-SKU round-trips. Built for the Studio hub grid, which
 * needs ownership for every service at once.
 *
 *   • `active`  — service_codes that are ADMIN-APPROVED (paid/fulfilled),
 *                 INCLUDING bundle children when the event owns GUIDED_PACK /
 *                 MEDIA_PACK (so a bundle owner's children read as Active, fixing
 *                 the grid-vs-surface disagreement).
 *   • `pending` — service_codes with a submitted / awaiting_payment order (and
 *                 the children of a pending bundle), for the "Pending" badge.
 *
 * Render-path safe: degrades to empty sets on ANY query error (a missing/legacy
 * orders table must not crash the hub) — the grid then just shows buy pills.
 * Pass an ADMIN client so a co-host who didn't place the order still sees
 * ownership (orders RLS is purchaser-scoped — same reason the About redirect
 * uses the admin client).
 */
export async function eventActiveSkus(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ active: Set<string>; pending: Set<string> }> {
  const active = new Set<string>();
  const pending = new Set<string>();

  // Comp grant bypass — populate active set from grants, then continue
  // to also pick up any real orders (so pending badges still appear).
  const grants = await fetchActiveCompGrants(supabase);
  if (grants.allServices) {
    const allSkus = [
      ...Object.keys(BUNDLE_CHILD_SKUS),
      ...Object.values(BUNDLE_CHILD_SKUS).flat(),
    ];
    for (const key of allSkus) active.add(key);
    return { active, pending };
  }
  for (const sku of grants.specificSkus) active.add(sku);

  const { data, error } = await supabase
    .from('orders')
    .select('service_key, status')
    .eq('event_id', eventId)
    .in('status', ['paid', 'fulfilled', 'submitted', 'awaiting_payment']);

  if (error || !data) return { active, pending };

  const childrenOf = (key: string): ReadonlyArray<string> =>
    (BUNDLE_CHILD_SKUS as Record<string, ReadonlyArray<string>>)[key] ?? [];

  for (const row of data) {
    const key = row.service_key as string | null;
    if (!key) continue;
    const status = (row.status as string | null) ?? '';
    if (ACTIVE_STATUSES.has(status)) {
      active.add(key);
      for (const child of childrenOf(key)) active.add(child);
    } else if (status === 'submitted' || status === 'awaiting_payment') {
      pending.add(key);
      for (const child of childrenOf(key)) pending.add(child);
    }
  }
  return { active, pending };
}
