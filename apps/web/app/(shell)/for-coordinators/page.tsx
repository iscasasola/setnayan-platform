/**
 * /for-coordinators — "Your business’s new home." For coordinators and wedding planners.
 *
 * BUILT FROM THE OWNER-APPROVED PROTOTYPE OF 6 NOV 2026 — `prototypes/for_coordinators_2026-11-06/`
 * (corpus; claude.ai/artifact/T4UfJ2G3QiYEf5K3sfto3D). Owner: *"Approved"*, then, with the Setnayan Weddings
 * sample shop and Fable's keystone-arch logo, *"Coordinator approved"*. It REPLACES the 4 Nov page this route
 * first shipped with. Section for section, top to bottom, with the prototype's words:
 *
 *   1 hero (five coordinators, scroll-driven) · 2 why · 3 the hard truth (dark) · 4 one place, every tool ·
 *   5 couples check your dates + one QR for every moment · 6 talking is easy (four notices) ·
 *   7 Full Event Access · 8 on the day, you move the show forward · 9 your portfolio builds itself ·
 *   10 grow your business, not your fees (fee slider · gifts · badge shelf) · 11 three honest questions ·
 *   12 everything you get (the fold) · 13 plans: Free → Verified → Grow · 14 the close.
 *
 * A coordinator is a SUPPLIER (DECISION_LOG 2026-05-12; the `planner_coordinator` category), so every call
 * to action is the supplier door, `/open-shop`.
 *
 * 🔑 NOTHING THAT IS A NUMBER IS TYPED HERE.
 *   · plan and add-on prices ........ `vendor_billing_catalog` per request (`_prices.server.ts`); unreadable → left out
 *   · reach · seats · cards · photos . `lib/vendor-tier-caps.ts` (`_facts.ts`)
 *   · the booking fee ............... the LIVE schedule (`getLiveBookingFeeSchedule`); unreadable → no rate is named
 *   · Full Event Access parts ....... `DELEGATE_AREAS` · `areaChoices` · `COORDINATOR_AREAS` (lib/delegate-areas.ts)
 *   · the free day-of desk .......... `FREE_SPECIALIZATION_SETS` (lib/vendor-specialization-gate.ts), switch `dayOfFree`
 *
 * 🎚 FOUR LINES SHOW ONLY WHILE THEIR SWITCH IS ON (owner 2026-11-05, board decision 3): each supplier seeing
 * only their rows · announcements · prepare-then-release · private notes. `_claims.server.ts` reads them live
 * and an unreadable switch reads OFF, so the page can never promise a thing that is switched off.
 *
 * ⛔ THIS PAGE MUST NOT GO LIVE UNTIL THE FIVE PROMISED FEATURES ARE LIVE (owner 6 Nov: "remove all coming soon
 * … because we will finish everything until sat"): NFC tags + door sticker + ready-made prints · the supplier
 * scanner · event photos on the card · badge rewards · meetings. And the sample shop `setnayan-weddings` must
 * exist first, or every QR on the page scans to a dead address. The PR ships draft + `do-not-auto-merge`.
 *
 * The page sits in the shared shell (`app/(shell)/layout.tsx` owns the bar, the rail and `force-dynamic`) and
 * runs full-bleed (`DOORWAY_BLEED_PATHS`). Look: `_for-coordinators.css`, the prototype's CSS on the app's tokens.
 */

import type { ReactElement } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { getLiveBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { checkADateUrl } from '@/lib/check-a-date';
import {
  COORDINATOR_AREAS,
  DELEGATE_AREAS,
  DELEGATE_AREA_LABEL,
  areaChoices,
  choiceOfLevel,
  type DelegateArea,
} from '@/lib/delegate-areas';
import { renderUrlQrSvg } from '@/lib/qr';
import { siteOrigin } from '@/lib/site-origin';
import { myPageUrl } from '@/lib/supplier-qr-codes';
import { buildVendorInviteUrl } from '@/lib/vendor-couple-invite';
import { SPECIALIZATION_MIN_TIER } from '@/lib/vendor-specialization-gate';
import { TIER_CAPS, TIER_PRICE_PHP, canBuyExtraBranches, firstPlanWith } from '@/lib/vendor-tier-caps';

import { BADGES, BADGE_DEFS } from './_badges.generated';
import { countWord, shownWith, type ClaimSwitch } from './_claims';
import { readClaimSwitches } from './_claims.server';
import {
  AccessCard,
  CheckADate,
  FcEffects,
  FeeSlider,
  HeroStage,
  InfoToggle,
  PlanTiers,
  QrMoments,
  RunTheDay,
  type AccessLevel,
  type AccessRow,
  type HeroPerson,
  type QrCode,
  type QrMoment,
  type TierCard,
} from './_fc-client';
import {
  DELEGATE_GRACE_DAYS,
  FREE_HELPER_SEATS,
  GROW_TIERS,
  PORTFOLIO_FREE_BASE,
  badgeRungs,
  badgeSpan,
  foldGroups,
  freeSpec,
  growSpec,
  pctWords,
  pesoWords,
  planName,
  planPill,
  reachLadderSentence,
  reachWords,
  verifiedSpec,
  type FoldGroup,
} from './_facts';
import { readCoordinatorPrices } from './_prices.server';
import { addonLines } from '@/app/for-suppliers/_components/plan-table-data';
import { SupplierPlanTable } from '@/app/for-suppliers/_components/supplier-plan-table';
import { isVendorFeatureGateEnabled } from '@/lib/vendor-feature-gate';

import './_for-coordinators.css';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

/** The photos the 4 Nov page already shipped (same bytes as the 6 Nov prototype's `whole-assets/`). */
const SHOT = '/marketing/2026-11-04';
/** The photos new with the 6 Nov prototype (`whole-assets/`, `in-use-weddings/`, `in-use-suppliers/`, `logo/out/`). */
const SHOT6 = '/marketing/2026-11-06/coordinators';

/** The sample shop every code on this page points at. ⚠ Not created in prod yet — an owner task (see the PR). */
const SAMPLE_SHOP = { slug: 'setnayan-weddings', name: 'Setnayan Weddings' } as const;


const TITLE = 'For Coordinators — Your business’s new home';
const DESCRIPTION =
  'For coordinators and wedding planners: your schedule, bookings, client chats, planning and the event day itself, all in one place. Free to start.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/for-coordinators' },
  openGraph: {
    images: BRAND_OG_IMAGES,
    title: `${TITLE} · Setnayan`,
    description: DESCRIPTION,
    url: '/for-coordinators',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    images: BRAND_TWITTER_IMAGES,
    card: 'summary_large_image',
    title: `${TITLE} · Setnayan`,
    description: DESCRIPTION,
  },
};

