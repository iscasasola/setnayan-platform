// Couple-facing "Add the 3D Plan" buy CTA (GAP 2 · 2026-07-22). Lets a couple
// purchase the 3D Plan (SEATING_3D) through the SAME apply-then-pay checkout
// every couple SKU uses — InlineCheckoutDrawer → submitOrderAction. The SERVER
// price resolver (lib/v2-catalog.ts resolvePaxPricedOrderCentavos) charges
// ₱1,000 when a booked vendor with an active 3D Booth add-on has unlocked it for
// this event, else the standard ₱2,999 — so this button both DISPLAYS and CHARGES
// the right price automatically, and a tampered client price still can't beat it
// (the action re-resolves server-side). The vendor-credit line ("unlocked by
// <vendor>") is the sibling Couple3dPlanUnlockNotice; this component is only the
// purchase.
//
// Ownership-aware (mirrors app/dashboard/[eventId]/studio/website-pro/page.tsx):
//   • active (admin-approved)  → a slim "unlocked" confirmation, no drawer.
//   • owned but pending review → "payment under review", no second drawer.
//   • not owned                → the working buy drawer.
// Self-fetches + degrades to null on any read failure so it never blanks the lab.

import { CheckCircle2, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { eventOwnsSku, eventSkuActive } from '@/lib/entitlements';
import { resolvePaxPricedOrderCentavos } from '@/lib/v2-catalog';
import { VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY } from '@/lib/vendor-3d-plan-unlock';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

const peso = (centavos: number) =>
  '₱' + (centavos / 100).toLocaleString('en-PH', { maximumFractionDigits: 0 });

export async function Couple3dPlanBuy({ eventId }: { eventId: string }) {
  // Admin client: orders are purchaser-scoped under RLS — an admin read lets a
  // co-host see the owned/active state too (same reasoning as website-pro).
  // Guard its construction so a CI build with no service-role key degrades to
  // nothing rather than throwing.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  // active — admin-approved (feature unlocked). owned — owned INCLUDING a
  // pending 'submitted' order (double-buy prevention). owned && !active ⇒
  // payment under review. price — discount-aware (₱1,000 unlocked · else ₱2,999).
  const [active, owned, priced] = await Promise.all([
    eventSkuActive(admin, eventId, VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY).catch(() => false),
    eventOwnsSku(admin, eventId, VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY).catch(() => false),
    resolvePaxPricedOrderCentavos(eventId, VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY).catch(() => null),
  ]);

  // ── Already unlocked → a slim confirmation (the lab is already open above). ──
  if (active) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-success-200 bg-success-50 px-3.5 py-2.5 text-xs text-success-900">
        <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
        <p>
          The 3D Plan is unlocked for your celebration — publish and share it whenever
          you&rsquo;re ready.
        </p>
      </div>
    );
  }

  // ── Owned but pending admin approval → no second drawer. ──
  if (owned) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-mulberry/20 bg-mulberry/[0.05] px-3.5 py-2.5 text-xs text-ink/75">
        <Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-mulberry" strokeWidth={1.75} />
        <p>
          Your 3D Plan order is in — we reconcile within one business day, and it unlocks
          automatically once your payment is confirmed.
        </p>
      </div>
    );
  }

  const priceCentavos = priced?.centavos ?? null;
  // No authoritative price (e.g. no service-role key in this environment) → render
  // nothing rather than a buy button that can't quote a real price.
  if (priceCentavos == null) return null;

  const supabase = await createClient();
  const settings = await fetchPlatformSettings(supabase);

  return (
    <div className="rounded-xl border border-mulberry/20 bg-mulberry/[0.04] px-3.5 py-3">
      <p className="text-sm font-semibold text-ink">Add the 3D Plan — {peso(priceCentavos)}</p>
      <p className="mt-0.5 text-xs text-ink/65">
        Turn your seating chart into a navigable 3D walk of your reception that you can publish
        and share with your guests. You choose what to publish.
      </p>
      <div className="mt-3">
        <InlineCheckoutDrawer
          serviceKey={VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY}
          displayName="3D Plan"
          originalPriceCentavos={String(priceCentavos)}
          eventId={eventId}
          settings={settings}
          triggerLabel="Add the 3D Plan"
        />
      </div>
    </div>
  );
}
