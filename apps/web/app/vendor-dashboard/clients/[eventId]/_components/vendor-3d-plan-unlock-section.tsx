// 3D Plan unlock — the VENDOR panel on a booked event (owner 2026-07-22). A
// booked vendor with an ACTIVE 3D Booth add-on unlocks the DISCOUNTED ₱1,000
// SEATING_3D for their couple (usually ₱2,999); the couple then buys + publishes
// it themselves. FREE + unlimited (the ₱1,500/28d 3D Booth add-on is the charge).
// Async SERVER component — self-fetches the vendor's booth-addon window + the
// event's unlock state + the standard SEATING_3D price, so it adds nothing to the
// host page's data-load. Mounted after VendorChallengeSection on the client-event
// card (booked-only; the host page gates it behind isBooked).

import { Boxes, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import {
  fetchVendor3dBoothState,
  isVendor3dBoothActive,
} from '@/lib/vendor-3d-booth-pricing';
import {
  VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY,
  VENDOR_3D_PLAN_UNLOCK_PRICE_PHP,
  vendor3dPlanUnlockEligibility,
  eventHasVendor3dPlanUnlock,
  VENDOR_3D_PLAN_UNLOCK_DENY_MESSAGE,
} from '@/lib/vendor-3d-plan-unlock';
import { Vendor3dPlanUnlockButton } from './vendor-3d-plan-unlock-button';

const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

export async function Vendor3dPlanUnlockSection({
  eventId,
  vendorProfileId,
}: {
  eventId: string;
  vendorProfileId: string;
}) {
  const supabase = await createClient();
  const admin = createAdminClient();

  // Booked is implied by mount (the host page gates this behind isBooked).
  const [boothState, unlocked, standardSku] = await Promise.all([
    fetchVendor3dBoothState(supabase, vendorProfileId),
    eventHasVendor3dPlanUnlock(admin, eventId),
    formatV2Sku(VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY).catch(() => null),
  ]);

  const boothAddonActive = isVendor3dBoothActive(boothState.expiresAt);
  const standardPhp = standardSku?.price_php ?? null;

  // The same pure gate the unlock action enforces (booked is implied by mount).
  const eligibility = vendor3dPlanUnlockEligibility({
    boothAddonActive,
    booked: true,
    alreadyUnlocked: unlocked,
  });

  const savingsCopy =
    standardPhp != null && standardPhp > VENDOR_3D_PLAN_UNLOCK_PRICE_PHP
      ? `${peso(VENDOR_3D_PLAN_UNLOCK_PRICE_PHP)} for your couple — usually ${peso(standardPhp)}.`
      : `${peso(VENDOR_3D_PLAN_UNLOCK_PRICE_PHP)} for your couple.`;

  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Boxes aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        3D Plan unlock
        {unlocked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 text-[11px] font-semibold text-terracotta">
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Unlocked
          </span>
        ) : null}
      </h3>
      <p className="mt-1 text-xs text-ink/55">
        Give this couple a walk-through 3D seating plan of their reception — the same
        room your booth lives in. Included with your 3D Booth add-on: unlock it and
        they can add the 3D Plan at a discount, then publish it themselves.
      </p>

      {unlocked ? (
        // Already unlocked → the couple can buy at the discounted price.
        <p className="mt-4 rounded-lg border border-mulberry/20 bg-mulberry/[0.05] px-3 py-2.5 text-xs text-ink/75">
          You’ve unlocked the discounted 3D Plan for this couple — they can add it for{' '}
          <span className="font-semibold">{savingsCopy}</span> from their dashboard, and
          they stay in control of what they publish.
        </p>
      ) : eligibility.ok ? (
        // Active add-on + booked → the unlock CTA.
        <>
          <p className="mt-4 text-sm font-medium text-ink">
            Unlock the 3D Plan — <span className="font-semibold">{savingsCopy}</span>
          </p>
          <Vendor3dPlanUnlockButton eventId={eventId} />
        </>
      ) : (
        // Not eligible → the honest reason (here: no active 3D Booth add-on).
        <p className="mt-4 rounded-lg border border-mulberry/20 bg-mulberry/[0.05] px-3 py-2.5 text-xs text-ink/70">
          {VENDOR_3D_PLAN_UNLOCK_DENY_MESSAGE[eligibility.reason]}
        </p>
      )}
    </section>
  );
}
