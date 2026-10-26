import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { GuestSpotlight } from '@/app/_components/guest-spotlight';
import { PAPIC_FREE_CREDIT_CONDITION } from '@/lib/papic-free-credit-promise';
import { fetchV2VendorCatalog, formatPeso, type BuildStatus } from '@/lib/v2-catalog';
import { COMMISSION_PCT, supplierCommissionShort } from '@/lib/commission-promise';
import { getLiveBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { PASS_CARD_DESIGNS } from '@/lib/pass-card';
import { PRO_THEMES } from '@/lib/invite-themes';
import { TOURS } from '@/lib/tours';
import { readOurPrices, papicRungWords } from './_pricing-reads';
// The client pieces — Event Hub Pro's one dropdown, and the included group's "See all included ↓". Figures arrive formatted.
import { HubProWays, IncludedGroup, PriceRowShell, type IncludedRow } from './_pricing-pickers';

/**
 * /pricing — OURS ONLY, QUALITY-LED (owner 2026-10-25, verbatim: "Yes, build this pricing page and the questionnaire
 * into the app." Earlier the same day: "I was told never to compare so i do not look cheap" · "Just focus on our free
 * and prices and do not compare" · "no saying free. let us promote premium quality … why it is the best place to build
 * your events" · "the paid parts look like event hub does not have a free version").
 *
 * THE CONTRACT: corpus `prototypes/pricing_ours_only_2026-10-25/index.html` (revision 5). Five parts, nothing else:
 *   1 · hero · 2 · Why Setnayan (four pictures) · 3 · Better together (three rows) · 4 · Prices (Included with every
 *   event, then the paid ones by moment) · 5 · Close.
 * No other company, no "elsewhere", no saving, no giveaway pitch — the included things say "Included".
 *
 * 🔑 EVERY PESO IS READ from `platform_retail_catalog_v2` (`./_pricing-reads.ts`). A missing row draws no figure, and an
 * item with no figure is not drawn. Guarded by `pricing-ours-only.test.ts`.
 *
 * ⚠ `dynamic` IS DECLARED ONCE, ON `app/(shell)/layout.tsx`, NOT HERE (a layout's `dynamic` covers its children).
 *
 * ⚖ THE AUDIENCE RULE (owner 2026-09-22, R7; audit 2026-10-12 E4). The share lines are read by couples AND suppliers:
 * "0% commission" is a couple's unqualified truth; a supplier also pays a booking fee on couples we introduce, so every
 * share line names it.
 */
export const metadata = {
  title: 'Pricing',
  description:
    `The best place to build your event — beautifully made, for you and the people you know. Paid once, for the event and everyone on it, in Philippine peso. ${COMMISSION_PCT}% commission on supplier bookings — couples pay suppliers directly. Suppliers pay Setnayan a booking fee only on couples we introduce.`,
  alternates: { canonical: '/pricing' },
  openGraph: {
    images: BRAND_OG_IMAGES,
    title: 'Pricing · Setnayan',
    description:
      `Crafted for every event — everything to plan is included, and what you add is paid once for the event. Couples pay suppliers directly — ${COMMISSION_PCT}% commission. Suppliers pay a booking fee only on couples we introduce.`,
    url: '/pricing',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    images: BRAND_TWITTER_IMAGES,
    card: 'summary_large_image',
    title: 'Pricing · Setnayan',
    description: `The best place to build your event · paid once per event · ${COMMISSION_PCT}% commission · suppliers pay a booking fee only on couples we introduce.`,
  },
};

/** The prototype's `.wrap` inside the shell's column: 16 px from the edge on a phone (the shell's own inset), the
 *  prototype's 56 + 16 px from the rail on a wide screen, 720 px at most. */
const WRAP = 'max-w-[784px] lg:px-12';
const KICK = 'm-eyebrow';
const H2 = 'm-0 mt-3 font-pahina text-[30px] font-normal leading-[1.1] tracking-[-0.015em] lg:mt-4';
const LINE = 'm-0 mt-2.5 max-w-[34ch] text-[16.5px] leading-normal text-ink/65 lg:mt-3';

/**
 * A product picture, cropped the way the prototype crops it (its `still_*.jpg` were cut from these same captures): the
 * 460 × 972 phone capture fills the frame's width, `y` picks the band, `zoom` trims the sides.
 */
function Shot({ src, y, zoom, sizes }: { src: string; y: string; zoom: number; sizes: string }) {
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      className="object-cover saturate-[.9]"
      style={{ objectPosition: `50% ${y}`, transform: `scale(${zoom})` }}
    />
  );
}

