// "Brand your booth at THIS wedding" — the ₱500 per-event 3D Booth (owner
// 2026-09-05: "500 per event. or 3000/4 week cycle."). The per-event door
// stands where the retired "unlock the 3D Plan for this couple" section stood:
// the couple's room is free now, and what a vendor buys for it is BRANDING.
//
// Async SERVER component, self-fetching like VendorChallengeSection: tier +
// verification + the cycle window (session client — the shop's own row), the
// per-event order state (ADMIN client — a teammate's order has a different
// user_id and orders_owner_read would hide it), and the live price. Mounted
// booked-only by the client-event card. Renders null only when 3D is switched
// off — every other state is drawn, including the ones that cannot buy, because
// a vendor who cannot see WHY they are generic will assume the product is broken.
import Link from 'next/link';
import { Store, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { seating3dEnabled } from '@/lib/seating-3d-flag';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { BOOTH_BRANDING_MIN_TIER } from '@/lib/seating-3d';
import { isVendor3dBoothActive, fetchVendor3dBoothPricePhp } from '@/lib/vendor-3d-booth-pricing';
import {
  fetchVendor3dBoothEventPricePhp,
  fetchVendorBoothEventOrderState,
} from '@/lib/vendor-3d-booth-event-pricing';
import { ShopCard } from '../../../_components/kit';
import { BoothEventBuyForm } from './booth-event-buy-form';

function peso(n: number): string {
  return `₱${n.toLocaleString('en-PH')}`;
}

export async function BoothEventSection({
  eventId,
  vendorProfileId,
}: {
  eventId: string;
  vendorProfileId: string;
}) {
  if (!seating3dEnabled()) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  const [gateRow, orderState, eventPricePhp, cyclePricePhp] = await Promise.all([
    supabase
      .from('vendor_profiles')
      .select('tier_state, verification_state, booth_addon_expires_at')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle()
      .then((r) => r.data as {
        tier_state?: string | null;
        verification_state?: string | null;
        booth_addon_expires_at?: string | null;
      } | null),
    fetchVendorBoothEventOrderState(admin, vendorProfileId, eventId),
    fetchVendor3dBoothEventPricePhp(supabase),
    fetchVendor3dBoothPricePhp(supabase),
  ]);

  const tierOk = isTierAtLeast(gateRow?.tier_state ?? null, BOOTH_BRANDING_MIN_TIER);
  const verified = gateRow?.verification_state === 'verified';
  const cycleActive = isVendor3dBoothActive(gateRow?.booth_addon_expires_at ?? null);
  const cycleUntil = gateRow?.booth_addon_expires_at
    ? new Date(gateRow.booth_addon_expires_at).toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })
    : null;
  const branded = cycleActive || orderState === 'active';

  return (
    <ShopCard pad="roomy">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Store aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Your booth in their 3D Plan
        {branded ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 text-[11px] font-semibold text-terracotta-700">
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Branded
          </span>
        ) : null}
      </h3>

      {cycleActive ? (
        <p className="mt-1 text-xs text-ink/55">
          Your 3D Booth cycle covers this celebration{cycleUntil ? ` until ${cycleUntil}` : ''} — logo and
          poster are on in the couple&rsquo;s room. Nothing more to buy here.
        </p>
      ) : orderState === 'active' ? (
        <p className="mt-1 text-xs text-ink/55">
          Branded at this celebration — your logo and poster stay in the couple&rsquo;s room for as long as
          they keep it up. One-time; nothing renews.
        </p>
      ) : orderState === 'pending' ? (
        <p className="mt-1 text-xs text-ink/55">
          Payment under review. Your booth brands the moment it&rsquo;s confirmed — usually within 24 hours.
        </p>
      ) : !tierOk ? (
        <p className="mt-1 text-xs text-ink/55">
          Right now the couple sees a plain booth with your name. Branding it — your logo and poster — comes
          with a paid plan (Solo, Pro, Enterprise or Custom).{' '}
          <Link href="/vendor-dashboard/subscription" className="font-semibold text-terracotta-700 underline-offset-2 hover:underline">
            See plans
          </Link>
        </p>
      ) : !verified ? (
        <p className="mt-1 text-xs text-ink/55">
          Right now the couple sees a plain booth with your name. Get your shop verified and you can brand it
          with your logo and poster.
        </p>
      ) : eventPricePhp == null ? (
        <p className="mt-1 text-xs text-ink/55">Per-event branding is temporarily unavailable.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-ink/55">
            Right now the couple sees a plain booth with your name. Brand it with your logo and poster for
            this celebration only — <strong className="text-ink/80">{peso(eventPricePhp)}, one-time</strong>.
            It stays for as long as the couple keeps their room up.
          </p>
          <BoothEventBuyForm eventId={eventId} pricePhp={eventPricePhp} />
          {cyclePricePhp > 0 ? (
            <p className="mt-2 text-[11px] text-ink/45">
              Several weddings this month? The 3D Booth cycle brands every client&rsquo;s room for{' '}
              {peso(cyclePricePhp)} / 4 weeks.{' '}
              <Link href="/vendor-dashboard/subscription" className="font-semibold text-terracotta-700 underline-offset-2 hover:underline">
                Compare
              </Link>
            </p>
          ) : null}
        </>
      )}
    </ShopCard>
  );
}
