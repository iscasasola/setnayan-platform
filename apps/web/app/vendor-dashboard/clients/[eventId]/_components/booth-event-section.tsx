// "Your booth in their 3D Plan" — whether this shop's booth is branded at THIS
// event. Since the owner's a02673ac (23 Nov 2026) the branding is the 3D plan
// widget: bought once in the Toolkit AND on Plus, Pro or Ultra. The retired
// per-event buy and 4-week cycle are honoured where already paid, never sold.
//
// Async SERVER component, self-fetching like VendorChallengeSection: tier +
// verification + the cycle window (session client — the shop's own row), the
// per-event order state (ADMIN client — a teammate's order has a different
// user_id and orders_owner_read would hide it), and the live price. Mounted
// booked-only by the client-event card. Renders null only when 3D is switched
// off — every other state is drawn, including the ones that cannot buy, because
// a vendor who cannot see WHY they are generic will assume the product is broken.
import { Store, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { seating3dEnabled } from '@/lib/seating-3d-flag';
import { isVendor3dBoothActive } from '@/lib/vendor-3d-booth-pricing';
import {
  fetchVendorBoothEventOrderState,
} from '@/lib/vendor-3d-booth-event-pricing';
import { ShopCard } from '../../../_components/kit';
import { isStoreShellRequest } from '@/lib/request-platform';
import { LockedFeature } from '@/app/_components/lock/locked-feature';
import { readPaidWidgetStatus } from '@/lib/supplier-store.server';
import { widgetLock, type ToolStatus } from '@/lib/supplier-store';
import { PAID_WIDGET_NEEDS_PLAN_WORDS, PAID_WIDGET_RESUBSCRIBE_WORDS } from '@/lib/special-tools';
import { formatPhp } from '@/lib/php';
import { routes } from '@/lib/routes';

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
  const [gateRead, orderState, includedRead] = await Promise.all([
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
    // 🧰 Owner a02673ac (23 Nov): the branded booth is the 3D plan widget — bought in the Toolkit AND on Plus, Pro or
    // Ultra, the SAME rule event_branded_booth_vendor_ids brands the couple's room with. Admin client: service role.
    readPaidWidgetStatus(admin, vendorProfileId, 'plan_3d').then(
      (st) => ({ unread: st.kind === 'unread', included: st.kind === 'owned', status: st }),
      (err: unknown) => {
        console.error('[supabase-error] booth-event-section: plan_3d widget', err);
        return { unread: true, included: false, status: { kind: 'unread' } as ToolStatus };
      },
    ),
  ]);

  const gateRow = gateRead.row;
  const gateUnread = gateRead.unread || includedRead.unread;
  const included = includedRead.included;
  const lock = widgetLock(includedRead.status);
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
      ) : (
        /* 🧰 Owner a02673ac (23 Nov): the branded booth is the 3D plan widget, bought once in the Toolkit and working
           only on Plus, Pro or Ultra — the shared 🔒 (Problem → Solution → the one door). The per-event buy is retired. */
        <>
          <p className="mt-1 text-xs text-ink/55">Right now the couple sees a plain booth with your name.</p>
          {lock ? (
            <div className="mt-3" data-booth-locked="">
              <LockedFeature
                lock="boothBranding"
                need={{
                  kind: 'widget',
                  owned: lock.owned,
                  subscribed: lock.subscribed,
                  price: lock.price == null ? null : `${formatPhp(lock.price)} · one-time`,
                  toolkitHref: routes.vendorDashboard.shop.store.item('tools', 'plan_3d'),
                  plansHref: routes.vendorDashboard.subscription(),
                }}
                line={lock.owned ? PAID_WIDGET_RESUBSCRIBE_WORDS : PAID_WIDGET_NEEDS_PLAN_WORDS}
              />
            </div>
          ) : null}
        </>
      )}
    </ShopCard>
  );
}
