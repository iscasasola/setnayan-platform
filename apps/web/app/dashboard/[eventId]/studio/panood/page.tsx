import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Radio, Tv } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/orders';
import {
  AppStoreLayout,
  type PlanRow,
  type StatTile,
} from '@/app/_components/app-store/layout';
import {
  AddOnStateCta,
  statusPillForState,
} from '@/app/_components/app-store/state-cta';
import { fetchAddOnStats } from '@/lib/add-on-stats';
import { resolveAddOnState } from '@/lib/add-on-state';
// 2026-05-29 Day 2 inline-checkout sprint (CLAUDE.md Day 2 row · V1 SCOPE
// EXPANSION). The per-plan "Add to event" CTA in ChoosePlanSheet now opens
// the InlineCheckoutDrawer · pass BDO + GCash settings from platform_settings
// so the drawer can render the QR + account block inline. Cross-refs:
//   • apps/web/app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx
//   • apps/web/app/dashboard/[eventId]/checkout/actions.ts
//   • PR #594 + PR #595 voucher schema substrate
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';

// Iteration 0011 — Panood App Store-style detail surface.
//
// RESTRUCTURED 2026-06-26 to the LOCKED two-tier packaging (see
// Panood_Multicam_Architecture_2026-06-26.md § "Packaging LOCKED" + the
// free-vs-paid boundary memory "every service free to use; some have
// upgrades"):
//
//   • FREE — single-camera livestream. The couple goes live on their OWN
//     YouTube (phone or laptop), it embeds on the event page in their colours,
//     and auto-archives forever. ₱0, available NOW to everyone, no purchase.
//     The PRIMARY hero CTA is a free "Go live — free" → ./setup. This honours
//     the "every service free to use" positioning — leading with a paid "Add"
//     mis-frames Panood as a paywalled product, which it is not.
//
//   • PAID upgrade — Multicam control room (PANOOD_SYSTEM). Multiple cameras,
//     live switching, one-tap moments (Cake / First Dance / …), overlays, and
//     routing every venue screen. Priced LIVE from the admin catalog via
//     formatV2Sku(PANOOD_SYSTEM) — NEVER hardcoded. The buy reuses the existing
//     AddOnStateCta / InlineCheckoutDrawer machinery; when OWNED, the CTA opens
//     the control room → ./broadcast (NOT ./setup, which is the free relay).
//
// Pricing source of truth: the admin-managed V2 catalog row PANOOD_SYSTEM in
// platform_retail_catalog_v2, read live via formatV2Sku (owner 2026-06-18 ·
// "admin pricing controls all the prices on the app"). The checkout's
// serviceKey is PANOOD_SYSTEM, so submitOrderAction re-resolves the price from
// the catalog — editing it at /admin/pricing now propagates here.

