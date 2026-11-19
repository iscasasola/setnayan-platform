/**
 * /for-suppliers — the owner-approved page of 20 Nov 2026 (`prototypes/for_suppliers_2026-11-20/` in the spec corpus:
 * `site/index.html` is the drawing, `notes.html` its rulings). "Run the business you already have." It REPLACES the
 * 6 Nov page (`prototypes/for_suppliers_2026-11-06/`) section for section; the drawing's words, on the app's tokens
 * (`supplier-front.module.css`) and Discover's own section heads, chips and button (`front-door.css`).
 *
 * 🚦 A LINE SHIPS ONLY WHEN ITS BUILD IS LIVE (owner, 20 Nov 2026). Where the drawing names something the app does
 * not do yet, this page says what the app does TODAY, and never "Coming":
 *   · the fee: the drawing's rates, its ceiling ("locks there") and "every 100,000th fee is on us" are NOT built — the
 *     page places the LIVE schedule (`bookingFeeFigures`, `bookingFeePhp`) and draws no ceiling and no such switch;
 *   · who books free: the drawing's "first supplier brought onto the event" is not built — the switches are the free
 *     bookings that are live (a client you bring; your first booking from Setnayan; a badge's free booking fee ticket);
 *   · the fee is charged when the client agrees to book (`BOOKING_FEE_CHARGED_WHEN`), not with the first payment;
 *   · the gift with every booking (drawn "Coming") is not built, so its section is not drawn at all;
 *   · Plans: the Ultra Add-on and storage are not live, so the ⓘ names only the live caps (`TIER_CAPS`), and the fine
 *     line claims only what is true on every plan (inquiries are never limited).
 *
 * WHERE EVERY NUMBER COMES FROM: plan prices → `prices` (`getVendorPrices`, the catalog; "—" when unread) · the fee
 * → `fee.schedule` (the LIVE schedule) · caps → `TIER_CAPS` · the papers → `VERIFIED_PAPERS` · the sample cards'
 * prices are formatted from numbers, and the section says they are samples.
 *
 * The shell (`app/(shell)/layout.tsx`) draws the top bar and the footer: the drawing's header and footer are not drawn
 * here (`for-suppliers-wears-the-shell.test.ts`).
 */
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { bookingFeeFigures, bookingFeeMinimumAmount, type BookingFeeSchedule } from '@/lib/booking-fee';
import { BOOKING_FEE_CHARGED_WHEN, FIRST_BOOKING_ON_US } from '@/lib/booking-fee-lock';
import { FEE_FREE_CHIP, FEE_FREE_RULE, FEE_SCOPE } from '@/lib/booking-fee-who-words';
import { TIER_CAPS, type VendorTier } from '@/lib/vendor-tier-caps';
import { countNoun, formatCount } from '@/lib/format-number';
import { formatPeso } from '@/lib/v2-catalog-pure';
import { CARD_MEDALS } from '@/lib/public-badges';
import { openShopWithPlanHref } from '@/lib/supplier-plan-offer';
import { ServiceFace, includesLineOf } from '@/app/_components/service-face';
import { CardBadgeRow } from '@/app/_components/card-badges/card-badge-row';
import type { CardBadgeView } from '@/lib/card-badges';
import { FREE_FINDABLE } from './plan-table-data';
import { GROW_TIERS, VERIFIED_PAPERS, growName, verifiedSpec } from './supplier-front-data';
import { FeeRuler, PlanRows, type FreeWhen, type PlanRow } from './supplier-front-client';
import { Info } from './supplier-front-info';
import s from './supplier-front.module.css';

export type SupplierFrontPrices = {
  soloMonthly: string | null;
  soloAnnual: string | null;
  /** What a year saves against 13 blocks of 4 weeks (`getVendorPrices().*AnnualSave`), or null when unread. */
  soloAnnualSave: string | null;
  proMonthly: string | null;
  proAnnual: string | null;
  proAnnualSave: string | null;
  enterpriseMonthly: string | null;
  enterpriseAnnual: string | null;
  enterpriseAnnualSave: string | null;
  branch: string | null;
  seat: string | null;
  /** Every active `vendor_billing_catalog` row by sku_code, formatted (`getVendorPrices().bySku`). */
  bySku: Readonly<Record<string, string | null>>;
};
/** The booking fee as the page read it: the live schedule (null when unreadable) and whether the fee is switched on. */
export type SupplierFrontFee = { schedule: BookingFeeSchedule | null; enabled: boolean };
/** The four codes that scan to a real address of the sample shop, each with its drawn QR. */
export type SupplierFrontCodes = Record<'shortlist' | 'dates' | 'page' | 'review', { url: string; svg: string }>;

