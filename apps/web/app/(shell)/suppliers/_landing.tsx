/**
 * The one renderer behind every /suppliers landing page — nationwide
 * (`/suppliers/[event]/[category]`) and per city
 * (`/suppliers/[event]/[category]/[city]`). See `lib/supplier-landing.ts` for
 * what the pages are and why the gate exists.
 *
 * ⚠ NO `loading.tsx` MAY LIVE UNDER /suppliers. A loading boundary streams and
 * commits HTTP 200 before `notFound()` runs, so a mistyped
 * /suppliers/debutt/cake would answer 200 with "not found" in it — a soft 404
 * that Google indexes. The same rule `app/help/[slug]` records.
 *
 * ⚠ EVERY FIGURE ON THIS PAGE IS READ FROM THE CARDS. Nothing here is a typed
 * number: the counts, the ranges and the medians come from `priceSummaries`,
 * and a shop that hides its prices contributes none of them.
 *
 * 🔑 COUPLE-FACING. The commission line is `COUPLE_COMMISSION_PROMISE` — the
 * unqualified zero a couple is owed (owner 2026-09-22) — never the supplier
 * form with the fee.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { ServiceCardView } from '@/app/_components/service-card-view';
import { buildServiceCardFaces } from '@/lib/service-card-faces';
import { loadLandingCards, type LandingSource } from '@/lib/supplier-landing-data';
import {
  cardsForPage,
  cityName,
  eventKeyFromSlug,
  isCityKey,
  isIndexable,
  pagePath,
  priceSummaries,
  qualifyingPages,
  shopCount,
  tileFromSlug,
  type BasisSummary,
  type PageKey,
} from '@/lib/supplier-landing';
import { formatPhp } from '@/lib/php';
import { COUPLE_COMMISSION_PROMISE } from '@/lib/commission-promise';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

/** How many cards one page draws. The rest are one tap away on /explore. */
const CARDS_SHOWN = 48;

export type LandingParams = { event: string; category: string; city?: string };

type Resolved = {
  page: PageKey;
  source: LandingSource;
  eventLabel: string;
  tileLabel: string;
  place: string;
};

/** Slugs → a real page, or null (→ 404). Never a fallback to a nearby page. */
async function resolve(params: LandingParams): Promise<Resolved | null> {
  const source = await loadLandingCards();
  const event = eventKeyFromSlug(params.event, [...source.eventLabel.keys()]);
  const tile = tileFromSlug(params.category, source.taxonomy.tileSlug);
  if (!event || !tile) return null;
  if (!source.tileServesEvent(tile, event)) return null;
  if (source.taxonomy.hiddenCategories[tile]) return null;
  const city = params.city ?? null;
  if (city !== null && !isCityKey(city)) return null;
  return {
    page: { event, tile, city },
    source,
    eventLabel: source.eventLabel.get(event) ?? event,
    tileLabel: source.taxonomy.tileLabel[tile] ?? tile,
    place: city ? cityName(city) : 'the Philippines',
  };
}

function heading(r: Resolved): string {
  return `${r.eventLabel} ${r.tileLabel} in ${r.place}`;
}

const BASIS_UNIT: Record<BasisSummary['basis'], string> = {
  fixed: 'package price',
  per_pax: 'per guest',
  per_hour: 'base price for the hours they quote',
};

function basisSentence(s: BasisSummary): string {
  const unit = BASIS_UNIT[s.basis];
  if (s.count === 1) return `One is priced at ${formatPhp(s.low)} (${unit}).`;
  return `${s.count} list a ${unit} from ${formatPhp(s.low)} to ${formatPhp(s.high)}, with a median of ${formatPhp(s.median)}.`;
}