export const metadata = { title: 'Panood · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

const PANOOD_SKU_CODE = 'PANOOD_SYSTEM';

export default async function PanoodAppStorePage({ params }: Props) {
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

  const setupHref = `/dashboard/${eventId}/studio/panood/setup`;
  const controlRoomHref = `/dashboard/${eventId}/studio/panood/broadcast`;

  // Parallel-fetch the platform settings alongside stats + state. The
  // settings feed the InlineCheckoutDrawer in ChoosePlanSheet · zero
  // extra round-trips because we're already awaiting two things here.
  //
  // The PAID multicam controller opens the CONTROL ROOM (./broadcast) once
  // owned — so the resolved 'launch' href routes there, not to the free
  // ./setup relay.
  const [stats, stateCtx, settings, panoodSku] = await Promise.all([
    fetchAddOnStats(supabase, 'panood'),
    resolveAddOnState(supabase, eventId, 'panood', 'couple', controlRoomHref),
    fetchPlatformSettings(supabase),
    formatV2Sku(PANOOD_SKU_CODE).catch(() => null),
  ]);

  // Multicam controller SKU, priced live from the admin catalog. The charge
  // itself is re-resolved server-side from PANOOD_SKU_CODE (the serviceKey), so
  // this price is for display; a catalog miss only blanks the label, never
  // bills a stale number.
  const multicamCentavos = panoodSku?.price_centavos ?? 0;
  const multicamPriceLabel = panoodSku ? formatPhp(panoodSku.price_php) : '—';
  const multicamFromLabel = `${multicamPriceLabel} / day`;

  // The PAID multicam upgrade plan row + sheet plan. The FREE single-cam tier
  // is presented as its own ₱0 plan row alongside it (no purchase flow — the
  // hero's primary CTA links straight into ./setup).
  const multicamPlan = {
    sku_code: PANOOD_SKU_CODE,
    name: 'Multicam control room',
    scope:
      'Everything unlocks for one event-day — Cameras: multi-cam + live camera switch + connect any camera (phone or DSLR), camera bridge included with no per-camera fee · Streaming: multi-cam YouTube live + live streaming + an in-house (offline/local) stream · Screens: Photowall → screen, LED Wall → screen, extended screen control, control multiple screens · Production: overlays + a live highlight generator (live replays during the broadcast).',
    price: multicamPriceLabel,
    unit: ' / day',
    badge: 'Upgrade' as const,
    priceCentavos: String(multicamCentavos),
  };

  const freePlanRow: PlanRow = {
    name: 'Single-camera livestream',
    scope:
      'Go live on your own YouTube — phone or laptop. Embeds on your event page in your colours, auto-archived forever.',
    price: 'Free',
    unit: '',
    badge: 'Included',
  };
  const multicamPlanRow: PlanRow = {
    name: multicamPlan.name,
    scope: multicamPlan.scope,
    price: multicamPlan.price,
    unit: multicamPlan.unit,
    badge: multicamPlan.badge,
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
      value:
        stats.paidOrderCount === 0 ? '—' : stats.paidOrderCount.toLocaleString('en-PH'),
      caption:
        stats.paidOrderCount === 0
          ? 'Be one of the first'
          : `${stats.eventsWithFeature} event${stats.eventsWithFeature === 1 ? '' : 's'}`,
    },
    {
      eyebrow: '% of events',
      value:
        stats.totalEvents === 0
          ? '—'
          : `${Math.round((stats.eventsWithFeature / stats.totalEvents) * 100)}%`,
      caption: 'use Panood',
    },
    {
      eyebrow: 'Pricing',
      value: 'Free',
      caption: `+ multicam from ${multicamPriceLabel}`,
    },
  ];

  // The PAID multicam upgrade CTA. In the 'add' state it opens the plan sheet
  // for PANOOD_SYSTEM; once owned it flips to "Open control room" → ./broadcast
  // (the resolved 'launch' href). The FREE single-cam tier never goes through
  // this — it's the primary hero CTA below, a plain link into ./setup.
  const multicamCta = (
    <AddOnStateCta
      context={stateCtx}
      launchLabel="Open control room"
      choosePlan={{
        eventId,
        triggerLabel: 'Upgrade to multicam',
        priceFromLabel: multicamFromLabel,
        // Single per-day multicam SKU. serviceKey = PANOOD_SKU_CODE so the
        // drawer's order re-resolves the price from the admin catalog;
        // priceCentavos is the live catalog price threaded through for the
        // inline voucher math.
        plans: [
          {
            sku_code: multicamPlan.sku_code,
            name: multicamPlan.name,
            scope: multicamPlan.scope,
            price: multicamPlan.price,
            unit: multicamPlan.unit,
            badge: multicamPlan.badge,
            priceCentavos: multicamPlan.priceCentavos,
          },
        ],
        settings,
        introCopy:
          'Single-camera livestream is already free for your event. The multicam control room unlocks everything else — connect any camera (phone or DSLR, bridge included with no per-camera fee) and switch them live, broadcast multi-cam to YouTube (or run an in-house offline stream), route Photowall and LED-Wall content to every venue screen with extended multi-screen control, add overlays, and fire a live highlight generator for instant replays during the broadcast. Buy one control-room day per event-day.',
        footnote:
          'Apply-then-pay flow · we confirm price before payment · refunds follow the standard 24-hour SLA.',
      }}
    />
  );

  // PRIMARY hero CTA = the FREE single-cam livestream. Leads the page so Panood
  // reads as "free to use, with an optional upgrade" — never as a paywall.
  const freeGoLiveCta = (
    <Link
      href={setupHref}
      className="inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
    >
      <Radio aria-hidden className="h-4 w-4" strokeWidth={2} />
      Go live — free
    </Link>
  );

  return (
    <AppStoreLayout
      back={{ href: `/dashboard/${eventId}/studio`, label: 'Back to add-ons' }}
      hero={{
        Icon: Tv,
        eyebrow: 'Panood',
        title: 'No one misses your day.',
        tagline:
          'Stream your day live on your own YouTube — free for every couple, kept forever. Need a real broadcast? Upgrade to the multicam control room: connect multiple cameras and switch live, stream multi-cam to YouTube or run an in-house offline feed, route Photowall + LED-Wall content to every venue screen, add overlays, and fire live replays as the moments happen.',
        statusPill:
          statusPillForState(stateCtx.state) ?? { label: 'Free · Web V1', tone: 'accent' },
        // FREE single-cam is the lead. The PAID multicam upgrade sits beside it
        // (or, once owned, becomes the "Open control room" launch button).
        cta: freeGoLiveCta,
        secondary: multicamCta,
      }}
      stats={stats4}
      justLaunchedChip={stats.hasLaunchSignal ? null : 'Just launched · early access'}
      preview={[
        {
          context: 'Free · single cam',
          caption: 'Go live on your own YouTube from a phone or laptop.',
          body: (
            <span>
              <span aria-hidden className="block text-3xl">
                ▶
              </span>
              <span className="mt-2 block text-[11px] text-ink/55">
                Free for every couple
              </span>
            </span>
          ),
        },
        {
          context: 'On your page',
          caption: 'The stream lives on your wedding page, in your colors.',
          body: (
            <span aria-hidden className="block text-3xl">
              ◷
            </span>
          ),
        },
        {
          context: 'Upgrade · cameras',
          caption: 'Connect any camera — phone or DSLR, bridge included — and cut between them live.',
          body: (
            <span aria-hidden className="block text-3xl">
              ◧
            </span>
          ),
        },
        {
          context: 'Upgrade · streaming',
          caption: 'Multi-cam to YouTube — or run an in-house offline stream.',
          body: (
            <span aria-hidden className="block text-3xl">
              ▶
            </span>
          ),
        },
        {
          context: 'Upgrade · screens',
          caption: 'Route Photowall + LED-Wall to every venue screen at once.',
          body: (
            <span aria-hidden className="block text-3xl">
              ▦
            </span>
          ),
        },
        {
          context: 'Upgrade · production',
          caption: 'Overlays in your colors + live replays as moments happen.',
          body: (
            <span aria-hidden className="block text-3xl">
              ✦
            </span>
          ),
        },
        {
          context: 'Yours forever',
          caption: 'Auto-archived for you to rewatch any time.',
          body: (
            <span aria-hidden className="block text-3xl">
              ❖
            </span>
          ),
        },
      ]}
      highlights={{
        title: "What you'll have",
        items: [
          'Free · single-camera livestream on your own YouTube — phone or laptop',
          'Free · right on your wedding page, in your colors',
          'Free · the whole day, auto-archived for you to keep',
          'Cameras · connect any camera — phone or DSLR — switch between them live, with a one-tap camera switch. The camera bridge is included, no per-camera fee.',
          'Streaming · multi-cam YouTube live, live streaming, plus an in-house (offline/local) stream',
          'Screens · Photowall → screen, LED Wall → screen, extended screen control across multiple screens',
          'Production · overlays in your colors and a live highlight generator that makes replays during the broadcast',
        ],
      }}
      description={{
        paragraphs: [
          'Half the people who love you can’t fit in the room — or can’t make the trip at all. Panood brings them in. The single-camera livestream is free for every couple: go live on your own YouTube, from a phone or a laptop, and it plays right on your event page, in your colors. The whole celebration auto-archives, so you can rewatch the vows, the first dance, the speeches, any time you want.',
          `Want a real broadcast? The multicam control room is the premium upgrade (${multicamPriceLabel} / day), and it unlocks everything below for the day. Cameras: connect any camera — phone or DSLR — switch between them live, and tap a single camera switch; the camera bridge is included, with no per-camera fee. Streaming: multi-cam YouTube live, live streaming, plus an in-house (offline/local) stream so the show plays even when the venue Wi-Fi can’t. Screens: route Photowall content and LED-Wall content straight to the venue screens, with extended screen control across multiple screens at once. Production: overlays in your colors and a live highlight generator that builds replays during the broadcast. The four capabilities, in one line: connect multiple cameras · control multiple screens · broadcast via YouTube · also run an in-house offline stream.`,
          'Two notes so nothing surprises you. The highlight generator here makes LIVE replays during the broadcast — your post-event edits (AI Highlight, the Thank-You video) are still their own separate services. And Panood routes Photowall and LED-Wall content onto your screens — the standalone PhotoWall and Live-Background (LED) content services stay separate; the control room is what puts them on the venue screens.',
          'Both tiers cover one event-day. Filipino weddings often run across a few days — prep, ceremony, reception — so go live free on each, and add a multicam control-room day wherever you want the full production.',
        ],
        plans: [freePlanRow, multicamPlanRow],
        notIncluded: [
          'Your camera people are friends or family with phones — not a hired crew.',
          'The free tier is single-camera. Multi-cam switching, multi-cam YouTube, the in-house offline stream, Photowall/LED routing, multi-screen control, overlays, and the live highlight generator are the paid control-room upgrade.',
          'The live highlight generator makes replays during the broadcast — post-event edits (AI Highlight · Thank-You video) are separate services.',
          'Panood routes Photowall + LED-Wall content to your screens — the standalone PhotoWall and Live-Background (LED) content services are bought separately.',
          'Build state: the control room and these surfaces are in place; live multi-cam video is rolling out as the streaming infrastructure comes online.',
        ],
      }}
      reviews={{
        href: `/dashboard/${eventId}/studio/panood/reviews`,
        avgRating: stats.avgRating,
        reviewCount: stats.reviewCount,
      }}
    />
  );
}
