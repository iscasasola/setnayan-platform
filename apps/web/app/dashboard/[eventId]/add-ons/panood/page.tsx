import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ExternalLink, Tv } from 'lucide-react';
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
// Replaces the prior single-page setup wall (now moved to ./setup/page.tsx).
// On this page couples discover, compare, and buy; once they own a plan,
// the hero CTA flips to "Open Panood setup" and routes into the setup
// surface that holds YouTube OAuth, broadcaster + camera-operator links.
//
// Pricing source of truth: the admin-managed V2 catalog row PANOOD_SYSTEM in
// platform_retail_catalog_v2, read live via formatV2Sku (owner 2026-06-18 ·
// "admin pricing controls all the prices on the app"). Panood is ONE per-day
// SKU; the prior hardcoded 5-SKU ladder (Daily / Annual / AI-Highlight /
// AI-Edited / Same-Day-Edit) used V1 keys absent from the catalog, so admin
// price edits were silently ignored on the charge. The checkout's serviceKey
// is now PANOOD_SYSTEM, so submitOrderAction re-resolves the price from the
// catalog — editing it at /admin/pricing now propagates here.

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

  // Parallel-fetch the platform settings alongside stats + state. The
  // settings feed the InlineCheckoutDrawer in ChoosePlanSheet · zero
  // extra round-trips because we're already awaiting two things here.
  const [stats, stateCtx, settings, panoodSku] = await Promise.all([
    fetchAddOnStats(supabase, 'panood'),
    resolveAddOnState(
      supabase,
      eventId,
      'panood',
      'couple',
      `/dashboard/${eventId}/add-ons/panood/setup`,
    ),
    fetchPlatformSettings(supabase),
    formatV2Sku(PANOOD_SKU_CODE).catch(() => null),
  ]);
  const owned = stateCtx.state === 'launch';

  // Single per-day SKU, priced live from the admin catalog. The charge itself
  // is re-resolved server-side from PANOOD_SKU_CODE (the serviceKey), so this
  // price is for display; a catalog miss only blanks the label, never bills a
  // stale number.
  const dailyCentavos = panoodSku?.price_centavos ?? 0;
  const dailyPriceLabel = panoodSku ? formatPhp(panoodSku.price_php) : '—';
  const fromPriceFormatted = `${dailyPriceLabel} / day`;

  const dailyPlan = {
    sku_code: PANOOD_SKU_CODE,
    name: 'Daily Broadcast',
    scope: 'One day · always multi-cam (up to 6 cameras) · YouTube delivery + auto-archive.',
    price: dailyPriceLabel,
    unit: ' / day',
    badge: 'Most popular' as const,
    priceCentavos: String(dailyCentavos),
  };
  const planRow: PlanRow = {
    name: dailyPlan.name,
    scope: dailyPlan.scope,
    price: dailyPlan.price,
    unit: dailyPlan.unit,
    badge: dailyPlan.badge,
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
      value: dailyPriceLabel,
      caption: 'per day',
    },
  ];

  const heroCta = (
    <AddOnStateCta
      context={stateCtx}
      launchLabel="Launch"
      choosePlan={{
        eventId,
        triggerLabel: 'Add',
        priceFromLabel: fromPriceFormatted,
        // Single per-day plan. serviceKey = PANOOD_SKU_CODE so the drawer's
        // order re-resolves the price from the admin catalog; priceCentavos is
        // the live catalog price threaded through for the inline voucher math.
        plans: [
          {
            sku_code: dailyPlan.sku_code,
            name: dailyPlan.name,
            scope: dailyPlan.scope,
            price: dailyPlan.price,
            unit: dailyPlan.unit,
            badge: dailyPlan.badge,
            priceCentavos: dailyPlan.priceCentavos,
          },
        ],
        settings,
        introCopy:
          'Filipino weddings often have separate event-days for prep, ceremony, and reception — buy one Panood broadcast day per event-day.',
        footnote:
          'Apply-then-pay flow · we confirm price before payment · refunds follow the standard 24-hour SLA.',
      }}
    />
  );

  return (
    <AppStoreLayout
      back={{ href: `/dashboard/${eventId}/add-ons`, label: 'Back to add-ons' }}
      hero={{
        Icon: Tv,
        eyebrow: 'Panood · live broadcast',
        title: 'Broadcast your wedding live',
        tagline:
          'Stream to your own YouTube channel with one to five cameras. Family abroad watches in real time; you keep the archive forever.',
        statusPill:
          statusPillForState(stateCtx.state) ?? { label: 'Web V1', tone: 'accent' },
        cta: heroCta,
        secondary: owned ? (
          <Link
            href={`/dashboard/${eventId}/add-ons/panood/broadcast`}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-4 py-2 text-xs font-medium text-ink/75 transition-colors hover:bg-ink/5"
          >
            <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Broadcaster preview
          </Link>
        ) : null,
      }}
      stats={stats4}
      justLaunchedChip={stats.hasLaunchSignal ? null : 'Just launched · early access'}
      preview={[
        {
          context: 'Desktop',
          caption: 'Broadcaster grid — preview / program switcher, audio rail, highlight markers.',
          body: (
            <span>
              <span aria-hidden className="block text-3xl">
                ◧
              </span>
              <span className="mt-2 block text-[11px] text-ink/55">
                5 camera tiles · preview · program · take button
              </span>
            </span>
          ),
        },
        {
          context: 'Mobile',
          caption: 'Camera operator — WebRTC publish · no install · runs in any phone browser.',
          aspect: '9/16',
          body: (
            <span>
              <span aria-hidden className="block text-3xl">
                ▭
              </span>
              <span className="mt-2 block text-[11px] text-ink/55">
                Tap to claim cam · pinch to switch lens · slide to end
              </span>
            </span>
          ),
        },
        {
          context: 'Landing page',
          caption: 'Viewers see the broadcast embedded on your event page with your monogram.',
          body: (
            <span>
              <span aria-hidden className="block text-3xl">
                ▶
              </span>
              <span className="mt-2 block text-[11px] text-ink/55">
                YouTube IFrame Player · ~10s latency · unlimited audience
              </span>
            </span>
          ),
        },
        {
          context: 'Standby',
          caption: 'Custom standby cards — countdown, intermission, "Reception begins shortly."',
          body: (
            <span>
              <span aria-hidden className="block text-3xl">
                ◇
              </span>
              <span className="mt-2 block text-[11px] text-ink/55">
                Optional Custom Monogram pack overlays your monogram on every frame
              </span>
            </span>
          ),
        },
      ]}
      samples={[
        {
          title: 'Sample broadcast (15 s)',
          caption: 'Multi-cam ceremony with monogram overlay and lower-thirds.',
          badge: 'YouTube',
        },
      ]}
      description={{
        paragraphs: [
          'Panood turns five phones into a multi-cam wedding broadcast. One person runs the broadcaster on a laptop or tablet, switches between cameras, marks highlights, and decides when to cut to standby. Camera operators are friends or family with smartphones — no install, just open the link.',
          'Every broadcast goes to your own YouTube channel via a one-time OAuth grant. You control privacy (unlisted by default), you keep the archive forever, you can flip the broadcast to public after the event for sharing. Setnayan never holds the master tape.',
          `Panood is one Daily Broadcast (${dailyPriceLabel} / day · always multi-cam, up to 6 cameras). Filipino weddings often run across three days — prep at one venue, ceremony at another, reception at a third — so buy one Daily Broadcast per event-day.`,
        ],
        plans: [planRow],
        notIncluded: [
          'No human crew — you bring your own camera operators (friends or family with smartphones).',
          'No DSLR direct-to-broadcast in V1 — pair a DSLR via Pro Camera Bridge (phone-as-bridge, sold separately).',
          'No Facebook Live destination — couples wanting Facebook can re-broadcast the YouTube stream themselves.',
          'No portable hotspot rental — low-connectivity venues need their own backup data plan.',
        ],
      }}
      reviews={{
        href: `/dashboard/${eventId}/add-ons/panood/reviews`,
        avgRating: stats.avgRating,
        reviewCount: stats.reviewCount,
      }}
      privacy={[
        {
          category: 'Event details',
          items: ['Event date', 'Couple names', 'Venue address (for low-connectivity check)'],
          purpose: 'Used to label the broadcast and schedule the auto-archive.',
        },
        {
          category: 'YouTube channel access',
          items: [
            'Channel ID',
            'OAuth refresh token (revocable any time)',
            'Live broadcast metadata',
          ],
          purpose:
            'Required to create the live broadcast on your channel with monetization off + ultra-low latency.',
        },
        {
          category: 'Camera operator sessions',
          items: [
            'Per-camera session token (short-lived)',
            'Operator phone capability ping (bitrate, battery)',
          ],
          purpose: 'Lets the broadcaster show a health dot on each tile and warn before pauses.',
        },
        {
          category: 'Broadcast assets',
          items: [
            'Custom Monogram PNG (if uploaded)',
            'Standby card text',
            'Highlight markers (★ Mark presses)',
          ],
          purpose: 'Composited onto the live feed and stored alongside the YouTube archive.',
        },
      ]}
      dataLinked={{
        linked: [
          'Event ID + couple user ID — order history',
          'OAuth grant on your YouTube channel — refresh token (revocable)',
          'Uploaded monogram PNG (if used)',
          'Broadcast metadata (start/end time, camera count, highlight markers)',
        ],
        notLinked: [
          'Aggregate broadcast counts (no event linkage)',
          'Anonymous "% of weddings stream" stats',
          'Camera operator phone fingerprints (transient, dropped post-event)',
          'Audience analytics — held on YouTube under your channel, not Setnayan',
        ],
      }}
      accessibility={[
        {
          label: 'Keyboard shortcuts',
          detail:
            'Single-key cam preview (1–5) · Space to take preview to program · H mark highlight · L lower-third · S scene card · P picture-in-picture · Esc standby · Shift+E end stream confirm.',
        },
        {
          label: 'Destructive-action safety',
          detail:
            'End stream is hold-to-confirm on desktop (1.5 s fill) and slide-to-confirm on mobile. No single tap ever ends the broadcast.',
        },
        {
          label: 'Thumb-zone mobile broadcaster',
          detail:
            'Camera strip + Highlight + Standby + Lower-third all live in the bottom 30% of the screen. Long-tail actions tuck behind a More sheet.',
        },
        {
          label: 'Filipino language UI',
          detail: 'All Panood surfaces ship Filipino copy alongside English; pick once per event.',
        },
        {
          label: 'High-contrast standby cards',
          detail: 'WCAG AA contrast on every standby template; large type readable on a projector.',
        },
        {
          label: 'Captions on AI Highlight reels',
          detail: 'Auto-generated burned-in captions ship V1.1; soft captions ship at GA.',
        },
      ]}
    />
  );
}
