import type { SupabaseClient } from '@supabase/supabase-js';

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

/**
 * Comp-grant gate (admin "Issue a comp grant" → app/admin/users/actions.ts).
 *
 * A comp grant gifts a user free in-app access. It is USER-scoped, but feature
 * gates are EVENT-scoped, so the mapping (event → host users → their active
 * grants) lives in the SECURITY DEFINER fn event_has_comp_for_sku() — see
 * migration 20270322000000. Resolving host-scoping server-side is what makes
 * this safe under the service-role admin client the gates routinely use: a bare
 * client-side comp_grants read would see EVERY grant in the DB and leak access
 * across accounts (the never-merged owner-all-services-grant branch's bug).
 *
 * Honors both scopes — 'all_services' and 'specific_skus' (containing the SKU) —
 * and respects revoked_at + expiry. Graceful-degrade to false on ANY RPC error
 * (pre-migration: PostgREST PGRST202 "function not found"), matching the
 * order-helper contract so a missing function never throws at a gate.
 */
export async function eventHasCompGrant(
  supabase: SupabaseClient,
  eventId: string,
  serviceKey: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('event_has_comp_for_sku', {
    p_event_id: eventId,
    p_service_key: serviceKey,
  });
  if (error) return false;
  return data === true;
}

/**
 * Does an internal (§10a) account HOST this event?
 *
 * Internal accounts are the Setnayan team/owner accounts; their showcase & demo
 * events (e.g. "Cale & Ice") are meant to display fully. The admin comp form even
 * BLOCKS per-SKU comps on internal accounts because they "already carry a
 * permanent grant" — but nothing conferred that grant on the RENDER, so an
 * internal host who never placed an order rendered as owning nothing (the
 * Save-the-Date film stripped its own music/video/gallery on the owner's own
 * wedding). eventSkuActive() ORs this in so an internal-hosted event owns any SKU.
 *
 * Host-scoped server-side in the SECURITY DEFINER fn event_host_is_internal()
 * (migration 20270806100000), mirroring event_has_comp_for_sku so a service-role
 * admin-client call never leaks internal status across accounts. Graceful-degrade
 * to false on ANY RPC error (pre-migration PGRST202), matching the
 * eventHasCompGrant contract so a missing function never throws at a gate.
 */
export async function eventHostIsInternal(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('event_host_is_internal', {
    p_event_id: eventId,
  });
  if (error) return false;
  return data === true;
}

/**
 * Does a FOUNDER-SEAT holder host this event?
 *
 * Founder seats (owner-locked 2026-07-16 · migration 20270818135217) are up to
 * 10 owner-granted platform-founder accounts — Ice + Cale first — whose events
 * have "all features already paid for". Deliberately a SEPARATE designation
 * from is_internal (§10a): internal is the team/ops flag and may later cover
 * non-founder staff, while the vendor-facing "founder of the app" claim must
 * only ever be true for owner-granted seats. eventSkuActive() ORs this in,
 * and the vendor thread badge + inquiry notification read it as the
 * server-asserted (impersonation-proof) founder signal.
 *
 * Same host-scoping + graceful-degrade contract as eventHostIsInternal (the
 * SECURITY DEFINER fn event_host_holds_founder_seat mirrors
 * event_host_is_internal's host definition exactly).
 */
export async function eventHostHoldsFounderSeat(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('event_host_holds_founder_seat', {
    p_event_id: eventId,
  });
  if (error) return false;
  return data === true;
}

/**
 * Batch companion to eventHasCompGrant — every SKU the event's host comp grants
 * cover. all_services → the full live catalog; specific_skus → just those codes.
 * Empty array on no comp / any error. See migration 20270322000000.
 */
export async function eventCompActiveSkus(
  supabase: SupabaseClient,
  eventId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc('event_comp_active_skus', {
    p_event_id: eventId,
  });
  if (error || !Array.isArray(data)) return [];
  return data.filter((s): s is string => typeof s === 'string');
}