function WhyShot(props: { src: string; y: string; zoom: number }) {
  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl lg:aspect-[4/3]">
      <Shot {...props} sizes="(min-width: 1024px) 180px, 45vw" />
    </div>
  );
}

/** The fourth "Why" point has no product shot; it wears a drawn lock tile (prototype revision 4, reported). */
function LockTile() {
  return (
    <div className="grid aspect-[3/2] w-full place-items-center rounded-xl border border-terracotta-700/20 bg-cream lg:aspect-[4/3]">
      <svg viewBox="0 0 24 24" aria-hidden className="h-[38px] w-[38px] fill-none stroke-terracotta-700" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    </div>
  );
}

/** `align`: the right-hand picture of a phone's two columns hangs its ⓘ from the right, or the popover runs off the page. */
function WhyPoint({ shot, title, line, tip, align = 'start' }: { shot: ReactNode; title: string; line: string; tip: string; align?: 'start' | 'end' }) {
  return (
    <li>
      {shot}
      <p className="m-0 mt-3 font-pahina text-[18.5px] leading-[1.15] tracking-[-0.01em]">{title}</p>
      <div className="mt-1 text-[13.5px] leading-snug text-ink/65">
        <InfoTip label={line} align={align}>
          {tip}
        </InfoTip>
      </div>
    </li>
  );
}

function TogetherRow({ icon, title, line, tip }: { icon: ReactNode; title: string; line: string; tip: string }) {
  return (
    <li className="flex items-start gap-3.5 border-t border-ink/10 py-3 first:border-t-0 first:pt-1 lg:py-4">
      <svg viewBox="0 0 24 24" aria-hidden className="mt-0.5 h-6 w-6 shrink-0 fill-none stroke-terracotta-700" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      <div>
        <p className="m-0 font-pahina text-xl leading-[1.15] tracking-[-0.01em]">{title}</p>
        <div className="mt-[3px] text-sm leading-snug text-ink/65">
          <InfoTip label={line} align="start">
            {tip}
          </InfoTip>
        </div>
      </div>
    </li>
  );
}

/** A small moment label in the price list ("On the day"). */
function Moment({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 pb-1 pt-5 font-mono text-[10.5px] uppercase leading-none tracking-[0.16em] text-terracotta-700">
      {children}
    </p>
  );
}

/** "from ₱70" · "₱1,500 a day" — the figure, with its small words. */
function Figure({ php, from = false, suffix }: { php: number; from?: boolean; suffix?: string }) {
  return (
    <>
      {from ? <small className="mr-1 font-sans text-xs text-ink/65">from</small> : null}₱{formatPeso(php)}
      {suffix ? <small className="ml-1 font-sans text-xs text-ink/65">{suffix}</small> : null}
    </>
  );
}

