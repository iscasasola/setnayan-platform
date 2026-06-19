import {
  ADD_ONS,
  appStoreDetailHref,
  type AddOnEntry,
  type StudioGroup,
} from '@/lib/add-ons-catalog';
import { addOnDetail } from '@/lib/add-ons-detail';
import { formatPhp } from '@/lib/orders';
import { StudioAppRow, type RowPill } from './_components/studio-app-row';
import { StudioFeaturedCard } from './_components/studio-featured-card';
import { StudioSectionTabs } from './_components/studio-section-tabs';
import { createClient } from '@/lib/supabase/server';

// The cinema-poster card (service-poster.tsx) still owns the `PosterStyle`
// type that the catalog + Services tab consume, so it is intentionally kept.
export type { PosterStyle } from './_components/service-poster';

export const metadata = { title: 'Studio' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * Studio hub — an iOS App Store-style browse surface for every Setnayan in-app
 * service (owner 2026-06-19: "Studio should look like the App Store so we can
 * see info on each feature"). Four sections (the locked Studio sub-nav): each
 * leads with a featured hero, then lists the rest as App Store rows. Tapping a
 * feature opens its App Store detail page (catalog-driven, app-store/layout.tsx).
 *
 * Pricing on the GET/price pills renders LIVE from the admin catalog
 * (platform_retail_catalog_v2) — never hardcoded.
 */

const SECTIONS: ReadonlyArray<{
  group: StudioGroup;
  label: string;
  anchor: string;
  /** Preferred featured-hero key; falls back to the first available item. */
  flagship: string;
}> = [
  { group: 'setnayan_ai', label: 'Setnayan AI', anchor: 'studio-ai', flagship: 'setnayan-ai' },
  { group: 'website', label: 'Website', anchor: 'studio-website', flagship: 'save-the-date' },
  { group: 'capture', label: 'Capture', anchor: 'studio-capture', flagship: 'papic' },
  { group: 'branding', label: 'Branding', anchor: 'studio-branding', flagship: 'animated-monogram' },
];

/** Available add-ons first; coming-soon sinks to the bottom (stable order). */
function comingSoonLast(a: AddOnEntry, b: AddOnEntry): number {
  const av = a.status === 'coming_soon' ? 1 : 0;
  const bv = b.status === 'coming_soon' ? 1 : 0;
  return av - bv;
}

export default async function StudioPage({ params }: Props) {
  const { eventId } = await params;

  const supabase = await createClient();

  // Live order status per service_key (ownership/pending badges) + live admin
  // catalog prices for the GET pills — fetched together.
  const serviceKeys = Array.from(
    new Set(ADD_ONS.map((a) => a.serviceKey).filter((k): k is string => Boolean(k))),
  );
  const [{ data: liveOrders }, { data: priceRows }] = await Promise.all([
    supabase
      .from('orders')
      .select('service_key, status')
      .eq('event_id', eventId)
      .not('status', 'in', '("cancelled","refunded","lapsed")'),
    supabase
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php')
      .in('service_code', serviceKeys),
  ]);

  const orderStatusMap = new Map<string, string>();
  for (const o of liveOrders ?? []) {
    if (o.service_key && !orderStatusMap.has(o.service_key)) {
      orderStatusMap.set(o.service_key, o.status as string);
    }
  }
  const priceMap = new Map<string, string>();
  for (const r of priceRows ?? []) {
    if (r.service_code != null && r.retail_price_php != null) {
      priceMap.set(r.service_code as string, formatPhp(Number(r.retail_price_php)));
    }
  }

  // Resolve the App Store-style pill (price/status) for an entry.
  function pillFor(entry: AddOnEntry): RowPill {
    if (entry.status === 'coming_soon') return { text: 'Soon', tone: 'soon' };
    const status = entry.serviceKey ? orderStatusMap.get(entry.serviceKey) : null;
    if (status === 'paid' || status === 'fulfilled') return { text: 'Active', tone: 'active' };
    if (status === 'submitted' || status === 'awaiting_payment')
      return { text: 'Pending', tone: 'pending' };
    if (entry.tier === 'free') return { text: 'Free', tone: 'free' };
    if (entry.freeTrial) return { text: entry.freeTrial, tone: 'trial' };
    const price = entry.serviceKey ? priceMap.get(entry.serviceKey) : null;
    return { text: price ?? 'Get', tone: 'price' };
  }

  const tabs = SECTIONS.map((s) => ({ id: s.anchor, label: s.label }));

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta-600">
          Studio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Everything you can make with Setnayan
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Browse the tools you can add to your event — from candid capture to
          your public website, planning aids, and music. Tap any one to see what
          it does. New ones light up as they ship.
        </p>
      </header>

      {/* Alaala — the pillar framing. The memory features (capture · website &
          story · music) are the pieces of the couple's living memory. */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta-600">
          Alaala · the memory you keep
        </p>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink">
          The pieces below become your <span className="italic">Alaala</span> — the living memory of
          your day. The moments you’ll be too busy to see, the people who can’t be there, the stories
          your guests tell — all kept, and made into something you hold forever.
        </p>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink/60">
          And it never gets in the way. The day stays yours — the tech just quietly remembers it.
        </p>
      </div>

      <StudioSectionTabs tabs={tabs} />

      {SECTIONS.map(({ group, label, anchor, flagship }) => {
        const addOns = ADD_ONS.filter((a) => a.studioGroup === group)
          .slice()
          .sort(comingSoonLast);
        if (addOns.length === 0) return null;

        // Featured hero = the preferred flagship if it's available, else the
        // first available item. Coming-soon never gets featured.
        const available = addOns.filter((a) => a.status !== 'coming_soon');
        const featured =
          available.find((a) => a.key === flagship) ?? available[0] ?? null;
        const rows = addOns.filter((a) => a.key !== featured?.key);

        return (
          <div key={group} id={anchor} className="scroll-mt-24 space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{label}</h2>

            {featured ? (
              <StudioFeaturedCard
                href={appStoreDetailHref(featured.key, eventId)}
                eyebrow={label}
                label={featured.label}
                tagline={addOnDetail(featured.key)?.tagline ?? featured.blurb}
                Icon={featured.Icon}
                gradient={featured.poster.baseBackground}
                pillText={pillFor(featured)?.text ?? 'Open'}
              />
            ) : null}

            {rows.length > 0 ? (
              <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-cream">
                {rows.map((addon) => {
                  const comingSoon = addon.status === 'coming_soon';
                  return (
                    <StudioAppRow
                      key={addon.key}
                      href={comingSoon ? null : appStoreDetailHref(addon.key, eventId)}
                      label={addon.label}
                      blurb={addon.blurb}
                      Icon={addon.Icon}
                      gradient={addon.poster.baseBackground}
                      pill={pillFor(addon)}
                    />
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