const OPEN_SHOP = '/open-shop';
const CTA = 'Open your shop free';
const FREE_LINE = 'Free to start. Free to stay. No card needed.';
const A = '/marketing/2026-11-20/for-suppliers';

/** "Free 1 · Verified 3 · Plus 10 · …" — one cap across every plan, read from `TIER_CAPS`. */
const ALL_TIERS: readonly VendorTier[] = ['free', 'verified', ...GROW_TIERS];
const tierName = (t: VendorTier) => (t === 'free' ? 'Free' : t === 'verified' ? 'Verified' : growName(t));
function capLine(read: (t: VendorTier) => number, from: readonly VendorTier[] = ALL_TIERS): string {
  return from
    .filter((t) => read(t) > 0)
    .map((t) => `${tierName(t)} ${formatCount(read(t))}`)
    .join(' · ');
}

/** The sample cards' prices — formatted from numbers, never typed as figures. */
const peso = (n: number) => `₱${formatPeso(n)}`;
const SAMPLE_CARDS: ReadonlyArray<{
  name: string;
  path: string;
  cover: string;
  shop: string;
  price: number;
  includes: readonly string[];
  notIncluded: readonly string[];
  badges: readonly CardBadgeView[];
}> = [
  {
    name: 'Full-day photo & video',
    path: 'Photographers · Photo & video',
    cover: `${A}/c-photo.webp`,
    shop: 'Lumen Studio',
    price: 45999,
    includes: ['2 shooters', 'Online album', 'Same-day edit'],
    notIncluded: ['crew meal'],
    badges: [
      { key: 'trending_now', since: null },
      { key: 'verified', since: null },
    ],
  },
  {
    name: 'Bridal make-up and hair',
    path: 'Hair & make-up · Bridal',
    cover: `${A}/c-makeup.webp`,
    shop: 'Blush by Ria',
    price: 18999,
    includes: ['Trial session', 'Airbrush', 'Touch-ups'],
    notIncluded: [],
    badges: [
      { key: 'quick_responder', since: null },
      { key: 'rave_reviews', since: null },
      { key: 'verified', since: null },
    ],
  },
  {
    name: 'Event highlights film',
    path: 'Videographers · Highlights',
    cover: `${A}/c-video.webp`,
    shop: 'Reel Day Films',
    price: 35999,
    includes: ['4-minute film', 'Drone shots', 'Raw files'],
    notIncluded: [],
    badges: [{ key: 'hot_booking', since: null }],
  },
];

function SecHead({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 className={`fd-sechead ${s.sechead}`} id={id}>
      <span>{children}</span>
    </h2>
  );
}

/** The lede with its ⓘ — the line visible, the rest inside (owner 2026-10-23, details-go-inside-the-info-tip). */
function Lede({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className={s.lede}>
      <Info label={text}>{children}</Info>
    </div>
  );
}

const TOOLS: ReadonlyArray<{ img?: string; alt?: string; b: string; t: string; chat?: true }> = [
  { img: 't-clients', alt: 'A supplier showing a couple their plan on a tablet', b: 'Your clients', t: 'Add the ones you already have.' },
  { chat: true, b: 'Your chat', t: 'Quote and payments, agreed in one place.' },
  { img: 't-cal', alt: 'The Check a date calendar on a phone', b: 'Your calendar', t: 'Clients see your free dates, never who booked.' },
  { img: 't-qr', alt: 'A guest scanning a supplier’s QR card', b: 'Your QR and links', t: 'One for every moment.' },
  { img: 't-price', alt: 'A caterer plating a dish', b: 'Your prices', t: 'Per guest, per hour, by size or one price.' },
];