export default async function PricingPage() {
  // Reads in parallel · each degrades to no rows, so the page renders with no figure rather than 500'ing.
  const [{ prices, customerSkus }, vendorSkus, feeSchedule] = await Promise.all([
    readOurPrices(),
    // The supplier plans and the LIVE booking-fee schedule, for the structured data only (never the code default —
    // audit 2026-10-12, item 5).
    fetchV2VendorCatalog(),
    getLiveBookingFeeSchedule(),
  ]);

  const peso = (n: number) => `₱${formatPeso(n)}`;
  const papicFrom = prices.papicRungs[0] ?? null;
  const papicCheaperAtSetup = prices.papicRungs.some((r) => r.signup != null);
  const aiBands = Object.values(prices.ai);
  const aiFrom = aiBands.length ? Math.min(...aiBands.map((b) => b.regular)) : null;
  const aiWedding = prices.ai.A ?? null;
  const aiDate = prices.ai.D ?? null;
  const partsFrom = prices.hubParts.length ? Math.min(...prices.hubParts.map((p) => p.php)) : null;
  // Counts said as words, as the prototype says them — derived, never typed (`lib/free-themes-are-free.test.ts`).
  const word = (n: number) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);
  const passStyles = word(PASS_CARD_DESIGNS.length);
  const proThemes = word(PRO_THEMES.length).replace(/^./, (c) => c.toUpperCase());

  // INCLUDED WITH EVERY EVENT — the verified set of `pricing_free_plus_addons_2026-10-25` revision 4 (each tied to a
  // ruling and a gate). First six shown; the rest open in place.
  const included: IncludedRow[] = [
    {
      name: 'The Event Hub',
      tip: 'A complete design written from your details, all five stages — Save-the-Date, RSVP, the day, Memories, Post Event. Yours with every event; Pro changes only how it looks.',
      what: 'A complete design, your details in it, all five stages.',
    },
    { name: 'Guest list & RSVPs', tip: 'No limit on guests; each replies by link, without an account.', what: 'No limit; guests reply by link.' },
    {
      name: 'Seat plan with 3D',
      tip: 'Lay the tables out in 2D and walk the room in 3D; guests find their seat on their pass.',
      what: 'Lay it out, then walk the room.',
    },
    {
      name: 'Budget & schedule',
      tip: 'Your budget with every payment tracked, and the day’s timeline from preparation to the last dance.',
      what: 'Every payment and the day’s timeline.',
    },
    {
      name: 'Suppliers',
      tip: `Find, compare and book verified suppliers; you pay them directly and Setnayan takes ${COMMISSION_PCT}% commission.`,
      what: `Find, compare, book — ${COMMISSION_PCT}% commission.`,
    },
    {
      name: 'Door check-in by QR',
      tip: 'Your door crew scans each guest’s own QR on a phone; arrivals, plus-ones and tables, live.',
      what: 'Scan each guest’s pass at the door, live.',
    },
    {
      name: 'Guest tickets',
      tip: `Each guest keeps a pass with their name and QR, in one of ${passStyles} styles.`,
      what: `Each guest’s own pass, ${passStyles} styles.`,
    },
    {
      name: 'Printables',
      tip: 'Guest registry, QR codes, seat plan, table signs and place cards, meal counts — print-ready files. Prints in your Event Hub look are part of Pro.',
      what: 'Registry, QR codes, seat plan, signs, meal counts.',
    },
    {
      name: 'Livestream, one camera',
      tip: 'One camera streams to everyone who can’t be there. Every camera at once is Live Watch, below.',
      what: 'One camera, live to everyone who can’t be there.',
    },
    { name: 'Memories', tip: 'Every photo from the event in one place, for you and your guests.', what: 'Every photo, in one place.' },
    {
      name: 'Papic credits, first event',
      tip: 'Your first event comes with credits for every guest’s camera; top-ups are below.',
      what: `Credits for every guest’s camera, ${PAPIC_FREE_CREDIT_CONDITION}.`,
    },
  ];

  const onTheDay = Boolean(papicFrom || prices.liveWatch || prices.patiktok);
  const after = Boolean(prices.thankYou || prices.musicMaker);

  /*
    THE STRUCTURED DATA (unchanged): every active customer SKU as a Product, every supplier plan as a Service with its
    fee sentence. Search engines read it; a person never sees it.
  */
  const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');
  const ORGANIZATION_REF = { '@id': `${SITE_URL}/#organization` };
  const buildAvailability = (status: BuildStatus): string =>
    status === 'not_built' ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock';
  const vendorSubs = vendorSkus.filter((s) => s.offering_type === 'subscription_monthly');
  const vendorAnnualSubs = vendorSkus.filter((s) => s.offering_type === 'subscription_annual');
  const pricingJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      ...customerSkus.map((sku) => ({
        '@type': 'Product',
        '@id': `${SITE_URL}/pricing#sku-${sku.service_code}`,
        name: sku.title,
        description: sku.description ?? `${sku.title} on Setnayan.`,
        brand: ORGANIZATION_REF,
        category: 'Wedding planning software',
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/pricing`,
          price: String(Math.round(sku.retail_price_php)),
          priceCurrency: 'PHP',
          availability: buildAvailability(sku.build_status),
          seller: ORGANIZATION_REF,
          ...(sku.billing_period === 'per_28d'
            ? {
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: String(Math.round(sku.retail_price_php)),
                  priceCurrency: 'PHP',
                  billingDuration: 'P28D',
                  unitText: '28-day cycle',
                },
              }
            : {}),
        },
      })),
      ...[...vendorSubs, ...vendorAnnualSubs].map((s) => {
        const isAnnual = s.offering_type === 'subscription_annual';
        const cadence = isAnnual
          ? { billingDuration: 'P1Y', unitText: 'annual subscription', shortLabel: 'per year' }
          : { billingDuration: 'P28D', unitText: '28-day prepaid block', shortLabel: 'per 28 days' };
        return {
          '@type': 'Service',
          '@id': `${SITE_URL}/pricing#vendor-${s.sku_code}`,
          name: s.title,
          // A supplier plan, read by suppliers: the zero owes its second sentence, at the LIVE rate (audit 2026-10-12, items 5 + 6).
          description: `${s.title} · Setnayan supplier subscription ${cadence.shortLabel}. ${supplierCommissionShort(feeSchedule)}.`,
          provider: ORGANIZATION_REF,
          category: 'Wedding supplier subscription',
          offers: {
            '@type': 'Offer',
            url: `${SITE_URL}/vendors`,
            price: String(Math.round(s.price_php)),
            priceCurrency: 'PHP',
            availability: 'https://schema.org/InStock',
            seller: ORGANIZATION_REF,
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: String(Math.round(s.price_php)),
              priceCurrency: 'PHP',
              billingDuration: cadence.billingDuration,
              unitText: cadence.unitText,
            },
          },
        };
      }),
    ],
  };

  return (
    /*
      The shared shell (front-door-shell). ⚠ THIS PAGE OWNS NO <main> of the shell's — the doorway variant yields the
      landmark to the host, so the wrapper below becomes one.
    */
    <main className="min-h-screen bg-cream text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }} />

      {/* 1 · HERO */}
      <section className="border-b border-ink/5 pb-[30px] pt-7" data-pricing-hero="">
        <div className={WRAP}>
          <p className={KICK}>Set na &apos;yan · Pricing</p>
          <h1 className="m-0 mt-3 font-pahina text-[40px] font-normal leading-[1.04] tracking-[-0.015em] lg:mt-4">
            The best place to build your event.
          </h1>
          <p className={LINE}>Beautifully made, for you and the people you know — everything to plan is included.</p>
          <div className="mt-6 flex flex-wrap items-center gap-[18px]">
            <Link href="/start" className="m-btn m-btn-primary">
              Start your event
            </Link>
          </div>
        </div>
      </section>

      {/* 2 · WHY SETNAYAN — four pictures */}
      <section id="why" className="-mx-4 bg-terracotta/[0.07] px-4 pb-[30px] pt-[34px] lg:mx-0 lg:px-0">
        <div className={WRAP}>
          <p className={KICK}>Why Setnayan</p>
          <h2 className={H2}>Crafted for every event.</h2>
          <p className={LINE}>The same care for a wedding, a debut, a reunion or a fun run.</p>
          <ul className="m-0 mt-5 grid list-none grid-cols-2 gap-x-3.5 gap-y-4 p-0 lg:mt-[26px] lg:grid-cols-4 lg:gap-6" data-tour="pricing-why">
            <WhyPoint
              shot={<WhyShot src="/feature-shots/event-hub-0.jpg" y="28%" zoom={1.1} />}
              title="An Event Hub that looks like yours"
              line="One page your guests open — your look, your reveal."
              tip="A complete design is included with every event. Your own photos, music, themes and the cinematic reveal are Event Hub Pro, or just the parts you need."
            />
            <WhyPoint
              shot={<WhyShot src="/feature-shots/3d-plan-0.jpg" y="21%" zoom={1.25} />}
              align="end"
              title="A seat plan you can walk in 3D"
              line="Lay the tables out, then walk the room."
              tip="Every chair named; tap a guest to see the room from their seat. Included with every event."
            />
            <WhyPoint
              shot={<WhyShot src="/feature-shots/papic-0.jpg" y="11%" zoom={1.15} />}
              title="Every guest’s phone, a camera"
              line="Papic: point at a code and shoot — nothing to install."
              tip={`Every shot lands in your Memories as it is taken. Your first event’s credits are included${papicFrom ? `; top-ups from ${peso(papicFrom.php)}` : ''}.`}
            />
            <WhyPoint
              shot={<LockTile />}
              align="end"
              title="Private by default. You choose who can view."
              line="Only me, invited only, or public."
              tip="A new event is private until you say otherwise — open it to the people you invite, or list it in Discover for anyone to find. A fourth choice, Unlisted, lets anyone with the link open it."
            />
          </ul>
          <Link href="/features" className="mt-6 inline-flex min-h-[44px] items-center text-[15px] font-semibold text-terracotta-700">
            See everything Setnayan does →
          </Link>
        </div>
      </section>

      {/* 3 · BETTER TOGETHER — three rows */}
      <section id="together" className="border-b border-ink/5 pb-[30px] pt-[34px]">
        <div className={WRAP}>
          <p className={KICK}>Better together</p>
          <h2 className={H2}>Where your people come together.</h2>
          <p className={LINE}>One account for hosts and guests, and your people in one place.</p>
          <ul className="m-0 mt-[22px] list-none p-0">
            <TogetherRow
              icon={
                <>
                  <circle cx="8" cy="9" r="3" />
                  <circle cx="16" cy="9" r="3" />
                  <path d="M2.5 20c.6-3.2 2.7-5 5.5-5s4.9 1.8 5.5 5M12 20c.4-2.4 1.9-4 4-4s3.6 1.6 4 4" />
                </>
              }
              title="Plan together"
              line="Co-hosts on your event; every unlock covers everyone on it."
              tip="Invite a co-host and they plan beside you. Anything you add, from Event Hub Pro to Live Watch, is unlocked for the event — nobody pays twice."
            />
            <TogetherRow
              icon={
                <>
                  <circle cx="12" cy="7" r="3" />
                  <circle cx="5" cy="10" r="2.2" />
                  <circle cx="19" cy="10" r="2.2" />
                  <path d="M6.5 20a5.5 5.5 0 0 1 11 0M1.5 17.5a3.5 3.5 0 0 1 5-3M22.5 17.5a3.5 3.5 0 0 0-5-3" />
                </>
              }
              title="Groups"
              line="A group for your barkada, family or org — plan events for it."
              tip="Inside, for members only: Usapan, the group’s chat, and stories that last a day. An organizer plans the reunion or the outing and every member sees it."
            />
            <TogetherRow
              icon={
                <>
                  <path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z" />
                  <path d="M18 8h1.5v12H8" />
                  <path d="M8.5 9h6M8.5 12.5h6" />
                </>
              }
              title="Your story"
              line="Every event you publish becomes a chapter, kept by year."
              tip="Your Story is a chronicle: each year has its name, each event a Chapter in it. Publish yours as a storyteller and share the page."
            />
          </ul>
        </div>
      </section>

      {/* 4 · PRICES — Included with every event, then the paid ones by moment (platform_retail_catalog_v2). */}
      <section id="prices" className="border-b border-ink/5 pb-[30px] pt-[34px]">
        <div className={WRAP}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className={KICK}>When you want more</p>
              <h2 className={H2}>Make it even more yours.</h2>
              <p className={LINE}>Each one is its own purchase, for this event and everyone on it.</p>
            </div>
            <div className="relative h-[78px] w-[104px] shrink-0 overflow-hidden rounded-xl">
              <Shot src="/feature-shots/event-hub-0.jpg" y="28%" zoom={1.1} sizes="104px" />
            </div>
          </div>

          <div className="mt-2.5" data-tour="pricing-prices">
            <IncludedGroup rows={included} />

            {prices.pro ? (
              <>
                <Moment>Make it yours</Moment>
                <ul className="m-0 list-none p-0">
                  <li className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-0.5 py-[13px]" data-pricing-item="COUPLE_WEBSITE_PRO">
                    <span className="flex items-baseline">
                      <i aria-hidden className="mr-1.5 align-[2px] text-[11px] not-italic text-terracotta-700">
                        ◆
                      </i>
                      <InfoTip label="Event Hub Pro" labelClassName="text-[16.5px] font-semibold tracking-[-0.005em]" align="start">
                        {`${proThemes} Pro themes, your own photos, video and music, the cinematic reveal, your logo animated and on every QR, 500 MB of media, prints in your look. One unlock covers everyone on the event.`}
                      </InfoTip>
                    </span>
                    <span className="whitespace-nowrap font-pahina text-xl text-terracotta-700">{peso(prices.pro.regular)}</span>
                    <p className="col-start-1 m-0 text-[13.5px] leading-snug text-ink/65">
                      Your own look on the Event Hub — the included design stays yours either way.
                    </p>
                    {prices.pro.signup != null ? (
                      <p className="col-span-2 m-0 mt-1 text-[13px] text-ink/65" data-pro-setup="">
                        <b className="font-medium text-ink">{peso(prices.pro.signup)} while you set up your event</b> ·{' '}
                        {peso(prices.pro.regular)} after
                      </p>
                    ) : null}
                    <HubProWays
                      everythingLabel={`Everything · ${peso(prices.pro.regular)}`}
                      partsLabel={partsFrom != null ? `Just the parts you need · from ${peso(partsFrom)}` : null}
                      parts={
                        <ul className="m-0 mt-2 list-none p-0 text-sm" data-hub-parts="">
                          {prices.hubParts.map((p) => (
                            <li key={p.id} className="flex items-baseline justify-between gap-2.5 border-t border-ink/5 py-[7px] first:border-t-0">
                              <span>{p.name}</span>
                              <span className="whitespace-nowrap font-pahina text-base text-terracotta-700">{peso(p.php)}</span>
                            </li>
                          ))}
                          <li className="border-t border-ink/5 py-[7px] text-[13px] text-ink/65">
                            What you pay for parts counts toward {peso(prices.pro.regular)}.
                          </li>
                        </ul>
                      }
                    />
                  </li>
                </ul>
              </>
            ) : null}

            {onTheDay ? (
              <>
                <Moment>The day</Moment>
                <ul className="m-0 list-none p-0">
                  {papicFrom ? (
                    <PriceRowShell
                      name="Papic credits"
                      tip={`One pot every guest’s camera spends from: ${papicRungWords(prices.papicRungs, formatPeso)}.${papicCheaperAtSetup ? ' Cheaper while you set up your event.' : ''}`}
                      what="Top up the pot every guest’s camera spends from."
                      figure={<Figure php={papicFrom.php} from />}
                    />
                  ) : null}
                  {prices.liveWatch ? (
                    <PriceRowShell
                      name="Live Watch"
                      tip="A directed Main Stage plus switchable guest cameras, phones joining by the event QR. One unlock, no day limit; the one-camera stream is included."
                      what="Every camera live, for everyone who can’t be there."
                      figure={<Figure php={prices.liveWatch} />}
                    />
                  ) : null}
                  {prices.patiktok ? (
                    <PriceRowShell
                      name="Patiktok"
                      tip={`Pick the moments, the length and a song; the reel renders in your browser.${prices.patiktok.perDay ? ' Paid per day of your event.' : ''}`}
                      what="Your guests’ moments, cut into short vertical reels."
                      figure={<Figure php={prices.patiktok.php} suffix={prices.patiktok.perDay ? 'a day' : undefined} />}
                    />
                  ) : null}
                </ul>
              </>
            ) : null}

            {after ? (
              <>
                <Moment>After</Moment>
                <ul className="m-0 list-none p-0">
                  {prices.thankYou ? (
                    <PriceRowShell
                      name="Thank-you film"
                      tip="A Papic add-on: a film made from your guests’ photos, to send with your thanks."
                      what="A film from your guests’ photos, to send with your thanks."
                      figure={<Figure php={prices.thankYou} />}
                    />
                  ) : null}
                  {prices.musicMaker ? (
                    <PriceRowShell
                      name="Music Maker"
                      tip="An original song written from your story, yours to keep and play on the day."
                      what="Your own song, made for the event."
                      figure={<Figure php={prices.musicMaker} />}
                    />
                  ) : null}
                </ul>
              </>
            ) : null}

            {aiFrom != null ? (
              <>
                <Moment>Help planning</Moment>
                <ul className="m-0 list-none p-0">
                  <PriceRowShell
                    name="Setnayan AI"
                    tip={`Suggests verified suppliers by fit, then watches your deadlines, budget and dates. Priced by event type${
                      aiWedding
                        ? ` — a wedding ${peso(aiWedding.regular)}${aiWedding.signup != null ? `, or ${peso(aiWedding.signup)} while you set up` : ''}`
                        : ''
                    }${aiDate ? `; a date or hangout ${peso(aiDate.regular)}` : ''}.`}
                    what="Suggests your suppliers, then watches your plan."
                    figure={<Figure php={aiFrom} from />}
                  />
                </ul>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* 5 · CLOSE */}
      <section id="close" className="-mx-4 bg-ink/[0.025] px-4 pb-[30px] pt-[34px] lg:mx-0 lg:px-0">
        <div className={WRAP}>
          <p className="m-0 max-w-[26ch] font-pahina text-[22px] leading-[1.35]">Paid once, for this event and everyone on it.</p>
          <div className="mt-6 flex flex-wrap items-center gap-[18px]">
            <Link href="/start" className="m-btn m-btn-primary">
              Start your event
            </Link>
            <Link href="/pricing/plan" className="inline-flex min-h-[44px] items-center text-[15px] font-medium text-ink/65" data-tour="pricing-quiz">
              See what Setnayan does for you →
            </Link>
          </div>
          <p className="m-0 mt-[18px] text-[13px] text-ink/65">
            Prices in Philippine peso, read live from the Setnayan catalogue. No subscription.
          </p>
          {/* The door to the supplier plans (owner 2026-09-22 — the two pricing pages point at each other;
              `lib/the-two-pricing-pages-point-at-each-other.test.ts`). Not drawn in the prototype; one quiet line. */}
          <p className="m-0 mt-1 text-[13px] text-ink/65">
            A supplier?{' '}
            <Link href="/for-suppliers" className="font-semibold text-terracotta-700">
              For suppliers →
            </Link>
          </p>
        </div>
      </section>

      {/* 🔦 The first-visit spotlight — Why Setnayan → Prices → the quiz link (`lib/tours.ts` · pricing_page_v1). A visitor
          is usually signed out, so the seen mark lives on their device (`GuestSpotlight`, the same engine). */}
      <GuestSpotlight tourKey="pricing_page_v1" script={TOURS.pricing_page_v1.spotlight!} />
    </main>
  );
}
