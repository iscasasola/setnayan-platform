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
 * app/dashboard/[eventId]/add-ons/bundle/page.tsx — "no member-SKU
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
  if (await checkOrderActive(supabase, eventId, serviceKey)) return true;
  const grantingBundles = BUNDLES_GRANTING_SKU.get(serviceKey);
  if (!grantingBundles || grantingBundles.length === 0) return false;
  for (const bundleKey of grantingBundles) {
    if (await checkOrderActive(supabase, eventId, bundleKey)) return true;
  }
  return false;
}