export function SupplierFrontPage({
  prices,
  fee,
  afterPlans,
}: {
  prices: SupplierFrontPrices;
  fee: SupplierFrontFee;
  /** The sample shop's codes — the 6 Nov page drew them; the 20 Nov drawing does not. Optional so the lab still type-checks. */
  codes?: SupplierFrontCodes;
  /** The supplier feature paywall's state (`isVendorFeatureGateEnabled`). Kept for the callers; the 20 Nov page draws no paywall line. */
  paywallOn: boolean;
  /** Drawn under the plans — the page passes the "Couple pricing" return leg (`/pricing` ↔ `/for-suppliers`). */
  afterPlans?: ReactNode;
}) {
  const f = fee.enabled && fee.schedule ? bookingFeeFigures(fee.schedule) : null;
  const tapers = fee.schedule ? fee.schedule.tailRate < fee.schedule.rate : false;
  const cards = (t: VendorTier) => TIER_CAPS[t].serviceCardsTotal;

  const freeWhen: FreeWhen[] = [
    { label: 'You bring the event first', hint: FEE_FREE_CHIP },
    { label: 'A couple you brought onto Setnayan', hint: FEE_FREE_RULE },
    { label: 'It is your first booking from Setnayan', hint: FIRST_BOOKING_ON_US },
    { label: 'You have a free booking fee ticket', hint: 'Your ticket is used on your next booking, automatically.' },
  ];

  const planRows: PlanRow[] = [
    { name: 'Free', line: 'Run the business you already have.', price: '₱0', per: 'always', cta: CTA },
    { name: 'Verified', line: 'Be found on Discover and Find.', price: '₱0', per: 'always', cta: CTA },
    ...GROW_TIERS.map((t) => ({
      name: growName(t),
      line: { solo: 'Something to test on, with a small team.', pro: 'The complete business package.', enterprise: 'Expand: more people, cards and branches.' }[t],
      price: { solo: prices.soloMonthly, pro: prices.proMonthly, enterprise: prices.enterpriseMonthly }[t],
      per: 'per 4 weeks',
      cta: `Start on ${growName(t)}`,
      href: openShopWithPlanHref(t),
    })),
  ];

  return (
    <div className={s.root}>
      {/* 1 · HERO */}
      <section className={s.hero} aria-labelledby="sf-h-top">
        <figure className={s.hp}>
          <Image src={`${A}/hero.webp`} alt="A florist setting a long table before a reception" fill priority sizes="(min-width: 760px) 720px, 100vw" />
          <figcaption>
            <p className={s.kick}>For suppliers</p>
            <h1 id="sf-h-top">Run the business you already have.</h1>
            <p className={s.sub}>Your clients, quotes and dates. One free place.</p>
          </figcaption>
        </figure>
        <Link className={`fd-btn-terra ${s.btn}`} href={OPEN_SHOP} data-sf-cta="">
          {CTA} →
        </Link>
        <p className={`${s.fine} ${s.c}`}>{FREE_LINE}</p>
        <nav className={`fd-chips ${s.chips}`} aria-label="On this page">
          <a className="fd-chip" href="#tools">Free tools</a>
          <a className="fd-chip" href="#verified">Get Verified free</a>
          <a className="fd-chip" href="#fees">Fees</a>
          <a className="fd-chip" href="#plans">Plans</a>
        </nav>
      </section>

      {/* 2 · YOUR TOOLS */}
      <section className={s.part} id="tools" aria-labelledby="sf-h-tools" data-rv="">
        <SecHead id="sf-h-tools">Your tools</SecHead>
        <Lede text="Free on every plan. Bring your clients with you.">
          <p>
            Every shop gets the chat with quotes and pay plans, the calendar, QR codes and links, service cards, a shop
            page and Today. Add the clients you already have, one by one or by your QR.
          </p>
        </Lede>
        <div className={s.row}>
          {TOOLS.map((t) => (
            <figure key={t.b} className={s.item}>
              <div className={s.thumb}>
                {t.chat ? (
                  <div className={s.chat} role="img" aria-label="A sample chat: a date is asked, a quote is sent, then accepted">
                    <p className={s.them}>Free on 14 March?</p>
                    <p className={s.q}>
                      <b>Quote</b>
                      <span>Full-day photo &amp; video</span>
                      <em>{peso(45999)}</em>
                    </p>
                    <p className={s.ok}>Accepted</p>
                  </div>
                ) : (
                  <Image src={`${A}/${t.img}.webp`} alt={t.alt ?? ''} width={360} height={450} sizes="180px" />
                )}
              </div>
              <figcaption>
                <b>{t.b}</b>
                <span>{t.t}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* 3 · YOUR SHOP PAGE */}
      <section className={s.part} id="shop" aria-labelledby="sf-h-shop" data-rv="">
        <SecHead id="sf-h-shop">Your shop page</SecHead>
        <Lede text="One address, on every plan.">
          <p>Your photos, service cards and reviews live at one address. The address is yours for good.</p>
        </Lede>
        <figure className={s.wide}>
          <Image src={`${A}/shop.webp`} alt="A couple opening a supplier’s shop page on a tablet" width={760} height={475} sizes="(min-width: 760px) 720px, 100vw" />
          <figcaption className={s.addr}>
            setnayan.com/<b>yourshop</b>
          </figcaption>
        </figure>
      </section>

      {/* 4 · START FREE. GET VERIFIED FREE. */}
      <section className={s.part} id="verified" aria-labelledby="sf-h-ver" data-rv="">
        <SecHead id="sf-h-ver">Start free. Get Verified free.</SecHead>
        <p className={s.ledeText}>Both cost ₱0. One runs your business. One gets you found.</p>
        <ol className={s.steps}>
          <li>
            <span className={s.n}>1</span>
            <div>
              <b>
                Free <em>₱0</em>
              </b>
              <span>Run the business you already have.</span>
              <Info label="About Free">
                <p>
                  Our tools, your clients, {countNoun(cards('free'), 'live service card', 'live service cards')} and a full shop
                  page, {FREE_FINDABLE}.
                </p>
              </Info>
            </div>
          </li>
          <li>
            <span className={s.n}>2</span>
            <div>
              <b>
                Verified <em>₱0</em>
              </b>
              <span>Be found on Discover and Find.</span>
              <Info label="About Verified">
                <p>
                  Send {formatCount(VERIFIED_PAPERS.length)} business papers once: {VERIFIED_PAPERS.join(', ')}. A person checks
                  them.
                </p>
                <p>
                  Then: {verifiedSpec()}, and {countNoun(cards('verified'), 'live service card', 'live service cards')}.
                </p>
              </Info>
            </div>
          </li>
        </ol>
        <p className={s.say}>No fakes on Setnayan. Reviews come only from completed bookings.</p>
      </section>

      {/* 5 · YOUR SERVICE CARDS */}
      <section className={s.part} id="cards" aria-labelledby="sf-h-cards" data-rv="">
        <SecHead id="sf-h-cards">Your service cards</SecHead>
        <Lede text="Medals are earned from real bookings. Never bought.">
          <p>
            {CARD_MEDALS.length === 6 ? 'Six' : formatCount(CARD_MEDALS.length)} medals can sit on a card:{' '}
            {CARD_MEDALS.map((m) => m.name).join(', ')}. Your shop also earns badges and seals. None can be paid for.
          </p>
        </Lede>
        <ul className={`${s.row} ${s.cards}`}>
          {SAMPLE_CARDS.map((c) => (
            <li key={c.name} className={s.card}>
              <ServiceFace
                name={c.name}
                coverUrl={c.cover}
                path={c.path}
                shop={{ name: c.shop, href: null, logoUrl: null, verified: c.badges.some((b) => b.key === 'verified') }}
                price={peso(c.price)}
                includes={includesLineOf(c.includes)}
                notIncluded={c.notIncluded}
                footer={<CardBadgeRow badges={c.badges} cardName={c.name} shopName={c.shop} now={0} />}
              />
            </li>
          ))}
        </ul>
        <p className={s.fine}>Sample cards. The same card shows in Find, on your shop page and in chats.</p>
      </section>

      {/* 6 · FEES */}
      <section className={s.part} id="fees" aria-labelledby="sf-h-fees" data-rv="">
        <SecHead id="sf-h-fees">Grow your business, not your fees</SecHead>
        <Lede text={`A booking fee applies to a booking, ${FEE_SCOPE}.`}>
          <p>Setnayan never takes a cut of the deal.</p>
          {f && fee.schedule ? (
            <>
              <p>
                <b>When it is charged.</b> {BOOKING_FEE_CHARGED_WHEN} The smallest fee is{' '}
                {bookingFeeMinimumAmount(fee.schedule)}.
              </p>
              <p>
                <b>How much.</b> {f.head} of the first {f.band} of a booking, then {f.tail} of the rest.
              </p>
            </>
          ) : (
            <p>
              {fee.enabled
                ? 'The booking fee is shown in full before you agree to any booking.'
                : 'There is no booking fee while it is switched off.'}
            </p>
          )}
          <p>
            <b>Who books you free.</b> {FEE_FREE_RULE}
          </p>
          <p>
            <b>Your first booking.</b> {FIRST_BOOKING_ON_US}
          </p>
          <p>
            <b>Free booking fee tickets.</b> Some badge steps give you a ticket. It is applied automatically to your next
            booking that carries the fee, and that booking’s fee is free.
          </p>
          <p>
            <b>Your customers never see the fee.</b> We add nothing to your price.
          </p>
        </Lede>
        {f && fee.schedule ? (
          <div className={s.fee}>
            <p className={s.feeK}>On a booking that carries the fee</p>
            <div className={s.feeRow}>
              <b className={s.feeN}>{f.head}</b>
              <p className={s.feeT}>
                <span>of the first {f.band}</span>
                <span className={s.feeCap}>{f.tail} after that</span>
              </p>
            </div>
            <FeeRuler schedule={fee.schedule} freeWhen={freeWhen} />
            {tapers ? <p className={s.fbSay}>The bigger you grow, the smaller our share.</p> : null}
            <p className={s.feeWhen}>{BOOKING_FEE_CHARGED_WHEN}</p>
            <p className={s.feeWhen}>
              <b>{FEE_FREE_CHIP}.</b> {FEE_FREE_RULE}
            </p>
          </div>
        ) : null}
        <p className={s.fine}>Hosts never see the fee. They never pay it.</p>
      </section>

      {/* 7 · PLANS */}
      <section className={s.part} id="plans" aria-labelledby="sf-h-plans" data-rv="">
        {/* The drawing's "Compare →" is not drawn: no public page compares the supplier plans yet (/pricing is the
            couples' page, and the return leg to it is `afterPlans`). */}
        <SecHead id="sf-h-plans">Plans</SecHead>
        <Lede text="Upgrade only to manage more.">
          <p>
            <b>Live cards.</b> {capLine(cards)}.
          </p>
          <p>
            <b>People.</b> {capLine((t) => TIER_CAPS[t].agentAccounts + 1)}.
          </p>
          <p>
            <b>Branches.</b> {capLine((t) => TIER_CAPS[t].branchesIncluded)}.
          </p>
        </Lede>
        <PlanRows rows={planRows} href={OPEN_SHOP} />
        <p className={s.fine}>No plan limits your inquiries.</p>
        {afterPlans ? <div className={s.after}>{afterPlans}</div> : null}
      </section>

      {/* 8 · CLOSE */}
      <section className={s.close} id="start" aria-labelledby="sf-h-close" data-rv="">
        <figure className={s.wide}>
          <Image src={`${A}/close.webp`} alt="A supplier team planning around a tablet" width={760} height={427} sizes="(min-width: 760px) 720px, 100vw" />
        </figure>
        <h2 id="sf-h-close">Open your shop. Then make your first service card.</h2>
        <ol className={s.two}>
          <li>
            <span className={s.n}>1</span>Name your shop. It becomes your address.
          </li>
          <li>
            <span className={s.n}>2</span>Make your first service card, right in setup.
          </li>
        </ol>
        <Link className={`fd-btn-terra ${s.btn}`} href={OPEN_SHOP}>
          {CTA} →
        </Link>
        <p className={`${s.fine} ${s.c}`}>{FREE_LINE}</p>
      </section>
    </div>
  );
}
