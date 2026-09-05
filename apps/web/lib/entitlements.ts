import type { SupabaseClient } from '@supabase/supabase-js';

import { eventBasketOrdersGranting } from '@/lib/onboarding-order-items';
import {
  isSkuFreeForCouplesNow,
  promoFreeSkusForCouples,
} from '@/lib/promo-free-windows';
import { PANOOD_PAID_SKUS } from '@/lib/panood-watermark';

/**
 * apps/web/lib/entitlements.ts
 *
 * Single source of truth for couple-SKU ownership ("does this event own a
 * paid <serviceKey> order?"). Extracted from the 5 identical eventOwns*
 * helpers (indoor-blueprint / animated-monogram / papic-seats /
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
 * are one of the four umbrella phases, so the umbrella confers them too.
 *
 * As of 2026-07-22 (owner-locked bundle restructure) EDITORIAL_PRO and
 * STD_PREMIUM_OPENINGS are BUNDLE-ONLY — their standalone catalog rows are
 * is_active=false, so COUPLE_WEBSITE_PRO (repriced ₱3,500) is the ONLY way to
 * buy them. These aliases become the sole purchase→ownership path.
 *
 * ⛔ LIVE_BACKGROUND ← ANIMATED_MONOGRAM (owner-locked 2026-07-22) is REMOVED
 * 2026-08-11. It folded the LED wall backdrop into Monogram PRO, so ₱1,000 was
 * partly payment for a backdrop nothing could render — the maker saved a draft
 * and no code path anywhere produced the 8K file or the posted USB its own
 * screens promised. Owner: "remove wall backdrop." The whole product went, so
 * there is no capability left to confer. No one loses access: zero orders had
 * ever been placed, under either key.
 *
 * ⭐ LIVE_STUDIO ← PANOOD_SYSTEM · PANOOD_SYSTEM_MOBILE (2026-07-25 · the Live
 * Studio "one controller" consolidation) — THE GRANDFATHER CLAUSE, and the reason
 * it is not optional:
 *
 * Cast (PANOOD_SYSTEM, plus the never-purchasable legacy Mobile tier
 * PANOOD_SYSTEM_MOBILE) is LIVE AND SELLING today, and its paid deliverable is the
 * multi-camera control room at
 * /studio/panood/broadcast. The unified Live Studio consolidation RETIRES that room
 * — the moment NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED flips, it redirects to
 * /studio/live-studio-control/setup, whose every paid decision (multi-cam publish,
 * paid overlays, highlight moments) reads LIVE_STUDIO. Without this alias, the flip
 * would silently downgrade every couple who ALREADY PAID for Cast to the free
 * rehearsal tier — and for most of them the thing they bought happens exactly once,
 * on a day that cannot be redone.
 *
 * Same shape as the (now-removed) LIVE_BACKGROUND fold-in: a purchase key
 * conferring the SKU its
 * capability now lives under. No migration and no backfill — ownership still IS
 * orders.status, read one extra way, so it applies to past AND in-flight Cast
 * orders and reverses cleanly if the consolidation is rolled back.
 *
 * One-directional: a LIVE_STUDIO buyer does NOT own PANOOD_SYSTEM. Deliberate —
 * the legacy Cast surfaces stay keyed to the SKU they actually sell, and the
 * retired room is unreachable behind the same flag anyway.
 *
 * KNOWN EDGE, not closed here: aliasing resolves at the ORDER-QUERY level
 * (ownershipKeysFor), while the bundle pass keys off the canonical code only. So a
 * holder of the retired MEDIA_PACK bundle — which lists PANOOD_SYSTEM as a child —
 * owns Cast but not LIVE_STUDIO. This is the SAME pre-existing shape as
 * EDITORIAL_PRO ← COUPLE_WEBSITE_PRO (itself a bundle child), and teaching the
 * bundle pass to walk aliases would change bundle behavior for SKUs that have
 * nothing to do with this flag. Both bundles were retired 2026-06-29, so the
 * population is historical; the remedy for any such event is an admin comp grant.
 *
 * INERT WHILE THE FLAG IS OFF: every reader of LIVE_STUDIO ownership sits behind
 * NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED (the controller notFound()s, its actions
 * redirect, /panood/program reads it only inside the flag branch, the public
 * loader's roam block is flag-wrapped, and the LIVE_STUDIO tile is only appended
 * to ADD_ONS behind the flag). So this entry changes nothing anyone can see until
 * the owner flips it, and then it changes exactly one thing: a Cast buyer keeps
 * what they bought.
 *
 * The pair is not re-typed here: it REUSES PANOOD_PAID_SKUS (lib/panood-watermark.ts),
 * the existing canonical "both Cast device tiers unlock the paid broadcast" list —
 * the same set resolvePanoodTier() (lib/panood-camera-seats.ts) resolves the legacy
 * room's own paid gate from. One list, so "who paid for Cast" and "who keeps it after
 * the consolidation" cannot drift apart. (panood-watermark.ts is import-free and
 * pure, so this adds no cycle to a module everything imports.)
 */
