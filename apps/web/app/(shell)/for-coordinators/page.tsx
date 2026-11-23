/**
 * /for-coordinators — "Your business’s new home." For coordinators and wedding planners.
 *
 * BUILT FROM THE OWNER-APPROVED DRAWING OF 20 NOV 2026 — `prototypes/for_coordinators_2026-11-20/` (specs). Owner,
 * 20 Nov: *"setnayan hom, suppler and coordinator page APPROVED. you can build this"*. It REPLACES the 6 Nov page.
 * Its goal is not For Suppliers' (owner 20 Nov: *"our goal for coordinators is different with suppliers"*): a
 * coordinator brings clients and trusted suppliers in, so the page sells one screen for every client's event and
 * ENDS on the invite link. Top to bottom, in the drawing's words:
 *
 *   hero (the approved personal lines) · we see you · one screen for every client's event · you can't be left out ·
 *   on the day · bring your clients · your shop · invite the suppliers you trust.
 *
 * Discover's look (front-door.css): white page, system type, 14 px pictures with the words on the page, 19/700
 * section heads (`fd-sechead`), 32 px chips (`fd-chip`), the terracotta pill (`fd-btn-terra`). Every ⓘ is a
 * server-rendered <details> (`_fc-info.tsx`), so the page ships no script of its own.
 *
 * ─── A PUBLIC PAGE SAYS ONLY WHAT IS LIVE ─────────────────────────────────────────────────────────────────────────
 * Each line of the drawing that waits for a build shows TODAY's live version here, never "Coming":
 *   · WHISPER WITH YOUR HOSTS — not on the page. The shipped whisper (lib/chat-whisper.ts) is the HOSTS' own
 *     (`sender_role` 'couple'); a coordinator whispering with the hosts is ruled, not built. The drawing's own note:
 *     "must not go live before whisper does." Its chip goes with it.
 *   · THE FREE-BOOKING RULE — LIVE since 16 Nov (`booking_fee_attribution_for`). The page quotes the ONE wording,
 *     `lib/booking-fee-who-words.ts` (SUPPLIER_FREE_BOOKING_LINE · FEE_FREE_CHIP · FEE_SCOPE), never its own sentence.
 *   · "TRUSTED PARTNERS" — the rename is ruled, not built. The app says "preferred supplier" and "Trusted by"
 *     (lib/supplier-invite.ts), so the page does too.
 *   · COORDINATOR SETUP (Coordination already picked, the first card needs a price) — not built. The live door is
 *     `/open-shop?as=coordinator`, which opens step 2 on the coordination services; the three steps say that.
 *   · WHEN AN INVITE COUNTS — the live rule is the supplier's first COMPLETED booking: the ⓘ reads `INVITE_INFO`.
 *   · THE PLANS behind the Your shop ⓘ — the five live plans, each paid price read from the catalogue; the reach
 *     line quotes `reachLadderSentence` — reach has not been a plan allowance since 19 Nov (#8014), as the drawing says.
 *     The fee is the LIVE schedule; unreadable → no rate is named.
 *   · The Invites badge (Bronze → Black Diamond, each step pays once — lib/badge-rewards.ts) and Invite a supplier
 *     (`/i/<shop>`, its QR, "N joined through your link" — Shop › Partnerships) ARE live. No count, no peso.
 *
 * 🔑 NOTHING THAT IS A NUMBER IS TYPED HERE: prices `_prices.server.ts` · plan caps `_facts.ts` · the fee the live
 * schedule · the helper seat `FREE_HELPER_SEATS`. The day-of desks read "free" only while the floor-command paywall
 * itself says so (`on.dayOfFree`); the announcement line shows only while its switch is on.
 *
 * The page sits in the shared shell (`app/(shell)/layout.tsx`) and runs full-bleed (`DOORWAY_BLEED_PATHS`).
 */

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { CardBadgeRow } from '@/app/_components/card-badges/card-badge-row';
import { ServiceFace } from '@/app/_components/service-face';
import { SampleDateFit } from '@/app/for-suppliers/_components/sample-card-date-fit';
import { aboutKmLine } from '@/lib/mall-card';
import { formatPhpRounded } from '@/lib/php';
import type { CardBadgeView } from '@/lib/card-badges';