const PAGE_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/for-coordinators#webpage`,
      url: `${SITE_URL}/for-coordinators`,
      name: `${TITLE} · Setnayan`,
      description: DESCRIPTION,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
      audience: {
        '@type': 'BusinessAudience',
        audienceType: 'Wedding and event coordinators and wedding planners in the Philippines',
        geographicArea: { '@type': 'Country', name: 'Philippines' },
      },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/for-coordinators#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'For Coordinators', item: `${SITE_URL}/for-coordinators` },
      ],
    },
  ],
};

/* ── 1 · the hero's five people ─────────────────────────────────────────────────────────────────── */

const HERO: readonly HeroPerson[] = [
  {
    src: `${SHOT}/coord-03-prep-private.webp`,
    width: 960,
    height: 720,
    alt: 'A coordinator at an empty reception table with her notebook',
    focal: 'p1',
    line: "You've always run other people's big days.",
    dot: 'The dreamer',
  },
  {
    src: `${SHOT}/problem-11-five-apps.webp`,
    width: 960,
    height: 720,
    alt: 'A coordinator working from home on her laptop',
    focal: 'p2',
    line: 'You just took your first client.',
    dot: 'The starter',
  },
  {
    src: `${SHOT}/coord-multi-events.webp`,
    width: 960,
    height: 720,
    alt: 'A coordinator walking a venue hallway with a tablet',
    focal: 'p3',
    line: 'Three events this month, and one of you.',
    dot: 'Still fighting',
  },
  {
    src: `${SHOT}/coord-05-cue-the-show.webp`,
    width: 960,
    height: 720,
    alt: 'A coordinator with an earpiece cueing the next part',
    focal: 'p4',
    line: 'On the day, everyone looks to you.',
    dot: 'The established',
  },
  {
    src: `${SHOT}/coord-06-announcement.webp`,
    width: 960,
    height: 720,
    alt: 'A coordinator at a garden reception with her phone',
    focal: 'p5',
    line: 'Couples ask for you by name.',
    dot: 'The trusted name',
  },
];

/* ── 3 · the hard truth ──────────────────────────────────────────────────────────────────────────── */

const PROBLEMS: readonly { src: string; alt: string; title: string; body: string }[] = [
  {
    src: `${SHOT6}/problem-02-phones.webp`,
    alt: 'A coordinator at a dinner table reading her phone',
    title: 'Working from the couple’s screenshots.',
    body: 'Forwarded screenshots and a password they texted you.',
  },
  {
    src: `${SHOT}/problem-06-coordinator.webp`,
    alt: 'A coordinator on a call in a venue hallway',
    title: 'The timeline lives in your head.',
    body: 'Every supplier has a different version of the day.',
  },
  {
    src: `${SHOT}/problem-seatplan.webp`,
    alt: 'A coordinator crouched over seat cards',
    title: 'The seat plan redrawn at midnight.',
    body: 'A family arrives with three more people, and the chart is paper.',
  },
  {
    src: `${SHOT}/problem-03-door.webp`,
    alt: 'A coordinator at the door with a guest list',
    title: 'A line at the door.',
    body: 'Guests wait while someone searches a printed list.',
  },
  {
    src: `${SHOT}/problem-09-entourage.webp`,
    alt: 'A coordinator on the phone while the entourage gets ready',
    title: 'Everyone thinks they run the show.',
    body: 'The emcee, the band and the venue each move on when they think it’s time.',
  },
  {
    src: `${SHOT}/supplier-12-time-changes.webp`,
    alt: 'A supplier checking his watch at the door',
    title: 'Times changed in the group chat.',
    body: 'A supplier moves their call time. You find out when they arrive late.',
  },
];

/* ── 7 · Full Event Access ───────────────────────────────────────────────────────────────────────── */

/** The small line under a part's name, as the prototype words it. "View at most" is derived from the choices. */
const AREA_SMALL: Partial<Record<DelegateArea, string>> = {
  schedule: 'The schedule and the run of show',
  vendors: 'Who is booked, who is paid',
};

/**
 * The parts the couple can share with a coordinator, in the app's order, with the levels the app lets them
 * set and a coordinator's starting levels. "Event Hub" (`invitations`) is left out — it is not settable yet
 * (`areaChoices` returns null) and these pages do not name it.
 */
function accessRows(): AccessRow[] {
  const rows: AccessRow[] = [];
  for (const area of DELEGATE_AREAS) {
    const choices = areaChoices(area);
    if (!choices) continue;
    rows.push({
      key: area,
      label: DELEGATE_AREA_LABEL[area],
      small: AREA_SMALL[area] ?? (choices.includes('edit') ? undefined : 'View at most'),
      choices: choices as readonly AccessLevel[],
      start: choiceOfLevel(COORDINATOR_AREAS[area] ?? null),
    });
  }
  return rows;
}

/* ── 13 · the Grow plans' lists (the prototype's words; the numbers are in `growSpec`) ──────────── */