export const SKU_OWNERSHIP_ALIASES: Readonly<Record<string, ReadonlyArray<string>>> =
  Object.freeze({
    EDITORIAL_PRO: Object.freeze(['COUPLE_WEBSITE_PRO']),
    STD_PREMIUM_OPENINGS: Object.freeze(['COUPLE_WEBSITE_PRO']),
    // LIVE_BACKGROUND ← ANIMATED_MONOGRAM is GONE (owner 2026-08-11, "remove
    // wall backdrop"). It was the line that made a ₱1,000 monogram purchase
    // unlock an LED maker whose output nothing could produce. The whole
    // product is removed in this PR; there is no longer a key to alias TO.
    LIVE_STUDIO: Object.freeze([...PANOOD_PAID_SKUS]),
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
    // The Pabati video guestbook was dropped here 2026-08-21 with the product
    // itself (owner: "we do not need pabati. retire it because it is part of
    // papic"); the same PR's migration re-seeded bundle_components without it.
    // Its name is deliberately NOT quoted in this comment — a quoted token
    // inside this array literal is counted as a member by
    // lint-entitlement-gates.
    'PAPIC_ADDON_THANK_YOU',
    'LIVE_WALL',
    // The LED wall backdrop SKU was dropped here 2026-08-11 with the product
    // itself; the same PR's migration deleted its bundle_components row. Its
    // name is deliberately NOT quoted in this comment — a quoted token inside
    // this array literal is counted as a member by lint-entitlement-gates.
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
    'CAMERA_BRIDGE',
    'PAPIC_GUEST',
  ]),
  // PAPIC_UNLOCK_LTD (owner 2026-07-11) — the Ltd-tier twin at ₱9,000. Grants the
  // two still-paid Papic add-ons (Kwento/Stories are free, Thank-You/Guest
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
/**
 * Does an ONBOARDING BASKET confer `serviceKey` on this event?
 *
 * The basket is ONE order covering several products (owner 2026-08-11), so a
 * couple who bought Setnayan AI inside it has NO order whose `service_key` is
 * `SETNAYAN_AI` — the two functions below would say they do not own it, and the
 * studio would invite them to buy it a second time. Membership is per-order, so
 * it cannot ride on `bundle_components` (see lib/onboarding-order-items.ts).
 *
 * `live` picks the liveness rule of the caller: ownership counts a pending
 * `submitted` order (so a couple mid-review cannot double-buy), the ACTIVE gate
 * requires an admin-approved one. Fails CLOSED on a read error — the reader
 * returns [] — which matches every other branch here.
 */
async function basketGrantsSku(
  supabase: SupabaseClient,
  eventId: string,
  serviceKey: string,
  live: (status: string) => boolean,
): Promise<boolean> {
  const rows = await eventBasketOrdersGranting(supabase, eventId, serviceKey);
  return rows.some((r) => live(r.status));
}