export async function landingMetadata(params: LandingParams): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) notFound();
  const cards = cardsForPage(r.source.cards, r.page);
  const shops = shopCount(cards);
  const fixed = priceSummaries(cards).find((s) => s.basis === 'fixed');
  const path = pagePath(r.page, r.source.taxonomy.tileSlug);
  const title = heading(r);
  const description =
    cards.length === 0
      ? `Verified ${r.tileLabel.toLowerCase()} suppliers for a ${r.eventLabel.toLowerCase()} in ${r.place}, on Setnayan.`
      : `${cards.length} ${r.tileLabel.toLowerCase()} services for a ${r.eventLabel.toLowerCase()} in ${r.place} from ${shops} verified Filipino supplier${shops === 1 ? '' : 's'}` +
        (fixed ? `, packages from ${formatPhp(fixed.low)}` : '') +
        '. Real prices from the suppliers themselves. 0% commission — you pay them directly.';
  return {
    title,
    description,
    alternates: { canonical: path },
    // 🔑 THE GATE. Below it, the page is for the person who lands here — not
    // for Google. `follow` stays on so the links it carries still count.
    robots: { index: isIndexable(cards), follow: true },
    openGraph: { title: `${title} · Setnayan`, description, url: path, type: 'website', siteName: 'Setnayan' },
  };
}