const GROW_ITEMS: Readonly<Record<(typeof GROW_TIERS)[number], TierCard['items']>> = {
  solo: [
    { text: 'Your own web address', bold: true },
    { text: 'Personalize your page: intro, accent colour, featured services, sections' },
    { text: 'Quote-to-booking funnel' },
    { text: 'Won and lost reasons' },
    { text: 'Your own reply and booking metrics' },
    { text: 'Earnings dashboard' },
    { text: 'Recap sharing to your Facebook Page' },
    { text: 'Your logo on the couple’s 3D seat plan (3D Booth add-on)' },
  ],
  pro: [
    { text: 'Premium two-column page', bold: true, rest: 'with a sticky Inquire rail' },
    { text: 'One business identity for your whole crew' },
    { text: 'Demand Radar' },
    { text: 'Reverse-image theft watch' },
    { text: 'Custom /your-name address and full written reviews' },
    { text: 'Featured in Stories' },
    { text: 'Editorial and article spotlights' },
    { text: 'Priority support' },
  ],
  enterprise: [
    { text: 'Flagship page with video films', bold: true },
    { text: 'Multi-admin for your team' },
    { text: 'Market Intelligence: your category vs peers' },
    { text: 'Front-of-line dispute handling' },
  ],
};

/** The current month in Manila, for the Check-a-date sample. */
function sampleMonth() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'numeric' }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value) - 1;
  const first = new Date(Date.UTC(y, m, 1));
  return {
    month: first.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }).toUpperCase(),
    monthShort: first.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    offset: first.getUTCDay(),
    days: new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
  };
}

const FOLD_ICON: Readonly<Record<FoldGroup['icon'], ReactElement>> = {
  find: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M9 14l2 2 4-4" />
    </svg>
  ),
  together: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3" />
    </svg>
  ),
  day: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  grow: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
    </svg>
  ),
};

/** A line that is true only while a switch is on carries `needs` — see `_claims.ts`. */
type Gated<T> = T & { needs?: ClaimSwitch };

function Pill({ kind, children }: { kind: 'free' | 'ver' | 'plan'; children: string }) {
  return <span className={`fc-pill fc-${kind}`}>{children}</span>;
}

