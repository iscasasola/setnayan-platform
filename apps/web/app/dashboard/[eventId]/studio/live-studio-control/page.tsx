import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Video, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/orders';
import { AppStoreLayout, type PlanRow, type StatTile } from '@/app/_components/app-store/layout';
import { AddOnStateCta, statusPillForState } from '@/app/_components/app-store/state-cta';
import { fetchAddOnStats } from '@/lib/add-on-stats';
import { resolveAddOnState } from '@/lib/add-on-state';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { liveStudioControlPath } from '@/lib/live-studio-control';

// UNIFIED Live Studio — one switching-based product that merges Cast (the directed
// single feed) + Roam (guests pick their view) into a directed Main Stage plus
// switchable guest cameras (owner 2026-07-25; Live_Studio_Unified_Spec_2026-07-25.md).
// App Store-style detail surface, built on the Roam substrate:
//
//   • PAID capability (no free tier — the single-camera livestream stays free).
//     serviceKey LIVE_STUDIO, priced LIVE from the admin catalog via formatV2Sku —
//     never hardcoded. The buy reuses AddOnStateCta / InlineCheckoutDrawer; the
//     checkout's serviceKey is LIVE_STUDIO so submitOrderAction re-resolves the price
//     from platform_retail_catalog_v2 (₱2,999 · per event · one_time) and rides the
//     QR rail → /admin/payments.
//   • Once OWNED, the CTA flips to "Open controller" → ./setup (the unified switching
//     controller: name cameras, cut them onto the Main Stage, set the default view).
//
// FLAG-GATED (NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED): the Studio tile that links here is
// already flag-gated (add-ons-catalog.ts); this page notFound()s when the flag is off as
// defense-in-depth. Live YouTube streaming is a further, separate owner-OAuth gate (pool
// channel — see ./setup) — configuring + buying Live Studio needs none of it.
//
// NOTE the route/feature key stays `live-studio-roam` (internal), the same way "Live
// Studio Cast" keeps the internal `panood` name — renaming the route is a separate,
// churny effort. Everything the customer sees says "Live Studio".

