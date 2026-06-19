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
        eyebrow: 'Panood',
        title: 'No one misses your day.',
        tagline:
          'Family abroad, friends who couldn’t fly in, lola in the province — all watching live as it happens. And the whole day is yours to keep, forever.',
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
          context: 'Watching live',
          caption: 'Family anywhere watches it happen, in real time.',
          body: (
            <span>
              <span aria-hidden className="block text-3xl">
                ▶
              </span>
              <span className="mt-2 block text-[11px] text-ink/55">
                No matter where they are
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
          context: 'Every angle',
          caption: 'The aisle, the altar, the happy tears — all covered.',
          body: (
            <span aria-hidden className="block text-3xl">
              ◧
            </span>
          ),
        },
        {
          context: 'Yours forever',
          caption: 'Saved for you to rewatch any time.',
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
          'Everyone watching live, wherever they are',
          'Every angle — the aisle, the altar, the happy tears',
          'Right on your wedding page, in your colors',
          'The whole day, saved for you to keep',
        ],
      }}
      description={{
        paragraphs: [
          'Half the people who love you can’t fit in the room — or can’t make the trip at all. Panood brings them in. Your wedding streams live, so the people who matter are there for every moment as it happens.',
          'And it doesn’t end when the day does. The whole celebration is saved for you — rewatch the vows, the first dance, the speeches, any time you want.',
          `Panood covers one day of your celebration (${dailyPriceLabel} / day), from up to six angles. Filipino weddings often run across a few days — prep, ceremony, reception — so add a day for each.`,
        ],
        plans: [planRow],
        notIncluded: [
          'Your camera people are friends or family with phones — not a hired crew.',
          'Streams to YouTube, not Facebook.',
        ],
      }}
      reviews={{
        href: `/dashboard/${eventId}/add-ons/panood/reviews`,
        avgRating: stats.avgRating,
        reviewCount: stats.reviewCount,
      }}
    />
  );
}