/**
 * ⭐ SKUs THAT ARE FREE FOR EVERY EVENT, PERMANENTLY — owner pricing decisions,
 * not promotions.
 *
 * Checked FIRST and unconditionally in all three predicates below, so a feature
 * whose price the owner has set to zero unlocks for every couple with no order,
 * no bundle, no comp grant and no basket.
 *
 * ⚠ DO NOT CONFUSE THIS WITH A PROMO FREE WINDOW (lib/promo-free-windows.ts).
 * That mechanism is deliberately EPHEMERAL and flag-gated — "free this weekend",
 * reverting when the window closes. This one is permanent and needs no flag,
 * because it records a decision about what a product COSTS.
 *
 * 🔑 WHY THIS EXISTS AT ALL — RETIRING THE CATALOG ROW WOULD DO THE OPPOSITE.
 * Every gate on these features asks "does this event OWN the SKU?". Simply
 * setting `is_active = false` (the way a genuinely retired product is taken off
 * sale) means nobody can buy it, therefore nobody owns it, therefore the feature
 * goes DARK for everyone — the exact opposite of free. Free and retired look
 * identical in the catalog and are opposites in the product. The catalog row is
 * still deactivated alongside this, so nothing quotes a price; this set is what
 * keeps the feature switched on for everyone once it is.
 *
 * LIVE_WALL — owner 2026-08-11, verbatim: "live photo wall FREE." Both halves of
 * it are free: the venue projection AND the mirror on every guest's phone. It was
 * ₱2,500 and had never been bought by anyone.
 *
 * KWENTO — owner 2026-08-21, verbatim: "kwento is free." The words a guest
 * writes on a photo they were tagged in. It was ₱299 and had never been bought
 * by anyone (0 orders, ever). Same shape as LIVE_WALL above, deliberately: the
 * catalog row is deactivated by migration 20271156242842 so nothing quotes a
 * price, and this entry is what keeps the feature switched ON — the route that
 * accepts the message, the guest's prompt, and the couple's review queue all
 * ask `eventSkuActive('KWENTO')`.
 *
 * ⛔ PABATI IS NOT HERE, AND ITS ABSENCE IS THE DECISION — DO NOT ADD IT BACK.
 * It was added to this set on 2026-08-21 when the owner made it free, and
 * removed hours later the same day when he went further: "we do not need
 * pabati. retire it because it is part of papic." Free and retired are the
 * same catalog row and opposite products, so the retirement had to take BOTH
 * halves — the row stays deactivated AND this entry is gone. Its surface, API,
 * table and RPCs are deleted; a free entry for a SKU nothing implements would
 * switch on a feature that no longer exists. The capability survives as an
 * ordinary Papic clip challenge.
 *
 * EDITORIAL_PRO — owner 2026-08-23, asked what it would cost us to leave the
 * couple's own story editable: *"keep it free if this costs us nothing."*
 *
 * 🔑 IT COSTS NOTHING, MEASURED. Every perk behind the PRO chip on that editor
 * is a PRESENTATION CONTROL over data the couple already owns — reordering
 * their rows and sections, naming their own moments, choosing which of their
 * guests' wishes to feature. They are `disabled` attributes on buttons: no
 * render, no storage, no external call, zero marginal cost. By his own rule
 * they go free.
 *
 * ⚠ AND THE HALF-SPRUNG TRAP WAS ALREADY IN PLACE. The à-la-carte row has been
 * `is_active = false` in production with ZERO orders ever, and nothing switched
 * the feature on — so the perks were DARK for everyone who had not bought the
 * ₱3,500 umbrella. That is precisely "free and retired are the same row and
 * opposite products", caught one step in. This entry is the other half.
 *
 * 🔒 SCOPE, AND IT IS NARROW BY CONSTRUCTION. This key has exactly THREE
 * readers — the buy surface, the editor's `isPro`, and `saveEditorial`'s
 * server-side re-check — all through `isEditorialProActive`. Every OTHER Event
 * Hub PRO perk, the no-watermark included, gates on `eventCoupleWebsiteProActive`
 * reading COUPLE_WEBSITE_PRO, which is untouched and still sells at ₱3,500.
 * ⛔ Do not "tidy" the two helpers into one: that would hand the watermark away.
 *
 * ⏭ AND ONE QUESTION IS DELIBERATELY LEFT OPEN, NOT ANSWERED HERE. Event Hub
 * PRO still advertises Editorial PRO authoring as one of the things it buys.
 * Whether that upgrade should now say something different is a pricing call and
 * the owner's alone; the sentences that would otherwise have become FALSE are
 * corrected, and nothing about the umbrella's price or scope is changed.
 *
 * ⛔ THE SHOT LADDER IS NOT IN THIS SET AND MUST NOT JOIN IT. Papic FEATURES are
 * free; Papic SHOTS are the product — 50 free, then ₱50 / ₱1,000 / ₱3,000 /
 * ₱5,000, owner-locked. Same for PAPIC_ADDON_THANK_YOU: the produced video is
 * the thing that gets monetised.
 */
export const FREE_FOR_ALL_SKUS: ReadonlySet<string> = Object.freeze(
  // SEATING_3D — the 3D Plan — FREE for couples (owner 2026-09-05). Measured
  // before the decision: the ₱1,500 gated NOTHING at any layer (the
  // public_venue_scene RPC, /[slug]/venue, publishSeating, the lab) and had zero
  // orders in its history. The couple's published room is the shelf a vendor
  // pays to be branded on (vendor_3d_booth · per-event or per-cycle), so
  // charging the couple taxed the inventory the vendor add-on sells into. What
  // still costs money INSIDE the room keeps its price: the animated monogram,
  // mood-board renders, Papic — only the room itself is free.
  new Set(['LIVE_WALL', 'KWENTO', 'EDITORIAL_PRO', 'SEATING_3D']),
) as ReadonlySet<string>;

