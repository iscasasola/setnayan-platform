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
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { openRailOptions } from '@/lib/payment-channels';
import { seating3dEnabled } from '@/lib/seating-3d-flag';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { resolveVendorTier } from '@/lib/vendor-feature-gate';
import { planWord } from '@/lib/vendor-plan-change-words';
import { isVendor3dBoothActive, fetchVendor3dBoothPricePhp } from '@/lib/vendor-3d-booth-pricing';
import {
  fetchVendor3dBoothEventPricePhp,
  fetchVendorBoothEventOrderState,
} from '@/lib/vendor-3d-booth-event-pricing';
import { ShopCard } from '../../../_components/kit';
import { BoothEventBuyForm } from './booth-event-buy-form';
import { isStoreShellRequest } from '@/lib/request-platform';
import { LockedFeature } from '@/app/_components/lock/locked-feature';
import { PRO_TOOLS_MIN_TIER } from '@/lib/specialized-tools-access';

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
  // 🔒 A DIGITAL ADD-ON, SOLD HERE FOR ₱ — so the App Store / Play Store shell
  // never sees this card (guideline 3.1.1; lib/store-shell.ts). Every state of
  // it is either a price, a "See plans" link to the web-only subscription page,
  // or the status of that purchase. Desktop and the web are unaffected.
  if (await isStoreShellRequest()) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  const [gateRead, orderState, eventPricePhp, cyclePricePhp, settings, includedRead, planTier] = await Promise.all([
    supabase
      .from('vendor_profiles')
      .select('tier_state, verification_state, booth_addon_expires_at')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle()
      .then(
        (r) => {
          // C-1: a REFUSED plan read is not "no paid plan" — `gateUnread` stops the card telling a paying shop to upgrade.
          if (r.error) console.error('[supabase-error] booth-event-section: plan read', r.error);
          return {
            unread: !!r.error,
            row: r.data as {
              tier_state?: string | null;
              verification_state?: string | null;
              booth_addon_expires_at?: string | null;
            } | null,
          };
        },
        (err: unknown) => {
          console.error('[supabase-error] booth-event-section: plan read', err);
          return { unread: true, row: null };
        },
      ),
    fetchVendorBoothEventOrderState(admin, vendorProfileId, eventId),
    fetchVendor3dBoothEventPricePhp(supabase),
    fetchVendor3dBoothPricePhp(supabase),
    fetchPlatformSettings(supabase),
    // 🎁 Owner 20 Nov: the branded booth comes with Pro and up (or a shop grandfathered when that shipped) — the SAME
    // gate event_branded_booth_vendor_ids brands the couple's room with. Admin client: service role only.
    admin.rpc('vendor_pro_tools_included', { p_vendor_profile_id: vendorProfileId, p_event_id: eventId }).then(
      (r) => {
        if (r.error) console.error('[supabase-error] booth-event-section: vendor_pro_tools_included', r.error);
        return { unread: !!r.error, included: r.data === true };
      },
      (err: unknown) => {
        console.error('[supabase-error] booth-event-section: vendor_pro_tools_included', err);
        return { unread: true, included: false };
      },
    ),
    // ⚖ Owner 20/21 Nov (specs 66ae2cce): the branded booth is a Pro-and-up benefit, not sold below it — the same
    // effective plan the Special tools gate on (promotions applied), so a Plus shop never meets the buy form.
    resolveVendorTier(supabase, vendorProfileId),
  ]);
  // The rails the owner has left ON — the buy form offers only these.
  const openRails = openRailOptions(settings);

  const gateRow = gateRead.row;
  const gateUnread = gateRead.unread || includedRead.unread;
  const included = includedRead.included;
  const tierOk = isTierAtLeast(planTier, PRO_TOOLS_MIN_TIER);
  const verified = gateRow?.verification_state === 'verified';
  const cycleActive = isVendor3dBoothActive(gateRow?.booth_addon_expires_at ?? null);
  const cycleUntil = gateRow?.booth_addon_expires_at
    ? new Date(gateRow.booth_addon_expires_at).toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })
    : null;
  const branded = cycleActive || orderState === 'active' || included;

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

      {included && !cycleActive && orderState !== 'active' ? (
        <p className="mt-1 text-xs text-ink/55" data-booth-included="">
          Comes with your plan — your logo and poster are on in the couple&rsquo;s room. Nothing to buy.
        </p>
      ) : cycleActive ? (
        <p className="mt-1 text-xs text-ink/55">
          Your 3D Booth cycle covers this event{cycleUntil ? ` until ${cycleUntil}` : ''} — logo and
          poster are on in the couple&rsquo;s room. Nothing more to buy here.
        </p>
      ) : orderState === 'active' ? (
        <p className="mt-1 text-xs text-ink/55">
          Branded at this event — your logo and poster stay in the couple&rsquo;s room for as long as
          they keep it up. One-time; nothing renews.
        </p>
      ) : orderState === 'unread' || gateUnread ? (
        /* C-1 (supplier audit 2026-11-17): a refused read is said — never the buy form (they may have paid already)
           and never "comes with a paid plan" (they may be paying). */
        <p className="mt-1 text-xs text-ink/55" data-booth-event-unread="">
          We couldn&rsquo;t load whether your booth is branded at this event. Refresh in a moment to try again.
        </p>
      ) : orderState === 'pending' ? (
        <p className="mt-1 text-xs text-ink/55">
          Payment under review. Your booth brands the moment it&rsquo;s confirmed — usually within 24 hours.
        </p>
      ) : !tierOk || !verified || eventPricePhp == null ? (
        /* 🎁 Owner 20 Nov: the branded booth comes with Pro and up and is not sold on its own — the shared 🔒
           (Problem → Solution → Upgrade). Replaces "comes with a paid plan (Supplier Plus …)", now untrue. */
        <>
          <p className="mt-1 text-xs text-ink/55">Right now the couple sees a plain booth with your name.</p>
          <div className="mt-3" data-booth-locked="">
            <LockedFeature
              lock="boothBranding"
              need={{ kind: 'plan', plan: PRO_TOOLS_MIN_TIER, price: null, href: '/vendor-dashboard/subscription' }}
              line={`Included in ${planWord(PRO_TOOLS_MIN_TIER)} · Upgrade`}
            />
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-ink/55">
            Right now the couple sees a plain booth with your name. Brand it with your logo and poster for
            this event only — <strong className="text-ink/80">{peso(eventPricePhp)}, one-time</strong>.
            It stays for as long as the couple keeps their room up.
          </p>
          <BoothEventBuyForm eventId={eventId} pricePhp={eventPricePhp} openRails={openRails} />
          {cyclePricePhp != null && cyclePricePhp > 0 ? (
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