/**
 * Ownership ALIASES — purchase-time service_keys that confer the SAME ownership
 * as a canonical catalog SKU.
 *
 * WHY: a feature can be SOLD under a different service_key than the one its
 * gates read. The map closes that on the READ side: an order under any alias key
 * grants its canonical SKU. No migration, no price change — ownership still IS
 * orders.status, read one extra way (mirrors the bundle-aware read in
 * eventOwnsSku).
 *
 * Keyed by CANONICAL service_key → the alternate purchase keys that grant it.
 *
 * (Patiktok — the original live case for this map — was RETIRED 2026-06-29, so
 * its alias entry was removed.)
 *
 * EDITORIAL_PRO ← COUPLE_WEBSITE_PRO (owner-locked 2026-07-04) · the UMBRELLA.
 * Couple Website PRO (₱4,999) is the one upgrade that unlocks the pro touches
 * across the whole site lifecycle — Save the Date, RSVP, on-the-day, AND the
 * Editorial front page. The new à-la-carte EDITORIAL_PRO (₱3,499) is the
 * standalone way to buy JUST the editorial authoring perk. So an order placed
 * under COUPLE_WEBSITE_PRO must ALSO confer EDITORIAL_PRO ownership: a couple
 * who bought the umbrella never needs to buy Editorial PRO separately. This is
 * the exact purchase-key→canonical bridge the alias map exists for — no new
 * framework, and it can't be expressed via BUNDLE_CHILD_SKUS because
 * COUPLE_WEBSITE_PRO is itself a CHILD of GUIDED_PACK/MEDIA_PACK and the
 * bundle-map linter (GUARD 2) forbids a bundle code nesting as a child.
 *
 * STD_PREMIUM_OPENINGS ← COUPLE_WEBSITE_PRO (owner confirmation 2026-07-04:
 * "Couple Website pro unlocks all pro features for the website, Save the date,
 * rsvp, event(on the day), editorial") — the Save-the-Date cinematic openings
 * are one of the four umbrella phases, so the umbrella confers them too. The
 * openings stay purchasable à la carte at their own catalog price; this only
 * adds the read-side grant.
 */
export const SKU_OWNERSHIP_ALIASES: Readonly<Record<string, ReadonlyArray<string>>> =
  Object.freeze({
    EDITORIAL_PRO: Object.freeze(['COUPLE_WEBSITE_PRO']),
    STD_PREMIUM_OPENINGS: Object.freeze(['COUPLE_WEBSITE_PRO']),
  });

/**
 * Every service_key that confers ownership of `serviceKey` — the canonical key
 * itself plus any purchase-time aliases. Used so a single ownership query
 * matches an order placed under the SKU directly OR under an alias key.
 */
function ownershipKeysFor(serviceKey: string): string[] {
  const aliases = SKU_OWNERSHIP_ALIASES[serviceKey];
  return aliases ? [serviceKey, ...aliases] : [serviceKey];
}