export async function SupplierLanding({ params }: { params: LandingParams }) {
  const r = await resolve(params);
  if (!r) notFound();
  const { page, source, eventLabel, tileLabel, place } = r;

  const cards = cardsForPage(source.cards, page);
  const shops = shopCount(cards);
  const summaries = priceSummaries(cards);
  const shown = new Set(cards.slice(0, CARDS_SHOWN).map((c) => c.serviceId));
  const faceRows = source.faces.filter((f) => shown.has(f.row.vendor_service_id));
  const faces = await buildServiceCardFaces(createAdminClient(), faceRows, source.eventLabel, new Date());

  const title = heading(r);
  const path = pagePath(page, source.taxonomy.tileSlug);
  const tileSlug = source.taxonomy.tileSlug;
  const qualifying = qualifyingPages(source.cards, source.tileServesEvent);
  const otherCities = qualifying.filter(
    (p) => p.event === page.event && p.tile === page.tile && p.city !== null && p.city !== page.city,
  );
  const otherTiles = qualifying.filter(
    (p) => p.event === page.event && p.city === page.city && p.tile !== page.tile,
  );
  const nationwide = page.city ? { ...page, city: null } : null;
  const eventLower = eventLabel.toLowerCase();
  const tileLower = tileLabel.toLowerCase();

  const costAnswer =
    summaries.length === 0
      ? `The ${tileLower} suppliers here quote on request — message them from Setnayan for a price.`
      : `On Setnayan, ${cards.length} ${tileLower} service${cards.length === 1 ? '' : 's'} for a ${eventLower} in ${place} come from ${shops} verified supplier${shops === 1 ? '' : 's'}. ` +
        summaries.map(basisSentence).join(' ') +
        ' These are the suppliers’ own published starting prices, read live.';
  const faq = [
    { q: `How much does a ${eventLower} ${tileLower} cost in ${place}?`, a: costAnswer },
    {
      q: `Are these ${tileLower} suppliers verified?`,
      a: 'Yes. Every supplier listed on Setnayan completed a business-legitimacy check and a video call with a Setnayan admin, and shows its real business name.',
    },
    { q: 'Does Setnayan take a commission?', a: COUPLE_COMMISSION_PROMISE },
  ];

  const url = `${SITE_URL}${path}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Suppliers', item: `${SITE_URL}/suppliers` },
          ...(nationwide
            ? [{ '@type': 'ListItem', position: 3, name: `${eventLabel} ${tileLabel}`, item: `${SITE_URL}${pagePath(nationwide, tileSlug)}` }]
            : []),
          { '@type': 'ListItem', position: nationwide ? 4 : 3, name: title, item: url },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#list`,
        name: title,
        numberOfItems: cards.length,
        itemListElement: faces.map((f, i) => {
          const c = cards.find((x) => x.serviceId === f.key);
          return {
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'Service',
              name: f.card.label || tileLabel,
              serviceType: tileLabel,
              areaServed: place,
              provider: { '@type': 'LocalBusiness', name: f.shop.name, ...(f.shop.href ? { url: `${SITE_URL}${f.shop.href}` } : {}) },
              // Hidden prices are null in the LandingCard — they never reach this.
              ...(c && c.pricePhp !== null && c.pricingBasis === 'fixed'
                ? { offers: { '@type': 'Offer', price: String(c.pricePhp), priceCurrency: 'PHP' } }
                : {}),
            },
          };
        }),
      },
      ...(summaries.some((s) => s.basis === 'fixed')
        ? [
            {
              '@type': 'Service',
              name: title,
              serviceType: tileLabel,
              areaServed: place,
              offers: (() => {
                const s = summaries.find((x) => x.basis === 'fixed')!;
                return { '@type': 'AggregateOffer', lowPrice: String(s.low), highPrice: String(s.high), offerCount: s.count, priceCurrency: 'PHP' };
              })(),
            },
          ]
        : []),
      ...(cards.length > 0
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
            },
          ]
        : []),
    ],
  };

  return (
    <main className="min-h-dvh bg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-sm text-ink/60">
          <Link href="/suppliers" className="underline-offset-4 hover:underline">Suppliers</Link>
          {nationwide ? (
            <>
              {' · '}
              <Link href={pagePath(nationwide, tileSlug)} className="underline-offset-4 hover:underline">
                {eventLabel} {tileLabel}
              </Link>
            </>
          ) : null}
        </nav>

        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>

        {cards.length === 0 ? (
          <div className="mt-4 max-w-2xl space-y-3 text-base text-ink/70">
            <p>
              No verified supplier has published a {tileLower} service for a {eventLower} in {place} yet. This page fills
              itself the moment one does.
            </p>
            <p>
              <Link href="/explore" className="font-medium text-ink underline underline-offset-4">Browse every verified supplier</Link>
              {nationwide ? (
                <>
                  {' · '}
                  <Link href={pagePath(nationwide, tileSlug)} className="font-medium text-ink underline underline-offset-4">
                    {eventLabel} {tileLower} anywhere in the Philippines
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-4 max-w-2xl text-base text-ink/70">
              {cards.length} service{cards.length === 1 ? '' : 's'} from {shops} verified Filipino supplier
              {shops === 1 ? '' : 's'}, with the prices they publish themselves. You message them from Setnayan and pay
              them directly.
            </p>

            {summaries.length > 0 ? (
              <section aria-labelledby="what-it-costs" className="mt-8 max-w-2xl">
                <h2 id="what-it-costs" className="text-lg font-semibold">What it costs</h2>
                <ul className="mt-2 space-y-1 text-base text-ink/75">
                  {summaries.map((s) => (
                    <li key={s.basis}>{basisSentence(s)}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {faces.map((f) => (
                <li key={f.key}>
                  <ServiceCardView card={f.card} detailsEnabled detailsHref={f.detailsHref} shop={f.shop} />
                </li>
              ))}
            </ul>
            {cards.length > CARDS_SHOWN ? (
              <p className="mt-4 text-sm text-ink/60">
                Showing {CARDS_SHOWN} of {cards.length}.{' '}
                <Link href="/explore" className="underline underline-offset-4">See them all on the marketplace</Link>
              </p>
            ) : null}

            <section aria-labelledby="questions" className="mt-12 max-w-2xl">
              <h2 id="questions" className="text-lg font-semibold">Questions people ask</h2>
              <dl className="mt-3 space-y-5">
                {faq.map((f) => (
                  <div key={f.q}>
                    <dt className="font-medium">{f.q}</dt>
                    <dd className="mt-1 text-ink/75">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}

        {otherCities.length > 0 || otherTiles.length > 0 ? (
          <section aria-labelledby="nearby" className="mt-12 max-w-3xl">
            <h2 id="nearby" className="text-lg font-semibold">Also on Setnayan</h2>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-base">
              {[...otherCities, ...otherTiles].slice(0, 24).map((p) => (
                <li key={pagePath(p, tileSlug)}>
                  <Link href={pagePath(p, tileSlug)} className="underline underline-offset-4">
                    {source.eventLabel.get(p.event) ?? p.event} {source.taxonomy.tileLabel[p.tile] ?? p.tile} in{' '}
                    {p.city ? cityName(p.city) : 'the Philippines'}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-12 max-w-2xl border-t border-ink/10 pt-8">
          <h2 className="text-lg font-semibold">Planning a {eventLower}?</h2>
          <p className="mt-2 text-ink/75">
            Setnayan is free to plan with — guest list, RSVP, seat plan, budget and schedule — and every supplier here
            is one message away from it.
          </p>
          <p className="mt-3">
            <Link href="/signup" className="font-medium text-ink underline underline-offset-4">Start planning free</Link>
            {' · '}
            <Link href="/vendors" className="text-ink/70 underline underline-offset-4">Are you a supplier? List your services</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