export default async function ForCoordinatorsPage() {
  const origin = siteOrigin();
  const [on, prices, fee] = await Promise.all([
    readClaimSwitches(),
    readCoordinatorPrices(),
    getLiveBookingFeeSchedule().catch(() => null),
  ]);

  // ── the four real codes, drawn by the app's own QR renderer ──
  const shortlistUrl = buildVendorInviteUrl(SAMPLE_SHOP.slug);
  const datesUrl = checkADateUrl(origin, SAMPLE_SHOP.slug);
  const pageUrl = myPageUrl(origin, SAMPLE_SHOP.slug);
  const reviewUrl = `${pageUrl}#reviews`;
  const [shortlistSvg, datesSvg, pageSvg, reviewSvg] = await Promise.all(
    [shortlistUrl, datesUrl, pageUrl, reviewUrl].map((u) => renderUrlQrSvg(u, 240).catch(() => undefined)),
  );
  const codes: QrCode[] = [
    { key: 'shortlist', chip: 'Shortlist', title: 'Shortlist', desc: 'They scan, sign up free, and their event starts with you on it.', url: shortlistUrl, svg: shortlistSvg, go: 'Open it' },
    { key: 'dates', chip: 'Check a date', title: 'Check a date', desc: 'They see your free and taken days, then ask about one in your chat.', url: datesUrl, svg: datesSvg, go: 'Check a date' },
    { key: 'page', chip: 'My page', title: 'My page', desc: 'Your whole shop: services, prices, portfolio and reviews.', url: pageUrl, svg: pageSvg, go: 'Open the page' },
    {
      key: 'booked',
      chip: 'Booked · one-use',
      title: 'Booked · one-use',
      desc: 'You make this one in your QR codes screen, for one client only. They scan it, and their event is created with you already booked. It works once.',
      icon: 'lock',
    },
    {
      key: 'crew',
      chip: 'Crew',
      title: 'Crew',
      desc: 'One code per event, made in Hub › Crew. Your team scans it and joins once you tap Allow. It ends when the event ends.',
      icon: 'people',
    },
    { key: 'review', chip: 'Review', title: 'Review', desc: 'Guests scan it at the table and leave you a review on the spot.', url: reviewUrl, svg: reviewSvg, go: 'See the reviews' },
  ];
  const moments: QrMoment[] = [
    {
      photo: { src: `${SHOT6}/07-expo-booth.webp`, width: 800, height: 450, alt: 'A backdrop with a QR code at an expo booth' },
      step: 'At a bazaar, an expo, your studio',
      title: 'They find you',
      codes: ['shortlist', 'dates', 'page'],
      body: 'Shortlist is made by you for one kind of event and one service. They scan, sign up free, and their event starts with you on it.',
      fine: 'Printed on your card, standee, backdrop, tarp, table-front and door print.',
    },
    {
      photo: { src: `${SHOT6}/08-card-and-phone-scan.webp`, width: 600, height: 800, alt: 'A couple scans the back of a calling card at the counter' },
      step: 'The deal is closed',
      title: 'They book you',
      codes: ['booked'],
      body: 'You fill in the deal once. One code, for that client only. They scan, and their event is created with you booked on it.',
      fine: 'On the back of your card, or shown on your phone.',
    },
    {
      photo: { src: `${SHOT6}/02-guest-scans-table-tent.webp`, width: 800, height: 450, alt: 'A guest scans a table tent at the welcome table' },
      step: 'For your team and the guests',
      title: "You're at their event",
      codes: ['crew', 'review'],
      body: 'Your team scans Crew and joins once you tap Allow. Guests scan Review on a table sign and leave you a review on the spot.',
      fine: 'On a crew card, and a table tent at the welcome table.',
    },
  ];

  // ── the fee, in words, from the live schedule (null → no rate is named) ──
  const feeRates = fee
    ? { head: pctWords(fee.rate), tail: pctWords(fee.tailRate), band: pesoWords(fee.tier1LimitPhp) }
    : null;

  // ── the day-of desk: "Free" while the floor-command set is free; otherwise the plan that opens it ──
  const deskTag = on.dayOfFree ? <Pill kind="free">Free</Pill> : <Pill kind="plan">{planPill(SPECIALIZATION_MIN_TIER)}</Pill>;
  const seatsFrom = firstPlanWith((c) => c.agentAccounts > 0);
  const addOnPlan = (['solo', 'pro', 'enterprise'] as const).find((t) => canBuyExtraBranches(t)) ?? 'enterprise';

  const caps: Gated<{ key: string; title: string; tag: ReactElement; body: ReactElement }>[] = [
    {
      key: 'inbox',
      title: 'One requests inbox.',
      tag: deskTag,
      body: <p>Every supplier’s request and issue lands in one list that you sort.</p>,
    },
    {
      key: 'times',
      title: 'Times change only with your OK.',
      tag: <Pill kind="free">Free</Pill>,
      body: (
        <div className="fc-flow">
          <span className="fc-chip">Setnayan Productions asks: 5:45 PM</span>
          <span className="fc-arr">→</span>
          <span>you or the couple approve</span>
          <span className="fc-arr">→</span>
          <span>on every guest’s schedule</span>
        </div>
      ),
    },
    {
      key: 'door',
      title: 'No line at the door.',
      tag: deskTag,
      body: <p>Scan a guest’s pass, mark them arrived, and the seat scanner finds their table.</p>,
    },
    {
      key: 'announce',
      title: 'One announcement, every phone.',
      tag: <Pill kind="free">Free</Pill>,
      body: <p>Dinner moved? It appears on every guest’s event page.</p>,
      needs: 'announcements',
    },
  ];
  const deskParagraph: Gated<{ text: string }>[] = [
    { text: 'Prepare items in private and release them when they’re ready.', needs: 'prepRelease' },
    { text: 'Keep private notes for yourself, and notes the couple can read.', needs: 'privateNotes' },
    { text: 'Track every booked supplier and payment for the couple.' },
  ];
  const groups = foldGroups().map((g) => ({ ...g, items: shownWith(g.items, on) }));

  const tiers: TierCard[] = GROW_TIERS.map((t, i) => ({
    key: t,
    name: planName(t),
    month: prices.plans[t].month,
    year: prices.plans[t].year ? `${prices.plans[t].year} a year` : null,
    spec: growSpec(t),
    plus: `Everything in ${i === 0 ? planName('verified') : planName(GROW_TIERS[i - 1]!)}, plus`,
    items: GROW_ITEMS[t],
  }));
  const ctools: Gated<{ text: string }>[] = [
    { text: 'Full Event Access' },
    { text: 'Day-of desks', needs: 'dayOfFree' },
    { text: 'Run of show' },
    { text: 'Guest door and seating' },
    { text: 'Dashboard access and invites' },
  ];
  const helperWord = countWord(FREE_HELPER_SEATS).toLowerCase();
  const addOns = addonLines(prices.bySku).filter((a) => a.price !== 'Price unavailable');

  return (
    <div className="fc" id="fc-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PAGE_LD) }} />
      <FcEffects rootId="fc-root" />
      <main>
        {/* 1 · HERO */}
        <section id="hero-section" aria-label="For coordinators and wedding planners">
          <HeroStage people={HERO} label="Five coordinators and wedding planners" />
          <div className="fc-wrap fc-hero-landing">
            <div className="fc-hl-a">
              <p className="fc-kicker">For coordinators and wedding planners</p>
              <h1>Your business’s new home.</h1>
            </div>
            <div className="fc-hl-b">
              <p className="fc-lede">
                Your schedule, bookings, client chats, planning and the event day itself, all in one place. Free to start.
              </p>
              <div className="fc-actions">
                <Link className="fc-btn" href="/open-shop">
                  Open your shop free
                </Link>
                <a className="fc-tlink" href="#close">
                  See a real shop
                </a>
              </div>
              <div className="fc-facts">
                <span>Free to join</span>
                {on.dayOfFree ? <span>Day-of tools free</span> : null}
                <span>Couples pay you directly</span>
              </div>
              <InfoToggle id="fc-i1" label="How the fee works">
                <p>
                  Free to join and free to run your bookings. Your first booking through Setnayan is free too. Couples pay
                  you straight to your GCash or bank; Setnayan never takes a cut of the deal.{' '}
                  {feeRates
                    ? `You pay a booking fee of ${feeRates.head} on the first ${feeRates.band} of a booking and ${feeRates.tail} after.`
                    : 'You pay a booking fee on the couples Setnayan brings you; its rate is shown in full before you agree to any booking.'}{' '}
                  Your own clients, the ones you bring or import, never carry a fee.
                </p>
              </InfoToggle>
            </div>
          </div>
        </section>

        {/* 2 · WHY */}
        <section className="fc-beat">
          <div className="fc-wrap fc-split">
            <div className="fc-beat-head">
              <h2>We know running other people’s days is hard.</h2>
              <p className="fc-lede">
                You hold the whole day together, and nobody sees it. We built the place where your work is seen, and where
                your business lives.
              </p>
              <InfoToggle id="fc-i2" label="What stays yours">
                <p>
                  Everything you build here is yours: your page, your reviews, your client list, your badges. The couple’s
                  event stays theirs; you work in the parts they open. Nothing here is rented. Nothing resets when you grow.
                </p>
              </InfoToggle>
            </div>
            <div className="fc-real fc-ph fc-ratio-54 fc-bleed" role="img" aria-label="A coordinator in a cream suit in a dining room while the band sets up">
              <Image src={`${SHOT6}/coord-band.webp`} alt="" width={720} height={900} sizes="(min-width: 960px) 50vw, 100vw" />
            </div>
          </div>
        </section>

        {/* 3 · HARD TRUTH */}
        <section className="fc-beat fc-dark">
          <div className="fc-wrap fc-stack">
            <div className="fc-beat-head">
              <h2>This is what coordinating and planning look like today.</h2>
              <p className="fc-lede">{"Say it plainly. We've all been there."}</p>
            </div>
            <div className="fc-probs">
              {PROBLEMS.map((p) => (
                <div className="fc-prob" key={p.title}>
                  <div className="fc-real fc-ph" role="img" aria-label={p.alt}>
                    <Image src={p.src} alt="" width={960} height={720} sizes="(min-width: 960px) 30vw, 104px" />
                  </div>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <InfoToggle id="fc-i3" label="Six more we hear">
              <p>
                Six more we hear every week: calls and invites across five apps · ten suppliers, ten chats, one evening ·
                announcements shouted across the hall · many clients, many logins · plans that leak before they are ready ·
                supplier deposits on scraps of paper.
              </p>
              <p>Every one of these has a tool in the dashboard below.</p>
            </InfoToggle>
          </div>
        </section>

        {/* 4 · ONE PLACE */}
        <section className="fc-beat fc-relief">
          <div className="fc-wrap fc-split">
            <div className="fc-beat-head">
              <h2>One place. Every tool.</h2>
              <p className="fc-lede">{"Whether you're starting, growing or already established, the same shop grows with you."}</p>
              <InfoToggle id="fc-i4" label="What Free includes">
                <p>
                  Free gives you the full dashboard: calendar, inquiries, quotes, bookings, payments on record, contracts,
                  your public page and {PORTFOLIO_FREE_BASE} portfolio photos.
                  {on.dayOfFree ? ' Your day-of desks are free too, with no end date.' : null}
                </p>
                <p>
                  Verified (free, once your DTI/SEC, BIR 2303 and permit are approved) puts you in search{' '}
                  {reachWords(TIER_CAPS.verified.serviceRadiusKm)} around you. Paid plans add reach, categories, team seats
                  and branches. See Plans below.
                </p>
              </InfoToggle>
            </div>
            <div className="fc-rows">
              <div className="fc-row">
                <h3>Starting?</h3>
                <p>Open your shop in two steps. Your first booking through Setnayan is free.</p>
                <div className="fc-meta">
                  <Pill kind="free">Free</Pill>
                </div>
              </div>
              <div className="fc-row">
                <h3>Growing?</h3>
                <p>Get Verified free. Couples and search engines can find you.</p>
                <div className="fc-meta">
                  <Pill kind="ver">Verified ✓</Pill>
                  <Pill kind="free">Free</Pill>
                </div>
              </div>
              <div className="fc-row">
                <h3>Established?</h3>
                <p>Bring your clients in free and keep them free. One login opens every event you run.</p>
                <div className="fc-meta">
                  <Pill kind="free">Free</Pill>
                  {seatsFrom ? <Pill kind="plan">{`More seats from ${planName(seatsFrom)}`}</Pill> : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5 · GET FOUND */}
        <section className="fc-beat">
          <div className="fc-wrap fc-stack">
            <div className="fc-split">
              <div className="fc-beat-head">
                <h2>Couples check your free dates themselves.</h2>
                <p className="fc-lede">
                  From your QR, your page or your shop. They see only two things: available, or not bookable. Never who
                  booked.
                </p>
                <p className="fc-muted fc-small">
                  Tap a day. The ask lands in your chat with the date and the services attached. <Pill kind="free">Free</Pill>
                </p>
                <div className="fc-pagebit">
                  <h3>
                    Your page is your marketing tool. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>Verified seal, photos, service cards, reviews and badges in one link. Put it on your posts, your booth, your table.</p>
                </div>
              </div>
              <div className="fc-media">
                <div className="fc-phone">
                  <div className="fc-screen">
                    <div className="fc-abar">
                      <span className="fc-mark">
                        SET<b>NA</b>YAN
                      </span>
                    </div>
                    <CheckADate {...sampleMonth()} />
                  </div>
                </div>
              </div>
            </div>

            <div className="fc-sub">
              <h3>
                One QR for every moment <Pill kind="free">Free</Pill>
              </h3>
              <p>{"You don't pick \"a QR code\". You pick the moment."}</p>
              <QrMoments moments={moments} codes={codes} shop={SAMPLE_SHOP.name} />
              <InfoToggle id="fc-i5" label="Codes and search reach">
                <p>
                  Every code downloads, shares or copies as a link from your QR codes screen. Only a Verified shop is shown
                  in search: {reachLadderSentence()}. Your page is ready for Google the moment you set an address.
                </p>
                <p>NFC tags, the door sticker and ready-made printed pieces.</p>
              </InfoToggle>
            </div>
          </div>
        </section>

        {/* 6 · CUSTOMERS */}
        <section className="fc-beat fc-soft">
          <div className="fc-wrap fc-stack">
            <div className="fc-split">
              <div className="fc-beat-head">
                <h2>Talking is easy. The personal touch is yours.</h2>
                <p className="fc-lede">One chat per client, with the quote, the files and the schedule attached. The rest is you.</p>
                <InfoToggle id="fc-i6" label="Returning couples and discounts">
                  <p>
                    A returning couple reads “— a returning client” on the inquiry. Discounts you set (early booking,
                    off-peak, bundle, promo, returning couple) show on your card as one pill, like “10% off · early
                    booking”. A perk you keep off the public card is revealed in the chat once you say yes.
                  </p>
                  <p>Meetings: in person, or a call on your own phone or Viber, booked inside the chat.</p>
                </InfoToggle>
              </div>
              <div className="fc-real fc-ph fc-ratio-54" role="img" aria-label="A coordinator and a couple in a consultation">
                <Image src={`${SHOT6}/15-consultation.webp`} alt="" width={800} height={450} sizes="(min-width: 960px) 50vw, 100vw" />
              </div>
            </div>
            <div className="fc-notices">
              <div className="fc-notice">
                <span className="fc-ic">1</span>
                <div>
                  <h3>
                    “New booking inquiry.” <Pill kind="free">Free</Pill>
                  </h3>
                  <p>With their date, place and headcount attached. Nothing is booked yet.</p>
                </div>
              </div>
              <div className="fc-notice">
                <span className="fc-ic">2</span>
                <div>
                  <h3>
                    Send the quote from the chat. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>Package, per guest or per hour. They accept or counter.</p>
                </div>
              </div>
              <div className="fc-notice">
                <span className="fc-ic">3</span>
                <div>
                  <h3>
                    “First payment submitted — please confirm.” <Pill kind="free">Free</Pill>
                  </h3>
                  <p>The receipt is attached. Confirm, and the date is held.</p>
                </div>
              </div>
              <div className="fc-notice">
                <span className="fc-ic">4</span>
                <div>
                  <h3>
                    “Their wedding invites you to coordinate.” <Pill kind="free">Free</Pill>
                  </h3>
                  <p>Made for you when they mark your first payment. Accept, and you run their schedule and day-of requests.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7 · FULL EVENT ACCESS (coordinator only) */}
        <section className="fc-beat" id="full-event-access">
          <div className="fc-wrap fc-split">
            <div className="fc-beat-head">
              <p className="fc-kicker">Full Event Access</p>
              <h2>Their event stays theirs. You get the parts they open.</h2>
              <p className="fc-lede">
                No more screenshots and borrowed passwords. The couple invites you into their own event and picks, part by
                part, what you can edit, view, or not see at all.
              </p>
              <div className="fc-caps">
                <div className="fc-cap">
                  <h3>
                    Ask for what you need. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>Pick the parts, add why, send. The couple decides each one.</p>
                </div>
                <div className="fc-cap">
                  <h3>
                    Every change is logged. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>Publishing the seat plan and sending the first invitation always stay with the couple.</p>
                </div>
              </div>
              <InfoToggle id="fc-i7" label="How access works">
                <p>
                  A coordinator starts with Edit on the guest list, seat plan, the day and suppliers; the mood board at View;
                  budget and photos Off. Budget and photos can be opened to View at most, never Edit.
                </p>
                <p>
                  Two ways to ask: from your event screen (“Ask the host for access”), or from your access page, one part at a
                  time. The couple sees “Your coordinator is asking for access” and decides.
                </p>
                <p>Access ends {DELEGATE_GRACE_DAYS} days after the event. The couple can end it sooner.</p>
              </InfoToggle>
            </div>
            <AccessCard rows={accessRows()} foot="Tap Edit, View or Off. Budget and photos open to View at most." />
          </div>
        </section>

        {/* 8 · RUN THE DAY */}
        <section className="fc-beat fc-soft" id="run-the-day">
          <div className="fc-wrap fc-split fc-flip">
            <div className="fc-beat-head">
              <h2>On the day, you move the show forward.</h2>
              <p className="fc-lede">
                Part by part, from your phone, and every guest’s screen follows. The couple can too. The emcee can’t.
              </p>
              <div className="fc-caps">
                {shownWith(caps, on).map((c) => (
                  <div className="fc-cap" key={c.key}>
                    <h3>
                      {c.title} {c.tag}
                    </h3>
                    {c.body}
                  </div>
                ))}
              </div>
              <InfoToggle id="fc-i8" label="Your day-of desk">
                {on.dayOfFree ? (
                  <p>
                    Your day-of desks are free, with no end date: cue the show, the requests inbox, the check-in desk and the
                    seat scanner.
                  </p>
                ) : null}
                <p>
                  Your event screen and the day’s schedule are saved on your phone. The saved mark reads “Saved for offline ·
                  updated 2:10 PM” and turns amber when it’s old on the event day.
                </p>
                <p>{shownWith(deskParagraph, on).map((d) => d.text).join(' ')}</p>
                <p>
                  Your team works under your shop, each with their own login; {helperWord} helper seat
                  {FREE_HELPER_SEATS === 1 ? ' is' : 's are'} free.
                </p>
              </InfoToggle>
            </div>
            <RunTheDay
              parts={[
                { at: '5:00 PM', name: 'Cocktails' },
                { at: '6:05 PM', name: 'Grand entrance' },
                { at: '6:20 PM', name: 'First dance' },
                { at: '6:40 PM', name: 'Dinner' },
                { at: '8:00 PM', name: 'Same-day edit' },
              ]}
              arrived="132 / 150"
              request={{ initials: 'SP', from: 'Setnayan Productions', what: 'Running late 10 min' }}
            />
          </div>
        </section>

        {/* 9 · PORTFOLIO */}
        <section className="fc-beat fc-pf">
          <div className="fc-wrap">
            <div className="fc-beat-head">
              <h2>Your portfolio builds itself.</h2>
              <p className="fc-lede">
                Every event you run here adds to your page: photos, reviews, badges. Couples see it. Search engines see it.
              </p>
              <div className="fc-caps">
                <div className="fc-cap">
                  <h3>
                    Photos from couples. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>A couple shares, you approve, it lands on your card with the Verified booking mark.</p>
                  <div className="fc-sgal" aria-label="Sample portfolio">
                    <span className="fc-stag">Sample</span>
                    <div className="fc-sgrid">
                      <figure>
                        <Image src={`${SHOT}/coord-06-announcement.webp`} alt="A garden reception at dusk" width={960} height={720} sizes="180px" />
                        <span className="fc-appr">
                          <small>Shared by the couple</small>
                          <b>Approve</b>
                        </span>
                      </figure>
                      {[
                        { src: `${SHOT6}/04-floor-standee.webp`, w: 600, h: 800, alt: 'Guests at a garden wedding' },
                        { src: `${SHOT6}/09-tablet-at-booth.webp`, w: 800, h: 450, alt: 'A couple at a reception table' },
                        { src: `${SHOT}/coord-05-cue-the-show.webp`, w: 960, h: 720, alt: 'The entrance being cued' },
                        { src: `${SHOT6}/03-nfc-dessert-table.webp`, w: 600, h: 800, alt: 'Champagne glasses at a reception table' },
                        { src: `${SHOT6}/coord-band.webp`, w: 720, h: 900, alt: 'A dining room set for the reception' },
                      ].map((f) => (
                        <figure key={f.src}>
                          <Image src={f.src} alt={f.alt} width={f.w} height={f.h} sizes="180px" />
                          <span className="fc-vbm">✓ Verified booking</span>
                        </figure>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="fc-cap">
                  <h3>
                    Reviews with proof. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>
                    Each one carries “Verified booking”. You can reply. Self-reviews are blocked. Guests leave one from the
                    Review table sign.
                  </p>
                  <p className="fc-trust">No fake reviews. No paid stars. Ever.</p>
                </div>
              </div>
              <InfoToggle id="fc-i10" label="Your page and Google">
                <p>
                  Your page is auto-built and ready for Google the moment you set an address. {PORTFOLIO_FREE_BASE} portfolio
                  photos free.
                </p>
                <p>Event photos placed on your card by themselves.</p>
              </InfoToggle>
            </div>
          </div>
        </section>

        {/* 10 · GROW */}
        <section className="fc-beat">
          <div className="fc-wrap">
            <div className="fc-split fc-money">
              <div className="fc-beat-head">
                <h2>Grow your business, not your fees.</h2>
                <p className="fc-lede">
                  {"Couples pay you directly, to your GCash or bank. It never passes through us. That's your money, and it's yours to keep."}
                </p>
                <p>
                  Setnayan never takes a cut of the deal.{' '}
                  {feeRates
                    ? `You pay a booking fee: ${feeRates.head} on the first ${feeRates.band} of a booking, ${feeRates.tail} after.`
                    : 'You pay a booking fee only on the couples Setnayan brings you.'}
                </p>
              </div>
              {fee && feeRates ? (
                <FeeSlider
                  schedule={{ rate: fee.rate, tailRate: fee.tailRate, tier1LimitPhp: fee.tier1LimitPhp, minPhp: fee.minPhp }}
                  ratePct={feeRates.head}
                  firstStep={{ lead: 'Start with day-of coordination.', rest: `One small booking. The fee is ${feeRates.head}.` }}
                  secondStep={{ lead: 'Add full wedding planning, styling, hosting.', rest: 'Same shop. More categories as you grow.' }}
                  payoff="The bigger you grow, the smaller our share."
                />
              ) : null}
            </div>

            <div className="fc-sub">
              <h3>
                Gifts in your package <Pill kind="free">Free to give</Pill> <Pill kind="plan">You buy the gifts</Pill>
              </h3>
              <p className="fc-lede">
                Put Setnayan in your package. Buy Setnayan services as gifts, like Papic 150, Event Plus or Event Pro, and add
                them to your quote. Your client gets more from your package than they would buying alone, and it arrives
                with their first payment.
              </p>
            </div>

            <div className="fc-sub fc-shelf fc-dark">
              <h3>
                Badges <Pill kind="free">Free</Pill>
              </h3>
              <p>Every event you run here earns a badge couples see on your page. From {badgeSpan()}.</p>
              <div className="fc-ladder fc-ibgrid" aria-label="Setnayan supplier badges">
                <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: BADGE_DEFS }} />
                {BADGES.map((b) => (
                  <figure className="fc-ib" key={b.caption}>
                    <div className="fc-ibs" dangerouslySetInnerHTML={{ __html: b.svg }} />
                    <figcaption>{b.caption}</figcaption>
                  </figure>
                ))}
              </div>
              <p>Climb a badge, and we reward you, free.</p>
              <InfoToggle id="fc-i11" label="Fees, badges and rewards">
                <p>
                  The fee counts only on couples Setnayan brings you. Your own clients, imported or returning, never carry a
                  fee. Your first bookings through Setnayan are free.
                </p>
                <p>
                  Badges climb at {badgeRungs()} finished events; stars come from trusted reviews; years count from the year
                  you started; Top Pick and Most Booked are monthly. Save to print gives you the badge file.
                </p>
                <p>
                  {"Rewards per badge: Papic photo credits for your client's guests, an event upgrade, a free booking fee from 1,000 events."}
                </p>
              </InfoToggle>
            </div>
          </div>
        </section>

        {/* 11 · WORTH IT */}
        <section className="fc-beat fc-ivory">
          <div className="fc-wrap fc-stack">
            <div className="fc-beat-head">
              <h2>Three honest questions.</h2>
              <InfoToggle id="fc-i12" label="Returning couples">
                <p>
                  {"A couple who booked you keeps you in their Setnayan. When their next event comes, you're already there, marked “Returning client · you've worked together before”, with your Returning Couple discount ready."}
                </p>
              </InfoToggle>
            </div>
            <div className="fc-qs">
              <div className="fc-q">
                <h3>Is it worth learning?</h3>
                <p>{"It's free, and Free is built to be very easy. Your page builds itself from what you add."}</p>
              </div>
              <div className="fc-q">
                <h3>{"What's in it for me?"}</h3>
                <p>Found. Booked. Paid directly. One login for every event. A calm event day.</p>
              </div>
              <div className="fc-q">
                <h3>Will I still be here in 10 years?</h3>
                <p>What you build here stays: your reviews, your portfolio, your returning clients, your badges. It adds up.</p>
              </div>
            </div>
            <p className="fc-promise">{"We don't promise you our future. We promise that what you build here is yours."}</p>
          </div>
        </section>

        {/* 12 · EVERYTHING */}
        <section className="fc-beat">
          <div className="fc-wrap">
            <details className="fc-fold" id="fold">
              <summary>
                <h2>Everything you get</h2>
                <span className="fc-see">See the full list</span>
                <div className="fc-fold-sum">
                  {groups.map((g) => (
                    <span className="fc-fchip" key={g.name}>
                      {FOLD_ICON[g.icon]}
                      {g.name}
                      <b>{g.items.length}</b>
                    </span>
                  ))}
                </div>
              </summary>
              <div className="fc-fold-body">
                {groups.map((g) => (
                  <div className="fc-fold-group" key={g.name}>
                    <h3>
                      {FOLD_ICON[g.icon]}
                      {g.name}
                    </h3>
                    <ul>
                      {g.items.map((it) => (
                        <li key={it.text}>
                          <span>{it.text}</span>
                          <span className="fc-tags">
                            <Pill kind={it.tag.kind}>{it.tag.text}</Pill>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </section>

        {/* 13 · PLANS */}
        <section className="fc-beat fc-soft" id="plans">
          <div className="fc-wrap fc-stack">
            <div className="fc-beat-head">
              <h2>{"Free to join. Verified free. Grow when you're ready."}</h2>
              <p className="fc-lede">
                Every tool to run your bookings is free. Paid plans add reach, a bigger team and more branches. Prices are per
                4 weeks.
              </p>
            </div>
            <div className="fc-plans fc-steps3">
              <div className="fc-planstep">
                <span className="fc-n">STEP 1</span>
                <h3>{planName('free')}</h3>
                <p className="fc-pzero">{pesoWords(TIER_PRICE_PHP.free.monthly)}, always</p>
                <p>Every tool to run your bookings.</p>
                <p className="fc-spec">{freeSpec()}</p>
              </div>
              <div className="fc-planstep">
                <span className="fc-n">STEP 2</span>
                <h3>
                  {planName('verified')} <Pill kind="ver">✓</Pill>
                </h3>
                <p className="fc-pzero">{pesoWords(TIER_PRICE_PHP.verified.monthly)}, once your papers are approved</p>
                <p>Couples can find you.</p>
                <p className="fc-spec">{verifiedSpec()}</p>
                <p className="fc-small fc-muted">Your papers: DTI or SEC · BIR 2303 · Permit</p>
              </div>
              <div className="fc-planstep fc-grow">
                <span className="fc-n">STEP 3</span>
                <h3>Grow</h3>
                <p>Pick the size that fits. Prices are per 4 weeks.</p>
                <PlanTiers tiers={tiers} start="pro" />
                {addOns.length > 0 ? (
                  <div className="fc-addons">
                    <p className="fc-ak">Bigger than {planName(addOnPlan)}? Add more.</p>
                    {/* Lane J: every add-on the top plan may buy (owner 2026-11-06), from the SKU each one charges —
                        it listed two of the six. Shared with /for-suppliers (`addonLines`). */}
                    {addOns.map((a) => (
                      <p key={a.kind}>
                        <span>{a.label}</span>
                        <b>{a.price}</b>
                      </p>
                    ))}
                    <p className="fc-fine">Per 4 weeks. Only {planName(addOnPlan)} can add these.</p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="fc-ctools">
              <p className="fc-ak">Coordinators and wedding planners also get, on every plan</p>
              <ul>
                {shownWith(ctools, on).map((t) => (
                  <li key={t.text}>{t.text}</li>
                ))}
              </ul>
              <p className="fc-fine">
                Free, with no end date. Every plan also comes with {helperWord} free Helper{FREE_HELPER_SEATS === 1 ? '' : 's'} for
                the event day.
              </p>
            </div>
            {/* Lane J: the full side-by-side, the SAME table /for-suppliers draws (one plans widget, 2026-11-05). */}
            <SupplierPlanTable
              paywallOn={isVendorFeatureGateEnabled()}
              prices={{
                monthly: { solo: prices.plans.solo.month, pro: prices.plans.pro.month, enterprise: prices.plans.enterprise.month },
                annual: { solo: prices.plans.solo.year, pro: prices.plans.pro.year, enterprise: prices.plans.enterprise.year },
                bySku: prices.bySku,
              }}
            />
            <div className="fc-plans-cta">
              <Link className="fc-btn" href="/open-shop">
                Open your shop free
              </Link>
              <InfoToggle id="fc-i13" label="About prices">
                <p>
                  Verified shops are always shown in search. A shop still waiting for its papers is shown until its first
                  inquiry. Couples pay you directly; Setnayan never holds a peso.
                </p>
              </InfoToggle>
            </div>
          </div>
        </section>

        {/* 14 · CLOSE */}
        <section className="fc-close" id="close">
          <Image className="fc-close-bg" src={`${SHOT}/coord-hero.webp`} alt="" fill sizes="100vw" />
          <div className="fc-wrap">
            <p className="fc-kicker">Set na &rsquo;yan</p>
            <h2>Your business’s new home.</h2>
            <p className="fc-lede">{"Open your shop. It takes two steps, and it's free."}</p>
            <div>
              <Link className="fc-btn fc-close-cta" href="/open-shop">
                Open your shop free
              </Link>
            </div>
            <div>
              <Link className="fc-realshop" href={`/v/${SAMPLE_SHOP.slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a 44 px SVG mark; next/image adds nothing */}
                <img className="fc-mark" src={`${SHOT6}/sw-logo-round-dark.svg`} alt="" width={44} height={44} />
                <span className="fc-t">
                  <small>SEE THE SAMPLE SHOP</small>
                  <b style={{ fontSize: '1.02rem', letterSpacing: '.01em' }}>{SAMPLE_SHOP.name}</b>
                  <span className="fc-mono">setnayan.com/v/{SAMPLE_SHOP.slug}</span>
                </span>
              </Link>
            </div>
            <p className="fc-smallprint">
              <span>Free to join</span>
              {on.dayOfFree ? <span>Day-of desks free</span> : null}
              <span>Your own clients never carry a fee</span>
            </p>
          </div>
        </section>
      </main>

      <div className="fc-dock" aria-hidden="true">
        <Link className="fc-btn" href="/open-shop" tabIndex={-1}>
          Open your shop free
        </Link>
      </div>
    </div>
  );
}