export const metadata = { title: 'Live Studio · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

const LIVE_STUDIO_SKU_CODE = 'LIVE_STUDIO';
const FEATURE_KEY = 'live-studio-roam';

export default async function LiveStudioPage({ params }: Props) {
  if (!liveStudioRoamEnabled()) notFound();

  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  // ⭐ WAVE 8: the controller moved out of /dashboard (chrome-less, § 4g) — resolve
  // it through the shared helper so this doorway can never point at the old URL.
  const controllerHref = liveStudioControlPath(eventId);

  const [stats, stateCtx, settings, sku] = await Promise.all([
    fetchAddOnStats(supabase, FEATURE_KEY),
    resolveAddOnState(supabase, eventId, FEATURE_KEY, 'couple', controllerHref),
    fetchPlatformSettings(supabase),
    formatV2Sku(LIVE_STUDIO_SKU_CODE).catch(() => null),
  ]);

  // Live catalog price (display only; the charge is re-resolved server-side from
  // LIVE_STUDIO_SKU_CODE in submitOrderAction, so a catalog miss only blanks the label).
  const centavos = sku?.price_centavos ?? 0;
  const priceLabel = sku ? formatPhp(sku.price_php) : '—';

  const planRow: PlanRow = {
    name: 'Live Studio',
    scope:
      'Everything unlocks for one event. Name multiple cameras across your angles, rooms, and venues; cut whichever one you want onto your directed Main Stage with a tap, and let remote guests pick their own view and switch live. Cameras join as phones via the event QR (no install, no per-camera fee).',
    price: priceLabel,
    unit: '',
    badge: 'Per event',
  };

  const stats4: StatTile[] = [
    {
      eyebrow: 'Rating',
      value: stats.avgRating === null ? '—' : stats.avgRating.toFixed(1),
      starFill: stats.avgRating ?? 0,
      caption:
        stats.reviewCount === 0
          ? 'No reviews yet'
          : `${stats.reviewCount} review${stats.reviewCount === 1 ? '' : 's'}`,
    },
    {
      eyebrow: 'Purchased',
      value: stats.paidOrderCount === 0 ? '—' : stats.paidOrderCount.toLocaleString('en-PH'),
      caption:
        stats.paidOrderCount === 0
          ? 'Be one of the first'
          : `${stats.eventsWithFeature} event${stats.eventsWithFeature === 1 ? '' : 's'}`,
    },
    {
      eyebrow: 'Cameras',
      value: 'Multi',
      caption: 'Cut + guest-pick',
    },
    {
      eyebrow: 'Pricing',
      value: priceLabel,
      caption: 'per event',
    },
  ];

  // One controller shared by free + paid (owner 2026-07-25): a host who hasn't
  // bought Live Studio can still OPEN the controller and go live free with a single
  // camera — the multi-camera extras simply show locked there. So for any non-owned
  // state we surface a secondary "Open the controller" link beside the buy CTA. When
  // owned ('launch'), the primary CTA already opens the controller, so we don't
  // duplicate it.
  const cta = (
    <div className="space-y-2">
      <AddOnStateCta
        context={stateCtx}
        launchLabel="Open controller"
        choosePlan={{
        eventId,
        triggerLabel: 'Add Live Studio',
        priceFromLabel: priceLabel,
        // Single per-event SKU. serviceKey = LIVE_STUDIO_SKU_CODE so the drawer's order
        // re-resolves the price from the admin catalog; priceCentavos is the live catalog
        // price threaded through for the inline voucher math.
        plans: [
          {
            sku_code: LIVE_STUDIO_SKU_CODE,
            name: planRow.name,
            scope: planRow.scope,
            price: planRow.price,
            unit: planRow.unit,
            badge: planRow.badge,
            priceCentavos: String(centavos),
          },
        ],
        settings,
        introCopy:
          'Live Studio streams your celebration live for everyone who can’t be there. One directed Main Stage plus switchable guest cameras — different angles, rooms, even different venues. Cut the Main Stage between them with a tap, or let remote guests pick their own view. Buy one Live Studio per event; set up your cameras right after.',
        footnote:
          'Apply-then-pay flow · we confirm price before payment · refunds follow the standard 24-hour SLA. Cameras join as phones via the event QR — no per-camera fee. The free single-camera livestream is unchanged.',
        }}
      />
      {stateCtx.state !== 'launch' ? (
        <Link
          href={controllerHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
        >
          Open the controller — go live free with one camera
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      ) : null}
    </div>
  );

  return (
    <AppStoreLayout
      back={{ href: `/dashboard/${eventId}/studio`, label: 'Back to add-ons' }}
      hero={{
        Icon: Video,
        eyebrow: 'Live Studio',
        title: 'Stream it live — your way.',
        tagline:
          'Give the people you love a front-row seat from anywhere. Direct a Main Stage between your cameras with a tap, or let each guest choose the angle they want to watch — every corner of your day, live.',
        statusPill: statusPillForState(stateCtx.state) ?? { label: 'Web V1', tone: 'accent' },
        cta,
      }}
      stats={stats4}
      justLaunchedChip={stats.hasLaunchSignal ? null : 'Just launched · early access'}
      highlights={{
        title: "What you'll have",
        items: [
          'One directed Main Stage you cut between cameras with a tap',
          'Multiple cameras — one per angle, room, or venue',
          'Guests can pick their own view and switch live',
          'Cameras join as phones via the event QR — no install, no per-camera fee',
          'Plays right on your event page, in your colors',
          'One price, per event — the free single-camera livestream stays free',
        ],
      }}
      description={{
        paragraphs: [
          'A celebration happens in more than one place at once — the ceremony up front, the reception floor, the photo booth in the corner, sometimes a whole second venue. Live Studio lets you direct all of it: line up your cameras, then cut whichever one matters most onto the Main Stage every remote guest is watching.',
          `You set it up in the controller (${priceLabel}, one price per event): name each camera, group them by venue, mark a default, and cut between them live on the day. Each camera is just a phone your paparazzi join by scanning the event QR — no install, no per-camera fee. Guests who want to wander can pick their own view; everyone else follows your directed Main Stage.`,
          'Live Studio merges the two things people asked for — a directed broadcast and a choose-your-own-camera experience — into one tool. The single-camera livestream stays free; Live Studio is the multi-camera upgrade.',
        ],
        plans: [planRow],
        notIncluded: [
          'Your camera people are friends or family with phones — not a hired crew.',
          'The free single-camera livestream is a separate, always-free service — Live Studio is the paid multi-camera upgrade.',
          'No compositing in this version — picture-in-picture, split-screen, and graphics overlays are a later Pro layer. Live Studio cuts cleanly between whole cameras.',
          'A Setnayan-provided camera kit is an optional add-on, not included in this price.',
          'Build state: the switching controller and picker are in place; live multi-camera streaming rolls out as the streaming infrastructure comes online.',
        ],
      }}
    />
  );
}