export async function eventOwnsSku(
  supabase: SupabaseClient,
  eventId: string,
  serviceKey: string,
): Promise<boolean> {
  // 0. Free for everyone — an owner pricing decision. No order to find.
  if (FREE_FOR_ALL_SKUS.has(serviceKey)) return true;

  // 1. Direct order for the SKU (covers à-la-carte purchase AND a bundle code
  //    passed directly).
  if (await checkOrderOwnership(supabase, eventId, serviceKey)) return true;

  // 2. Any bundle that includes this child SKU, owned by the event. Composition
  //    is read DB-first from bundle_components (const fallback pre-migration).
  const composition = await fetchBundleComponents(supabase);
  for (const bundleKey of bundlesGrantingSku(composition, serviceKey)) {
    if (await checkOrderOwnership(supabase, eventId, bundleKey)) return true;
  }

  // 2b. An ONBOARDING BASKET that includes this SKU. Same intent as the bundle
  //     pass above, but membership is per-ORDER rather than per-SKU-code, so it
  //     cannot be expressed through bundle_components. Ownership counts a
  //     pending order, so a couple whose basket is still being reconciled is not
  //     invited to buy the same thing twice.
  if (
    await basketGrantsSku(
      supabase,
      eventId,
      serviceKey,
      (status) => !RELINQUISHED_STATUSES.has(status),
    )
  ) {
    return true;
  }

  // 3. Admin comp grant — a host of this event was gifted free access covering
  //    this SKU (all_services or specific_skus). Host-scoped server-side so it
  //    never leaks across accounts. Checked last: it's the rare path.
  if (await eventHasCompGrant(supabase, eventId, serviceKey)) return true;

  // 4. Promo free window — a live admin announcement makes this SKU free for all
  //    couples right now. Treat it as OWNED so buy surfaces hide the purchase CTA
  //    (a couple must never be charged for something that is free this moment).
  //    Ephemeral + flag-guarded (empty set / short-circuit when off) — see
  //    eventSkuActive + lib/promo-free-windows.ts.
  if (await isSkuFreeForCouplesNow(serviceKey)) return true;

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
  // Free for everyone — see FREE_FOR_ALL_SKUS. Checked before the order read so
  // a free feature never depends on a payment that will never exist.
  if (FREE_FOR_ALL_SKUS.has(serviceKey)) return true;

  if (await checkOrderActive(supabase, eventId, serviceKey)) return true;
  // Composition DB-first from bundle_components (const fallback pre-migration).
  const composition = await fetchBundleComponents(supabase);
  for (const bundleKey of bundlesGrantingSku(composition, serviceKey)) {
    if (await checkOrderActive(supabase, eventId, bundleKey)) return true;
  }

  // An ONBOARDING BASKET that includes this SKU, ADMIN-APPROVED. Feature gates
  // call this one, so the rule is stricter than eventOwnsSku's: a basket still
  // awaiting reconciliation confers nothing, exactly like every other order.
  if (await basketGrantsSku(supabase, eventId, serviceKey, (s) => ACTIVE_STATUSES.has(s))) {
    return true;
  }

  // Promo free window — a live admin announcement (PROMO_FREE_WINDOWS_ENABLED)
  // makes this SKU free for ALL couples during its date range, exactly like a
  // comp grant but audience-wide + ephemeral (reverts when the window closes).
  // The audience is global, so there is no per-event scoping to resolve. Reads
  // short-circuit to an empty set when the flag is off, so this is byte-identical
  // to today until the owner turns a promo on. See lib/promo-free-windows.ts.
  if (await isSkuFreeForCouplesNow(serviceKey)) return true;

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

  // Free for everyone — see FREE_FOR_ALL_SKUS. Seeded before anything else so the
  // Studio/Suite owned-state badges agree with the feature gates; a surface that
  // renders the wall while its badge still says "buy" is the drift this avoids.
  for (const key of FREE_FOR_ALL_SKUS) active.add(key);

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

  // Promo free windows — union every SKU currently free for all couples via a
  // live admin announcement into `active` (a promo unlock is on, never pending),
  // so the Studio grid renders it as owned/included. Empty set + short-circuit
  // when PROMO_FREE_WINDOWS_ENABLED is off. See lib/promo-free-windows.ts.
  for (const sku of await promoFreeSkusForCouples()) {
    active.add(sku);
  }

  return { active, pending };
}
