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

// Iteration 0011 — Panood App Store-style detail surface.
//
// Replaces the prior single-page setup wall (now moved to ./setup/page.tsx).
// On this page couples discover, compare, and buy; once they own a plan,
// the hero CTA flips to "Open Panood setup" and routes into the setup
// surface that holds YouTube OAuth, broadcaster + camera-operator links.
//
// Decision log row 2026-05-17: this is the pilot for the App Store pattern.
// The shared layout in app/_components/app-store/* will fan out to the
// other 8 add-ons + vendor service detail pages after Panood validates.
//
// Pricing source of truth: service_catalog rows (V1 lock 2026-05-16). The
// page reads PHP centavos and renders via formatPhp(). Tokens are NOT
// surfaced — that retirement is in the 2026-05-11 decision log.

export const metadata = { title: 'Panood · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

// SKU rows shown in the description's Plans & pricing table AND in the
// Choose-plan sheet. Mirrors V1 SKU lock; if the catalog moves, this list
// follows. Price in PHP centavos so we format once at render time.
type PanoodSku = {
  sku_code: string;
  name: string;
  scope: string;
  centavos: number;
  unit: string;
  badge?: string;
};

const PANOOD_SKUS: ReadonlyArray<PanoodSku> = [
  {
    sku_code: 'panood_daily_broadcast',
    name: 'Daily Broadcast',
    scope: 'One day · single-cam by default · YouTube delivery + auto-archive.',
    centavos: 49900,
    unit: ' / day',
    badge: 'Most popular',
  },
  {
    sku_code: 'panood_camera_sync',
    name: 'Camera Sync (multi-cam)',
    scope: 'Pair with Daily Broadcast to unlock multi-cam switching for that day.',
    centavos: 9900,
    unit: ' / day',
  },
  {
    sku_code: 'panood_annual_streaming',
    name: 'Annual Streaming',
    scope: 'Unlimited single-cam days for a year. Best for vendors streaming year-round.',
    centavos: 299900,
    unit: ' / year',
  },
  {
    sku_code: 'panood_annual_streaming_plus',
    name: 'Annual Streaming Plus',
    scope: 'Unlimited multi-cam days for a year. Camera Sync included.',
    centavos: 399900,
    unit: ' / year',
  },
  {
    sku_code: 'ai_video_highlight_60s',
    name: 'AI Video Highlight',
    scope: '60-second compiled reel from your broadcast archive. Multi-purchase.',
    centavos: 99900,
    unit: ' / 60s',
  },
  {
    sku_code: 'ai_edited_highlight_3min',
    name: 'AI Edited Highlight',
    scope: '3-minute storyline cut — beats, music, pacing chosen by Claude vision.',
    centavos: 349900,
    unit: ' / 3 min',
  },
  {
    sku_code: 'same_day_edit',
    name: 'Same-Day Edit',
    scope:
      'Cinematic 3–5 minute film, delivered before the reception ends. Played live on the LED background screen at the climactic moment.',
    centavos: 999900,
    unit: ' / event',
    badge: 'Flagship',
  },
];

function toPlan(sku: PanoodSku): PlanRow {
  return {
    name: sku.name,
    scope: sku.scope,
    price: formatPhp(sku.centavos / 100),
    unit: sku.unit,
    badge: sku.badge,
  };
}

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

  const [stats, stateCtx] = await Promise.all([
    fetchAddOnStats(supabase, 'panood'),
    resolveAddOnState(
      supabase,
      eventId,
      'panood',
      'couple',
      `/dashboard/${eventId}/add-ons/panood/setup`,
    ),
  ]);
  const owned = stateCtx.state === 'launch';

  const fromPriceCentavos = Math.min(...PANOOD_SKUS.map((s) => s.centavos));
  const fromPriceFormatted = `${formatPhp(fromPriceCentavos / 100)} / day`;

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
      eyebrow: 'Pricing from',
      value: formatPhp(fromPriceCentavos / 100),
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
        priceFromLabel: `From ${fromPriceFormatted}`,
        plans: PANOOD_SKUS.map((s) => ({
          sku_code: s.sku_code,
          name: s.name,
          scope: s.scope,
          price: formatPhp(s.centavos / 100),
          unit: s.unit,
          badge: s.badge,
        })),
        introCopy:
          'Filipino weddings often have separate event-days for prep, ceremony, and reception. Buy one day per broadcast day, or unlock the full year with an Annual plan.',
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
        {
          title: 'AI Video Highlight',
          caption: 'Auto-compiled 60-second reel pulled from highlight markers.',
          badge: 'MP4 · 60s',
        },
        {
          title: 'Same-Day Edit teaser',
          caption: 'A 3-minute cinematic cut delivered before the reception ends.',
          badge: 'Flagship',
        },
      ]}
      description={{
        paragraphs: [
          'Panood turns five phones into a multi-cam wedding broadcast. One person runs the broadcaster on a laptop or tablet, switches between cameras, marks highlights, and decides when to cut to standby. Camera operators are friends or family with smartphones — no install, just open the link.',
          'Every broadcast goes to your own YouTube channel via a one-time OAuth grant. You control privacy (unlisted by default), you keep the archive forever, you can flip the broadcast to public after the event for sharing. Setnayan never holds the master tape.',
          'The base plan is Daily Broadcast (₱499 / day). Filipino weddings often run across three days — prep at one venue, ceremony at another, reception at a third — and you can buy one Daily Broadcast per day. Pair with Camera Sync (₱99 / day) to unlock multi-cam switching for that day.',
        ],
        plans: PANOOD_SKUS.map(toPlan),
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