import { TIERS } from '@/lib/badge-tiers';
import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { bookingFeeCapAmount } from '@/lib/booking-fee';
import { getLiveBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { FEE_FREE_CHIP, FEE_SCOPE, SUPPLIER_FREE_BOOKING_LINE } from '@/lib/booking-fee-who-words';
import { COORDINATOR_AREAS, areaChoices } from '@/lib/delegate-areas';
import { INVITE_INFO } from '@/lib/supplier-invite';
import { TIER_PRICE_PHP } from '@/lib/vendor-tier-caps';

import { shownWith, type ClaimSwitch } from './_claims';
import { readClaimSwitches } from './_claims.server';
import { FREE_HELPER_SEATS, GROW_TIERS, pctWords, pesoWords, planName, reachLadderSentence, type GrowTier } from './_facts';
import { planLine } from '@/app/for-suppliers/_components/supplier-front-data';
import { CLIENTS_FOOTNOTE } from '@/lib/supplier-client-room';
import { FcInfo } from './_fc-info';
import { readCoordinatorPrices } from './_prices.server';

import './_for-coordinators.css';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

/** The drawing's pictures: crops of the app's marketing photos, its feature captures, and the Invites badge art. */
const SHOT = '/marketing/2026-11-20/coordinators';

/** The sample card's badges — the live medals, drawn by the live badge row. */
const SAMPLE_BADGES: readonly CardBadgeView[] = [
  { key: 'rave_reviews', since: null },
  { key: 'quick_responder', since: null },
  { key: 'verified', since: null },
];

/** Every "Start as a coordinator free" — the supplier door, opened on the coordination services. */
const START = '/open-shop?as=coordinator';

const TITLE = 'For Coordinators — Your business’s new home';
const DESCRIPTION =
  'For coordinators and wedding planners: run every client’s event from one screen, run the day from your phone, and invite the suppliers you trust. Free to start.';

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

/* ── one screen for every client's event: the app's own captures ─────────────────────────────────── */

const TOOLS: readonly { src: string; alt: string; name: string; line: string }[] = [
  { src: `${SHOT}/t-guests.webp`, alt: 'The guest list screen', name: 'Guest list', line: 'Replies counted as guests tap.' },
  { src: `${SHOT}/t-seat.webp`, alt: 'The seat plan screen', name: 'Seat plan', line: 'Tables and meal counts.' },
  { src: `${SHOT}/t-seat-3d.webp`, alt: 'The 3D seat plan screen', name: '3D seat plan', line: 'Walk the room before it is set.' },
  { src: `${SHOT}/t-hub.webp`, alt: 'The Event Hub editor', name: 'Event Hub', line: 'The invitation and replies, one link.' },
  { src: `${SHOT}/t-sched.webp`, alt: 'The schedule screen', name: 'Schedule', line: 'Every supplier’s moment on one timeline.' },
];


/** The Check a date sample: March, the seat plan's three kinds of day (a still, never pressable). */
const MARCH_OFF = new Set([1, 8, 9, 15, 22, 23, 29]);
const MARCH_POPULAR = new Set([14, 21, 28]);

/** Each paid plan's one line — the size and what it adds, the same words as /for-suppliers (owner 2026-11-22). */
const PLAN_LINE: Readonly<Record<GrowTier, string>> = {
  solo: planLine('solo'),
  pro: planLine('pro'),
  enterprise: planLine('enterprise'),
};

type Fact = { term: string; line: string; needs?: ClaimSwitch };

function Facts({ rows }: { rows: readonly Fact[] }) {
  return (
    <dl className="fc-facts">
      {rows.map((r) => (
        <div key={r.term}>
          <dt>{r.term}</dt>
          <dd>{r.line}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A part's head: Discover's section heading, then its one short line with the rest behind the ⓘ. */
function Head(props: { id: string; title: string; lede: string; info: ReactNode; infoLabel: string; go?: ReactNode }) {
  return (
    <>
      <h2 className="fd-sechead fc-sechead" id={props.id}>
        <span>{props.title}</span>
        {props.go}
      </h2>
      <div className="fc-lede fc-hasi">
        {props.lede}
        <FcInfo label={props.infoLabel}>{props.info}</FcInfo>
      </div>
    </>
  );
}

export default async function ForCoordinatorsPage() {
  const [on, prices, fee] = await Promise.all([
    readClaimSwitches(),
    readCoordinatorPrices(),
    getLiveBookingFeeSchedule().catch(() => null),
  ]);

  // The day-of rows. The announcement line rides its switch (the composer and its sends are live only while it is on).
  const dayRows: Fact[] = shownWith(
    [
      { term: 'Requests', line: 'One inbox for every supplier’s request.' },
      { term: 'Times', line: 'Times change only with your OK.' },
      { term: 'The door', line: 'Scan a pass. The scanner finds their table.' },
      { term: 'Everyone', line: 'One announcement, every phone.', needs: 'announcements' },
    ],
    on,
  );
  const helpers = FREE_HELPER_SEATS === 1 ? 'one free Helper' : `${FREE_HELPER_SEATS} free Helpers`;

  // What stays with the hosts — read from the coordinator's own access rules, never typed.
  const viewAtMost = (['budget', 'photos'] as const).every(
    (a) => !(areaChoices(a) ?? []).includes('edit') && COORDINATOR_AREAS[a] !== 'edit',
  );

  // The drawing's third access row — true only while the coordinator's default budget grant is OFF.
  const budgetStaysWithHosts = COORDINATOR_AREAS.budget == null;

  return (
    <div className="fc" id="fc-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PAGE_LD) }} />
      <main className="fc-pg">
        {/* ── FIRST SCREEN ── */}
        <section className="fc-hero" id="top" aria-labelledby="h-top">
          <figure className="fc-hp">
            <Image
              src={`${SHOT}/hero.webp`}
              alt="A coordinator in a reception room as the guests are seated"
              fill
              sizes="(min-width: 700px) 720px, 100vw"
              priority
            />
            <figcaption>
              <p className="fc-kick">For coordinators</p>
              <p className="fc-pre">You’ve always run other people’s big days.</p>
              <h1 id="h-top">Your business’s new home.</h1>
              <p className="fc-sub">Run every client’s event from one screen.</p>
            </figcaption>
          </figure>
          <Link className="fd-btn-terra fc-btn" href={START}>
            Start as a coordinator free →
          </Link>
          <p className="fc-fine fc-c">
            {on.dayOfFree ? 'Coordinator tools are free on every plan. No end date.' : 'Free to start. No card needed.'}
          </p>
          <nav className="fd-chips fc-chips" aria-label="On this page">
            <a className="fd-chip" href="#screen">
              One screen
            </a>
            <a className="fd-chip" href="#day">
              The day
            </a>
            <a className="fd-chip" href="#start">
              Rewards
            </a>
          </nav>
        </section>

        {/* ── WE SEE YOU — the two approved lines ── */}
        <section className="fc-seen fc-rv" aria-labelledby="h-seen">
          <h2 id="h-seen">We know running other people’s days is hard.</h2>
          <p>
            You hold the whole day together, and nobody sees it. We built the place where your work is seen, and where
            your business lives.
          </p>
        </section>

        {/* ── ONE SCREEN FOR EVERY CLIENT'S EVENT ── */}
        <section className="fc-part fc-rv" id="screen" aria-labelledby="h-screen">
          <Head
            id="h-screen"
            title="One screen for every client’s event"
            lede="One login opens every event you run."
            infoLabel="About your one screen"
            info={
              <>
                <p>Every event you were given access to sits side by side, with what needs you on top.</p>
                <p>Your clients get the guest list, seat plan, Event Hub and schedule at no cost.</p>
              </>
            }
          />
          <div className="fc-row">
            {TOOLS.map((t) => (
              <figure className="fc-item" key={t.name}>
                <div className="fc-thumb">
                  <Image className="fc-shot" src={t.src} alt={t.alt} width={360} height={450} sizes="150px" />
                </div>
                <figcaption>
                  <b>{t.name}</b>
                  <span>{t.line}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="fc-say">No subscription needed. Your clients start free.</p>
        </section>

        {/* ── YOU CAN'T BE LEFT OUT ── */}
        <section className="fc-part fc-rv" id="access" aria-labelledby="h-access">
          <Head
            id="h-access"
            title="You can’t be left out"
            lede="The hosts open each part of their event to you."
            infoLabel="How access works"
            info={
              <>
                <p>The hosts decide each part: edit, view or off.</p>
                <p>
                  {viewAtMost ? 'Budget and Photos are view at most. ' : null}Publishing the seat plan and sending the
                  first invitation stay with the hosts.
                </p>
              </>
            }
          />
          <figure className="fc-wide">
            <Image
              src={`${SHOT}/access.webp`}
              alt="A coordinator walking through a venue with her folder"
              width={760}
              height={475}
              sizes="(min-width: 700px) 688px, 100vw"
            />
          </figure>
          <Facts
            rows={[
              { term: 'Each part', line: 'Edit, view or off. The hosts decide.' },
              { term: 'The chats', line: 'You are in the supplier chats.' },
              ...(budgetStaysWithHosts
                ? [{ term: 'The budget', line: 'It stays with the hosts until they share it.' }]
                : []),
            ]}
          />
        </section>

        {/* ── ON THE DAY ── */}
        <section className="fc-part fc-rv" id="day" aria-labelledby="h-day">
          <Head
            id="h-day"
            title="On the day, you move the show forward"
            lede="Part by part, from your phone."
            infoLabel="About the event day"
            info={
              <>
                <p>Every guest’s screen follows as you move the show. The hosts can move it too.</p>
                <p>
                  {on.dayOfFree ? 'The day-of tools are free on every plan, with no end date. ' : null}Every plan comes
                  with {helpers} for the event day. Saved for when there is no signal.
                </p>
              </>
            }
          />
          <figure className="fc-wide">
            <Image
              src={`${SHOT}/day.webp`}
              alt="A coordinator cueing the next part of the reception"
              width={760}
              height={475}
              sizes="(min-width: 700px) 688px, 100vw"
            />
          </figure>
          <Facts rows={dayRows} />
        </section>

        {/* ── BRING YOUR CLIENTS — the Booked code ── */}
        <section className="fc-part fc-rv" id="clients" aria-labelledby="h-clients">
          <Head
            id="h-clients"
            title="Bring your clients"
            lede="Their event starts with you already on it."
            infoLabel="How a client comes in"
            info={
              <>
                <p>
                  <b>Booked · one-use.</b> You fill in the deal once. One code, for that client only. They scan, and
                  their event is made with you booked on it.
                </p>
                <p>{SUPPLIER_FREE_BOOKING_LINE}</p>
              </>
            }
          />
          <Facts
            rows={[
              { term: 'Your code', line: 'One Booked code for each client.' },
              { term: 'Their event', line: 'Made on the scan, with you booked on it.' },
            ]}
          />
          <p className="fc-say">{FEE_FREE_CHIP}.</p>
        </section>

        {/* ── YOUR SHOP — one short part; the full pitch is For Suppliers ── */}
        <section className="fc-part fc-rv" id="shop" aria-labelledby="h-shop">
          <Head
            id="h-shop"
            title="Your shop"
            lede="A shop page, service cards and a calendar, like any supplier’s."
            infoLabel="Your shop, fees and plans"
            go={
              <Link className="fd-sechead-go fc-go" href="/for-suppliers">
                For suppliers →
              </Link>
            }
            info={
              <>
                <p>Your shop works like any supplier’s. Badges on a card are earned from real bookings, never bought.</p>
                {fee ? (
                  <p>
                    <b>Booking fee.</b> {pctWords(fee.rate)} up to {pesoWords(fee.tier1LimitPhp)}, {pctWords(fee.tailRate)}{' '}
                    above, {FEE_SCOPE}. The smallest fee is {pesoWords(fee.minPhp)}, and it is locked at{' '}
                    {bookingFeeCapAmount(fee)}: never more, however big the booking.
                  </p>
                ) : null}
                <p>{SUPPLIER_FREE_BOOKING_LINE}</p>
                <p>
                  <b>
                    {planName('free')} · {pesoWords(TIER_PRICE_PHP.free.monthly)}.
                  </b>{' '}
                  {planLine('free')}
                </p>
                <p>
                  <b>
                    {planName('verified')} · {pesoWords(TIER_PRICE_PHP.verified.monthly)}.
                  </b>{' '}
                  {planLine('verified')}
                </p>
                {GROW_TIERS.map((t) => (
                  <p key={t}>
                    <b>
                      {planName(t)}
                      {prices.plans[t].month ? ` · ${prices.plans[t].month}` : ''}.
                    </b>{' '}
                    {PLAN_LINE[t]}
                  </p>
                ))}
                <p>{CLIENTS_FOOTNOTE}</p>
                <p>No plan limits bookings or reach. Only a Verified shop is shown in search: {reachLadderSentence()}.</p>
              </>
            }
          />
          <div className="fc-row fc-cards">
            {/* The LIVE service card, exactly as main draws it (ServiceFace + CardBadgeRow) — never a hand copy. */}
            <div className="fc-sf">
              <ServiceFace
                layout="mall"
                name="On-the-day coordination"
                coverUrl={`${SHOT}/c-coord.webp`}
                shop={{ name: 'Amihan Events', href: null, logoUrl: null, verified: true }}
                city="Taguig"
                rating={{ avg: 4.9, count: 64 }}
                price={formatPhpRounded(24999)}
                priceNote="2 coordinators, 12 hours"
                lines={<SampleDateFit />}
                distance={aboutKmLine(8)}
                medals={
                  <CardBadgeRow
                    badges={SAMPLE_BADGES}
                    cardName="On-the-day coordination"
                    shopName="Amihan Events"
                    now={0}
                  />
                }
              />
            </div>
            <figure
              className="fc-seatm"
              role="img"
              aria-label="Check a date, March: green days can be asked about, striped days are not bookable"
            >
              <figcaption>
                <b>Check a date</b>
                <span>March</span>
              </figcaption>
              <div className="fc-dow" aria-hidden="true">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <i key={i}>{d}</i>
                ))}
              </div>
              <div className="fc-grid" aria-hidden="true">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <b key={d} className={MARCH_OFF.has(d) ? 'fc-d fc-no' : MARCH_POPULAR.has(d) ? 'fc-d fc-pop' : 'fc-d'}>
                    {d}
                    {MARCH_POPULAR.has(d) ? <u>✦</u> : null}
                  </b>
                ))}
              </div>
              <p className="fc-key" aria-hidden="true">
                <span>
                  <b className="fc-d" />
                  Available
                </span>
                <span>
                  <b className="fc-d fc-no" />
                  Not bookable
                </span>
                <span>
                  <b className="fc-d fc-pop">
                    <u>✦</u>
                  </b>
                  Popular
                </span>
              </p>
            </figure>
          </div>
          <p className="fc-fine fc-pad">A sample card and calendar. Hosts see free days, never who booked.</p>
        </section>

        {/* ── THE END — invite the suppliers you trust (Shop › Partnerships) ── */}
        <section className="fc-close fc-rv" id="start" aria-labelledby="h-close">
          <p className="fc-kick2">Your preferred suppliers</p>
          <h2 id="h-close">Invite the suppliers you trust.</h2>
          <div className="fc-lede fc-big fc-hasi">
            Each Invites tier you reach pays a reward. Free.
            <FcInfo label="How rewards work">
              <p>{INVITE_INFO}</p>
              <p>
                The Invites badge has {TIERS.length} tiers, {TIERS[0]?.name} to {TIERS[TIERS.length - 1]?.name}. Each tier
                pays its reward once.
              </p>
              <p>Suppliers who join show on your shop page, under Trusted by.</p>
            </FcInfo>
          </div>
          <div className="fc-tiers" role="img" aria-label={`The Invites badge, from ${TIERS[0]?.name} to ${TIERS[TIERS.length - 1]?.name}`}>
            {/* The approved Invites art, one picture per tier of lib/badge-tiers.ts, in order. */}
            {TIERS.map((t, i) => (
              <Image key={t.key} src={`${SHOT}/invites-${i}.webp`} alt="" width={162} height={174} sizes="56px" />
            ))}
          </div>
          <p className="fc-fine fc-c fc-tl">
            The Invites badge · {TIERS[0]?.name} to {TIERS[TIERS.length - 1]?.name}
          </p>
          <div className="fc-ref" role="img" aria-label="A sample of Invite a supplier: a QR code, your link, Share and Copy link">
            <FcSampleQr />
            <div className="fc-rt">
              <b>Invite a supplier</b>
              <span className="fc-lk">
                setnayan.com/i/<b>yourshop</b>
              </span>
              <span className="fc-ps">
                <i className="fc-p1">Share</i>
                <i>Copy link</i>
              </span>
            </div>
          </div>
          <p className="fc-fine fc-pad">Only invite those you trust.</p>
          <ol className="fc-two">
            <li>
              <span className="fc-n">1</span>Name your shop. The coordination services come first.
            </li>
            <li>
              <span className="fc-n">2</span>Add your first service card.
            </li>
            <li>
              <span className="fc-n">3</span>Share your link with the suppliers you trust.
            </li>
          </ol>
          <Link className="fd-btn-terra fc-btn" href={START}>
            Start as a coordinator free →
          </Link>
          <p className="fc-fine fc-c">Free to start. No card needed.</p>
        </section>
      </main>

      <footer className="fc-foot">
        <nav aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/pricing">Plans</Link>
          <Link href="/for-suppliers">For suppliers</Link>
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}

/**
 * The invite still's QR — a MADE pattern, as in the drawing, not a real code: a real one here would scan to a shop
 * that does not exist. A coordinator's own link and QR are in Shop › Partnerships.
 */
function FcSampleQr() {
  const mods: [number, number][] = [];
  for (let y = 0; y < 25; y++) {
    for (let x = 0; x < 25; x++) {
      const inFinder = (x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16);
      if (!inFinder && ((x * 7 + y * 13 + x * y) % 5 === 0 || (x + y * 3) % 11 === 0)) mods.push([x, y]);
    }
  }
  const finder = (x: number, y: number) => (
    <g key={`f${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} />
      <rect className="fc-qh" x={x + 1} y={y + 1} width={5} height={5} />
      <rect x={x + 2} y={y + 2} width={3} height={3} />
    </g>
  );
  return (
    <svg className="fc-qr" viewBox="-2 -2 29 29" aria-hidden="true">
      <rect className="fc-qh" x={-2} y={-2} width={29} height={29} />
      {finder(0, 0)}
      {finder(18, 0)}
      {finder(0, 18)}
      {mods.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} />
      ))}
    </svg>
  );
}
