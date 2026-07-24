import { notFound, redirect } from 'next/navigation';
import { Video } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/orders';
import { AppStoreLayout, type PlanRow, type StatTile } from '@/app/_components/app-store/layout';
import { AddOnStateCta, statusPillForState } from '@/app/_components/app-store/state-cta';
import { fetchAddOnStats } from '@/lib/add-on-stats';
import { resolveAddOnState } from '@/lib/add-on-state';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';

// Live Studio ROAM — the multi-camera "guests pick which camera / wander" variant of
// Live Studio (owner 2026-07-23; Cast + Roam). App Store-style detail surface, mirrored
// on the Cast/panood pilot (studio/panood/page.tsx):
//
//   • PAID capability (no free tier — Cast is the free single-cam entry). serviceKey
//     LIVE_STUDIO_ROAM, priced LIVE from the admin catalog via formatV2Sku — never
//     hardcoded. The buy reuses AddOnStateCta / InlineCheckoutDrawer; the checkout's
//     serviceKey is LIVE_STUDIO_ROAM so submitOrderAction re-resolves the price from
//     platform_retail_catalog_v2 and rides the QR rail → /admin/payments.
//   • Once OWNED, the CTA flips to "Open controller" → ./setup (the channel-config
//     surface), exactly as Cast's owned CTA opens its control room.
//
// FLAG-GATED (NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED): the Studio tile that links here is
// already flag-gated (add-ons-catalog.ts); this page notFound()s when the flag is off as
// defense-in-depth against a direct hit. Live YouTube streaming is a further, separate
// owner-OAuth gate (pool channel — see ./setup) — configuring + buying Roam needs none
// of it.

export const metadata = { title: 'Live Studio Roam · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

const ROAM_SKU_CODE = 'LIVE_STUDIO_ROAM';

export default async function LiveStudioRoamPage({ params }: Props) {
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

  const controllerHref = `/dashboard/${eventId}/studio/live-studio-roam/setup`;

  const [stats, stateCtx, settings, roamSku] = await Promise.all([
    fetchAddOnStats(supabase, 'live-studio-roam'),
    resolveAddOnState(supabase, eventId, 'live-studio-roam', 'couple', controllerHref),
    fetchPlatformSettings(supabase),
    formatV2Sku(ROAM_SKU_CODE).catch(() => null),
  ]);

  // Live catalog price (display only; the charge is re-resolved server-side from
  // ROAM_SKU_CODE in submitOrderAction, so a catalog miss only blanks the label).
  const roamCentavos = roamSku?.price_centavos ?? 0;
  const priceLabel = roamSku ? formatPhp(roamSku.price_php) : '—';
  const fromLabel = `${priceLabel} / day`;

  const roamPlanRow: PlanRow = {
    name: 'Multi-camera Roam',
    scope:
      'Everything unlocks for one event-day — name multiple cameras across your angles, rooms, and venues; guests pick which one to watch and switch live, with your chosen default view one tap away. Cameras join as phones via the event QR (no install, no per-camera fee).',
    price: priceLabel,
    unit: ' / day',
    badge: 'Per event-day',
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
      caption: 'Guests pick the view',
    },
    {
      eyebrow: 'Pricing',
      value: priceLabel,
      caption: 'per event-day',
    },
  ];

  const roamCta = (
    <AddOnStateCta
      context={stateCtx}
      launchLabel="Open controller"
      choosePlan={{
        eventId,
        triggerLabel: 'Add Roam',
        priceFromLabel: fromLabel,
        // Single per-day SKU. serviceKey = ROAM_SKU_CODE so the drawer's order
        // re-resolves the price from the admin catalog; priceCentavos is the live
        // catalog price threaded through for the inline voucher math.
        plans: [
          {
            sku_code: ROAM_SKU_CODE,
            name: roamPlanRow.name,
            scope: roamPlanRow.scope,
            price: roamPlanRow.price,
            unit: roamPlanRow.unit,
            badge: roamPlanRow.badge,
            priceCentavos: String(roamCentavos),
          },
        ],
        settings,
        introCopy:
          'Live Studio Roam gives your guests multiple cameras to choose between — different angles, rooms, even different venues — with your directed view as the default. Buy one Roam day per event-day; set up your cameras right after.',
        footnote:
          'Apply-then-pay flow · we confirm price before payment · refunds follow the standard 24-hour SLA. Cameras join as phones via the event QR — no per-camera fee.',
      }}
    />
  );

  return (
    <AppStoreLayout
      back={{ href: `/dashboard/${eventId}/studio`, label: 'Back to add-ons' }}
      hero={{
        Icon: Video,
        eyebrow: 'Live Studio Roam',
        title: 'Let everyone pick their view.',
        tagline:
          'Give the people you love multiple cameras to choose between — following the moment that matters most to them, as it happens, across every angle and venue, with your directed view always one tap away.',
        statusPill: statusPillForState(stateCtx.state) ?? { label: 'Web V1', tone: 'accent' },
        cta: roamCta,
      }}
      stats={stats4}
      justLaunchedChip={stats.hasLaunchSignal ? null : 'Just launched · early access'}
      highlights={{
        title: "What you'll have",
        items: [
          'Name multiple cameras — one per angle, room, or venue',
          'Guests choose which camera to watch and switch live',
          'Your directed view is the default — one tap back any time',
          'Cameras join as phones via the event QR — no install, no per-camera fee',
          'Plays right on your event page, in your colors',
          'Covers one event-day — add a Roam day per event-day',
        ],
      }}
      description={{
        paragraphs: [
          'A wedding happens in more than one place at once — the ceremony up front, the reception floor, the photo booth in the corner, sometimes a whole second venue. Live Studio Roam lets the people who can’t be there choose which of those to watch, and wander between them, instead of being locked to a single directed feed.',
          `You set up your cameras in the controller (${priceLabel} / day for one event-day): name each one, group them by venue, and mark the camera the picker opens on by default. Each camera is just a phone your paparazzi join by scanning the event QR — no install, no per-camera fee. On broadcast day the picker appears on your event page, in your colors, and every remote guest chooses their own view.`,
          'Roam is the multi-camera sibling of Live Studio Cast (the free single-camera livestream). Cast directs one feed for everyone; Roam hands the choice to your guests.',
        ],
        plans: [roamPlanRow],
        notIncluded: [
          'Your camera people are friends or family with phones — not a hired crew.',
          'Cast (the free single-camera livestream) is a separate service — Roam is the paid multi-camera upgrade.',
          'A Setnayan-provided camera kit is an optional add-on, not included in this per-day price.',
          'Build state: the channel controller and picker are in place; live multi-camera streaming rolls out as the streaming infrastructure comes online.',
        ],
      }}
    />
  );
}