export async function checkOrderOwnership(
  supabase: SupabaseClient,
  eventId: string,
  serviceKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('event_id', eventId)
    .in('service_key', ownershipKeysFor(serviceKey))
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
    .in('service_key', ownershipKeysFor(serviceKey))
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
 * ── SINGLE SOURCE OF TRUTH (Entity Map & Hardcode Audit 2026-07-04 · Violation
 * #2) ──────────────────────────────────────────────────────────────────────
 * Bundle composition now lives in ONE place: the public.bundle_components table
 * (migration 20270511379088), which the DB fn public.bundles_granting_sku() also
 * reads. The entitlement gates read that table DB-first via
 * fetchBundleComponents() below, and THIS const is the graceful-degrade
 * FALLBACK — used only when the table isn't queryable yet (pre-migration deploy
 * window / a schema-drift error), so the app never mis-gates before the table
 * lands. When the table IS present it is authoritative; this const does not need
 * to be edited for a composition change once the table exists (an admin edits
 * the table). It is kept in sync as a safety net and is asserted equal to the
 * migration seed by lint:entitlement-gates GUARD 2.
 *
 * Keyed by BUNDLE service_key → the child catalog service_codes it grants.
 */

/**
 * Bundle composition shape — a plain map of bundle service_key → its child
 * service_codes. Both the DB-first read (fetchBundleComponents) and the const
 * fallback (BUNDLE_CHILD_SKUS) produce this shape, so the pure resolvers below
 * work identically on either source. Data-driven (any bundle key), since the
 * authoritative source is now the admin-editable public.bundle_components table.
 */
export type BundleComposition = Readonly<Record<string, ReadonlyArray<string>>>;

// Concrete literal type preserved (not widened to BundleComposition) so existing
// consumers that index it by a named key (add-on-state / sku-activation) keep
// their exact `ReadonlyArray<string>` element type under noUncheckedIndexedAccess.
// It still structurally satisfies BundleComposition wherever the generic shape
// is expected (the pure resolvers + fetchBundleComponents fallback).
export const BUNDLE_CHILD_SKUS = Object.freeze({
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
  // Complete — the canonical paid SKUs (BUNDLE_MEMBERS.complete). Includes
  // every crew-delivered media child (LIVE_WALL, PANOOD_SYSTEM, …) that
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
    'PAPIC_ADDON_THANK_YOU',
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
  // unlimited regardless). The DB-side bundles_granting_sku() mirror for
  // PAPIC_UNLOCK — once deferred, and the source of a DB↔app disagreement on
  // PAPIC_GUEST — is now RESOLVED: migration 20270511379088 seeds bundle_components
  // with this exact 7-child list (PAPIC_GUEST INCLUDED), and the DB fn reads it.
  PAPIC_UNLOCK: Object.freeze([
    'KWENTO',
    'LIVE_WALL',
    'PAPIC_ADDON_THANK_YOU',
    'PAPIC_ADDON_STORIES',
    'PABATI',
    'CAMERA_BRIDGE',
    'PAPIC_GUEST',
  ]),
  // PAPIC_UNLOCK_LTD (owner 2026-07-11) — the Ltd-tier twin at ₱9,000. Grants the
  // two still-paid Papic add-ons (Kwento/Pabati/Stories are free, Thank-You/Guest
  // retired). The Ltd capture-free itself is a separate gate (eventLtdFreeViaUnlock
  // in papic-cameras.ts), not a child SKU. DB source: bundle_components table.
  PAPIC_UNLOCK_LTD: Object.freeze(['LIVE_WALL', 'CAMERA_BRIDGE']),
});

// ===========================================================================
// Pure composition-resolution logic — operates on a BundleComposition map, with
// NO I/O, so it's exhaustively unit-testable (entitlements.test.ts) and is the
// single implementation both the DB-read path and the const-fallback path use.
// ===========================================================================

/**
 * Build the reverse index of a composition map: child service_code → the bundle
 * service_keys that grant it. Sorted for determinism. Pure.
 */
export function buildBundlesGrantingIndex(
  composition: BundleComposition,
): ReadonlyMap<string, ReadonlyArray<string>> {
  const m = new Map<string, string[]>();
  for (const [bundleKey, children] of Object.entries(composition)) {
    for (const child of children) {
      const list = m.get(child) ?? [];
      list.push(bundleKey);
      m.set(child, list);
    }
  }
  // Deterministic order so callers (and tests) see a stable result regardless of
  // row/key iteration order (the DB reader can return rows in any order).
  for (const [child, bundles] of m) m.set(child, [...bundles].sort());
  return m;
}

/**
 * The bundle service_keys that grant `child`, resolved against a composition
 * map. Empty array (never undefined) when no bundle includes it. Pure — this is
 * the app mirror of the DB fn public.bundles_granting_sku(child).
 */
export function bundlesGrantingSku(
  composition: BundleComposition,
  child: string,
): ReadonlyArray<string> {
  return buildBundlesGrantingIndex(composition).get(child) ?? [];
}

/** The child service_codes a given bundle grants, or [] if not a known bundle. Pure. */
export function childrenOfBundle(
  composition: BundleComposition,
  bundleKey: string,
): ReadonlyArray<string> {
  return composition[bundleKey] ?? [];
}

/**
 * DB-FIRST read of bundle composition from public.bundle_components (the single
 * source of truth · migration 20270511379088), with the BUNDLE_CHILD_SKUS const
 * as the graceful-degrade FALLBACK. The house DB-first + const-fallback pattern.
 *
 * Returns the const fallback (never throws) when:
 *   • the table doesn't exist yet — 42P01 (deploy-order safety: the code ships
 *     BEFORE the migration applies, and must gate correctly in that window);
 *   • any read error / empty result — a transient failure or an unseeded table
 *     must not silently strip every bundle child of its entitlement.
 * Otherwise the table is authoritative — a live row set (even one that differs
 * from the const) wins, so an admin composition edit takes effect without a
 * code change.
 *
 * Uses whatever client the caller already passes — the table's RLS grants a
 * public SELECT (USING true), so anon / authenticated / admin all read it.
 */
export async function fetchBundleComponents(
  supabase: SupabaseClient,
): Promise<BundleComposition> {
  const { data, error } = await supabase
    .from('bundle_components')
    .select('bundle_sku_code, component_service_code');

  // Pre-migration / drift / any error → const fallback. Never throw at a gate.
  if (error || !data || data.length === 0) return BUNDLE_CHILD_SKUS;

  const out: Record<string, string[]> = {};
  for (const row of data) {
    const bundle = row.bundle_sku_code as string | null;
    const child = row.component_service_code as string | null;
    if (!bundle || !child) continue;
    (out[bundle] ??= []).push(child);
  }
  // A well-formed but somehow-childless result → fallback (defense-in-depth).
  if (Object.keys(out).length === 0) return BUNDLE_CHILD_SKUS;
  return out;
}

/**
 * Reverse index: alias purchase key → ALL the CANONICAL service_keys it grants.
 * Built once from SKU_OWNERSHIP_ALIASES so the batch reader (eventActiveSkus)
 * can collapse an alias order key to the canonical SKU(s) the Studio grid +
 * add-on catalog read. MULTI-valued because one purchase key can confer several
 * canonicals — COUPLE_WEBSITE_PRO (the website umbrella) grants BOTH
 * EDITORIAL_PRO and STD_PREMIUM_OPENINGS; a single-valued map would let the
 * second Map.set() silently overwrite the first grant.
 */
const CANONICALS_FOR_ALIAS: ReadonlyMap<string, ReadonlyArray<string>> = (() => {
  const m = new Map<string, string[]>();
  for (const [canonical, aliases] of Object.entries(SKU_OWNERSHIP_ALIASES)) {
    for (const alias of aliases) {
      const list = m.get(alias) ?? [];
      list.push(canonical);
      m.set(alias, list);
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
  // 1. Direct order for the SKU (covers à-la-carte purchase AND a bundle code
  //    passed directly).
  if (await checkOrderOwnership(supabase, eventId, serviceKey)) return true;

  // 2. Any bundle that includes this child SKU, owned by the event. Composition
  //    is read DB-first from bundle_components (const fallback pre-migration).
  const composition = await fetchBundleComponents(supabase);
  for (const bundleKey of bundlesGrantingSku(composition, serviceKey)) {
    if (await checkOrderOwnership(supabase, eventId, bundleKey)) return true;
  }

  // 3. Admin comp grant — a host of this event was gifted free access covering
  //    this SKU (all_services or specific_skus). Host-scoped server-side so it
  //    never leaks across accounts. Checked last: it's the rare path.
  if (await eventHasCompGrant(supabase, eventId, serviceKey)) return true;

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
  if (await checkOrderActive(supabase, eventId, serviceKey)) return true;
  // Composition DB-first from bundle_components (const fallback pre-migration).
  const composition = await fetchBundleComponents(supabase);
  for (const bundleKey of bundlesGrantingSku(composition, serviceKey)) {
    if (await checkOrderActive(supabase, eventId, bundleKey)) return true;
  }

  // Admin comp grant — bypass the handshake gate too (a gifted feature is
  // unlocked immediately; there's no payment to verify). Host-scoped server-side.
  if (await eventHasCompGrant(supabase, eventId, serviceKey)) return true;

  // §10a internal-hosted events own EVERY SKU on the render — the Setnayan
  // team/owner's showcase & demo events display fully without a per-event order
  // or comp (the intended "internal carries a permanent grant"; the comp form
  // blocks per-SKU comps on internal accounts for this exact reason). See
  // migration 20270806100000. Checked LAST so the common external-couple path
  // pays for one extra RPC only when nothing else already granted the SKU.
  if (await eventHostIsInternal(supabase, eventId)) return true;

  // Founder-seat-hosted events likewise own EVERY SKU — "all features are
  // already paid for" on every owner-granted founder seat (owner-locked
  // 2026-07-16 · migration 20270818135217). Same last-position reasoning.
  if (await eventHostHoldsFounderSeat(supabase, eventId)) return true;

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

  // Composition DB-first from bundle_components (const fallback pre-migration),
  // fetched once for the whole batch.
  const composition = await fetchBundleComponents(supabase);

  const { data, error } = await supabase
    .from('orders')
    .select('service_key, status')
    .eq('event_id', eventId)
    .in('status', ['paid', 'fulfilled', 'submitted', 'awaiting_payment']);

  const childrenOf = (key: string): ReadonlyArray<string> =>
    childrenOfBundle(composition, key);

  // Populate from orders when available. A missing/legacy orders table must not
  // crash the hub — but it also must NOT skip the comp union below, so we guard
  // the loop instead of early-returning.
  if (!error && data) {
    for (const row of data) {
      const rawKey = row.service_key as string | null;
      if (!rawKey) continue;
      const status = (row.status as string | null) ?? '';
      // Collapse an alias purchase key to its canonical SKU(s) so a buyer
      // reads as owning the canonical SKU (the key the Studio grid + add-on
      // catalog gate on). Multi-valued: the COUPLE_WEBSITE_PRO umbrella confers
      // both EDITORIAL_PRO and STD_PREMIUM_OPENINGS. Keep the raw key too —
      // some surfaces read the purchase code directly.
      const canonicals = CANONICALS_FOR_ALIAS.get(rawKey);
      const keys = canonicals ? [rawKey, ...canonicals] : [rawKey];
      if (ACTIVE_STATUSES.has(status)) {
        for (const key of keys) {
          active.add(key);
          for (const child of childrenOf(key)) active.add(child);
        }
      } else if (status === 'submitted' || status === 'awaiting_payment') {
        for (const key of keys) {
          pending.add(key);
          for (const child of childrenOf(key)) pending.add(child);
        }
      }
    }
  }

  // Admin comp grants — union every comped SKU into `active` (a gift is unlocked,
  // never "pending"). all_services → the full live catalog; specific_skus → just
  // those codes. Host-scoped server-side (event_comp_active_skus), so it never
  // leaks across accounts. Graceful-degrade to [] pre-migration.
  for (const sku of await eventCompActiveSkus(supabase, eventId)) {
    active.add(sku);
  }

  return { active, pending };
}
