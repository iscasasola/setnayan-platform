/**
 * /for-suppliers — the owner-approved page of 6 Nov 2026 (`prototypes/for_suppliers_2026-11-06/index.html` in the
 * spec corpus; DECISION_LOG "SUPPLIER FRONT PAGE (/for-suppliers): ONE STORY FOR EVERYONE — APPROVED"). Section by
 * section, the prototype's words; the layout and motion are its own, on the app's tokens
 * (`supplier-front.module.css`).
 *
 * WHERE EVERY NUMBER COMES FROM (the prototype README's table):
 *   · plan prices, year prices, the branch + seat add-ons → `prices`, read by the page from the catalog
 *     (`getVendorPrices`); a price that could not be read shows "—" / "Price unavailable", never a typed figure;
 *   · the booking fee → `fee.schedule`, the LIVE schedule (`getLiveBookingFeeSchedule`), placed by
 *     `bookingFeeFigures` and computed by `bookingFeePhp`; with no schedule, or the fee switched off, no rate is said;
 *   · reach, categories, cards, seats, branches, waiting list, the plan a line sits under → `supplier-front-data.ts`
 *     (TIER_CAPS, the Plans page's own rows, `boothTierCanBrand`);
 *   · the QR codes → `codes`, drawn by the page from the real addresses of the sample shop.
 * The only typed pesos are the four price-shape ILLUSTRATIONS (`PRICE_SHAPE_EXAMPLES`), and the section says so.
 *
 * The shell (`app/(shell)/layout.tsx`) draws the top bar and the footer: the prototype's own header and footer are
 * not drawn here (`for-suppliers-wears-the-shell.test.ts`).
 */
import Image from 'next/image';
import type { ReactNode } from 'react';
import { bookingFeeFigures, type BookingFeeSchedule } from '@/lib/booking-fee';
import { FIRST_BOOKING_FREE } from '@/lib/booking-fee-lock';
import {
  ADDONS_HEAD,
  BADGE_FIRST,
  BADGE_LAST,
  BADGE_STEPS,
  FREE_PHOTOS,
  GROW_TIERS,
  MORE_SEATS_FROM,
  PRICE_SHAPE_EXAMPLES,
  SAMPLE_SHOP,
  VERIFIED_PAPERS,
  VERIFIED_REACH,
  addonsFine,
  foldGroups,
  freeSpec,
  growLines,
  growName,
  growPlus,
  growSpec,
  helperLine,
  reachSentence,
  verifiedSpec,
  type GrowTier,
} from './supplier-front-data';
import {
  CheckADateDemo,
  CtaDock,
  DayStatus,
  FeeStory,
  GrowTiers,
  HeroStage,
  PriceShapeCalc,
  QrChip,
  QrSheetProvider,
  SupplierFrontRoot,
  type GrowCard,
  type HeroSlide,
  type QrEntry,
  type QrKey,
} from './supplier-front-client';
import { Info } from './supplier-front-info';
import { SupplierBadgeShelf } from './supplier-badge-shelf';
import s from './supplier-front.module.css';

export type SupplierFrontPrices = {
  soloMonthly: string | null;
  soloAnnual: string | null;
  proMonthly: string | null;
  proAnnual: string | null;
  enterpriseMonthly: string | null;
  enterpriseAnnual: string | null;
  branch: string | null;
  seat: string | null;
};
/** The booking fee as the page read it: the live schedule (null when unreadable) and whether the fee is switched on. */
export type SupplierFrontFee = { schedule: BookingFeeSchedule | null; enabled: boolean };
/** The four codes that scan to a real address of the sample shop, each with its drawn QR. */
export type SupplierFrontCodes = Record<'shortlist' | 'dates' | 'page' | 'review', { url: string; svg: string }>;

const OPEN_SHOP = '/open-shop';
const CTA = 'Create your shop free';
const A = '/marketing/for-suppliers-2026-11-06';

const HERO: HeroSlide[] = [
  { src: `${A}/supplier-florist-hero.webp`, alt: 'A florist arranging flowers in her shop', dot: 'The dreamer', line: "You've always wanted your own business." },
  { src: `${A}/supplier-photographer-hero.webp`, alt: 'A photographer at work', dot: 'The starter', line: 'You just opened one.' },
  { src: `${A}/supplier-makeup-hero.webp`, alt: 'A make-up artist with her kit', dot: 'Still fighting', line: "You're still fighting to make it stick." },
  { src: `${A}/supplier-caterer-hero.webp`, alt: "A caterer's team plating dinner", dot: 'The established', line: "You've built something that works." },
  { src: `${A}/supplier-team-hero.webp`, alt: "A parent and grown child in the family's shop", dot: 'The family legacy', line: 'Your family has run it for generations.' },
];

const PROBLEMS = [
  { img: 'supplier-01-no-website', alt: 'A Facebook page with no visitors', h: 'Nobody finds you.', p: 'A Facebook page that Google never shows.' },
  { img: 'supplier-02-inquiries', alt: 'A phone full of unread messages', h: 'Inquiries get lost.', p: "Messenger, Viber, SMS. Half aren't serious." },
  { img: 'supplier-03-quotes', alt: 'A quote typed into a chat', h: 'Quotes typed into chats.', p: 'Changed three times. Nobody knows which one was agreed.' },
  { img: 'supplier-04-double-booked', alt: 'A notebook calendar with two bookings on one day', h: 'Two couples, one Saturday.', p: 'The calendar is in a notebook, a chat and your head.' },
  { img: 'supplier-05-payments', alt: 'A supplier chasing a payment by chat', h: 'Chasing payments.', p: 'Reservation, progress, balance. By chat, every time.' },
  { img: 'supplier-11-cut-of-everything', alt: 'A receipt with a cut taken off the top', h: 'Someone takes a cut of every sale.', p: 'Even the clients you brought yourself.' },
] as const;

const FOLD_ICONS: Record<string, ReactNode> = {
  'Get found': (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  ),
  'Get booked': (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M9 14l2 2 4-4" />
    </svg>
  ),
  'Work together': (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3" />
    </svg>
  ),
  'Run the day': (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  Grow: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
    </svg>
  ),
};

function Pill({ kind, children }: { kind: 'free' | 'ver' | 'plan'; children: ReactNode }) {
  return <span className={`${s.pill} ${s[kind]}`}>{children}</span>;
}

/** The pill beside a fold line: Free / Verified / a plan. */
function FoldPill({ pill }: { pill: string }) {
  return <Pill kind={pill === 'Free' ? 'free' : pill === 'Verified' ? 'ver' : 'plan'}>{pill}</Pill>;
}

function Photo({ src, alt, ratio, bleed, sizes = '(min-width: 960px) 50vw, 100vw' }: { src: string; alt: string; ratio?: 'r43' | 'r54'; bleed?: boolean; sizes?: string }) {
  return (
    <div className={`${s.ph} ${ratio ? s[ratio] : ''} ${bleed ? s.bleed : ''}`} data-rv="">
      <Image src={src} alt={alt} fill sizes={sizes} />
    </div>
  );
}

/** What the fee sentences say, from the schedule the page read — or no rate at all. */
function feeWords(fee: SupplierFrontFee) {
  const f = fee.enabled && fee.schedule ? bookingFeeFigures(fee.schedule) : null;
  return {
    figures: f,
    /** The hero ⓘ's middle sentence. */
    heroFee: f
      ? `You pay a booking fee of ${f.head} on the first ${f.band} of a booking and ${f.tail} after.`
      : fee.enabled
        ? 'You pay a booking fee only on couples Setnayan brings you; the rate is shown in full before you agree to any booking.'
        : 'There is no booking fee while it is switched off.',
    /** The Grow beat's fee sentence. */
    growFee: f
      ? `Setnayan never takes a cut of the deal. You pay a booking fee: ${f.head} on the first ${f.band} of a booking, ${f.tail} after.`
      : fee.enabled
        ? 'Setnayan never takes a cut of the deal. You pay a booking fee only on couples Setnayan brings you.'
        : 'Setnayan never takes a cut of the deal, and charges no booking fee while it is switched off.',
  };
}

export function SupplierFrontPage({
  prices,
  fee,
  codes,
  afterPlans,
}: {
  prices: SupplierFrontPrices;
  fee: SupplierFrontFee;
  codes: SupplierFrontCodes;
  /** Drawn at the foot of Plans — the page's door to the couple prices (`the-two-pricing-pages-point-at-each-other`). */
  afterPlans?: ReactNode;
}) {
  const words = feeWords(fee);
  const qr: Record<QrKey, QrEntry> = {
    shortlist: { title: 'Shortlist', body: 'They scan, sign up free, and their event starts with you on it.', ...codes.shortlist, go: 'Open it' },
    dates: { title: 'Check a date', body: 'They see your free and taken days, then ask about one in your chat.', ...codes.dates, go: 'Check a date' },
    page: { title: 'My page', body: 'Your whole shop: services, prices, portfolio and reviews.', ...codes.page, go: 'Open the page' },
    review: { title: 'Review', body: 'Guests scan it at the table and leave you a review on the spot.', ...codes.review, go: 'See the reviews' },
    booked: {
      title: 'Booked · one-use',
      body: 'You make this one in your QR codes screen, for one client only. They scan it, and their event is created with you already booked. It works once.',
    },
    crew: {
      title: 'Crew',
      body: 'One code per event, made in Hub › Crew. Your team scans it and joins once you tap Allow. It ends when the event ends.',
    },
  };
  const price: Record<GrowTier, { mo: string | null; yr: string | null }> = {
    solo: { mo: prices.soloMonthly, yr: prices.soloAnnual },
    pro: { mo: prices.proMonthly, yr: prices.proAnnual },
    enterprise: { mo: prices.enterpriseMonthly, yr: prices.enterpriseAnnual },
  };
  const grow: GrowCard[] = GROW_TIERS.map((t) => ({
    tier: t,
    name: growName(t),
    price: price[t].mo,
    year: price[t].yr,
    spec: growSpec(t),
    plus: growPlus(t),
    lines: growLines(t),
  }));
  const fold = foldGroups();
  const helper = helperLine();
  const pageUrlShown = codes.page.url.replace(/^https?:\/\/(www\.)?/, '');
  const ex = PRICE_SHAPE_EXAMPLES;

  return (
    <SupplierFrontRoot>
      <QrSheetProvider entries={qr} kicker={`Sample · ${SAMPLE_SHOP.name}`}>
        {/* 1 · HERO */}
        <section aria-label="For suppliers">
          <HeroStage slides={HERO} />
          <div className={`${s.wrap} ${s.heroLanding}`}>
            <div className={s.hlA} data-rv="">
              <p className={s.kicker}>For Suppliers</p>
              <h1>Not just a place to sell. A place to stay.</h1>
            </div>
            <div className={s.hlB} data-rv="">
              <p className={s.lede}>Your shop, your calendar, your clients and your event day, in one place. Free to start.</p>
              <div className={s.actions}>
                <a className={s.btn} href={OPEN_SHOP} data-sf-cta="">
                  {CTA}
                </a>
                <a className={s.tlink} href="#close">
                  See a real shop
                </a>
              </div>
              <div className={s.facts}>
                <span>Free to join</span>
                <span>Couples pay you directly</span>
                <span>Only Verified shops are shown</span>
              </div>
              <Info label="How the fee works">
                <p>
                  Free to join and free to run your bookings. Couples pay you straight to your GCash or bank; Setnayan never
                  takes a cut of the deal. {words.heroFee} Your own clients, the ones you bring or import, never carry a fee.
                </p>
              </Info>
            </div>
          </div>
        </section>

        {/* 2 · WHY */}
        <section className={s.beat}>
          <div className={`${s.wrap} ${s.split}`}>
            <div className={s.beatHead} data-rv="">
              <h2>We know building a business is hard.</h2>
              <p className={s.lede}>We built the place we wished existed. Not a stall in a marketplace. A home for your business.</p>
              <Info label="What stays yours">
                <p>
                  Everything you build here is yours: your page, your reviews, your client list, your badges. Nothing here is
                  rented. Nothing resets when you grow.
                </p>
              </Info>
            </div>
            <Photo src={`${A}/supplier-videographer-hero.webp`} alt="A videographer on a step ladder filming dancers rehearsing in a ballroom" ratio="r54" bleed />
          </div>
        </section>

        {/* 3 · HARD TRUTH */}
        <section className={`${s.beat} ${s.dark}`}>
          <div className={`${s.wrap} ${s.stack}`}>
            <div className={s.beatHead} data-rv="">
              <h2>This is what running a business looks like today.</h2>
              <p className={s.lede}>Say it plainly. We&apos;ve all been there.</p>
            </div>
            <div className={s.probs}>
              {PROBLEMS.map((p) => (
                <div key={p.img} className={s.prob} data-rv="">
                  <div className={s.ph}>
                    <Image src={`${A}/${p.img}.webp`} alt={p.alt} fill sizes="(min-width: 960px) 33vw, 104px" />
                  </div>
                  <div>
                    <h3>{p.h}</h3>
                    <p>{p.p}</p>
                  </div>
                </div>
              ))}
            </div>
            <Info label="Six more we hear">
              <p>
                Six more we hear every week: forms the couple never finishes · contracts that are screenshots · stolen photos
                outranking you · a crew sharing one password · couples in another city who never see you · program changes
                nobody told you about.
              </p>
              <p>Every one of these has a tool in the dashboard below.</p>
            </Info>
          </div>
        </section>

        {/* 4 · ONE PLACE */}
        <section className={`${s.beat} ${s.relief}`}>
          <div className={`${s.wrap} ${s.split}`}>
            <div className={s.beatHead} data-rv="">
              <h2>One place. Every tool.</h2>
              <p className={s.lede}>Whether you&apos;re starting, growing or already established, the same shop grows with you.</p>
              <Info label="What Free includes">
                <p>
                  Free gives you the full dashboard: calendar, inquiries, quotes, bookings, payments on record, contracts, your
                  public page and {FREE_PHOTOS} portfolio photos.
                </p>
                <p>
                  Verified (free, once your DTI/SEC, BIR 2303, permit and bank proof are approved) puts you in search{' '}
                  {VERIFIED_REACH} around you. Paid plans add reach, categories, team seats and branches. See Plans below.
                </p>
              </Info>
            </div>
            <div className={s.rows} data-play-once="">
              <div className={s.row}>
                <h3>Starting?</h3>
                <p>Open a shop in two steps. Your page builds itself from what you add.</p>
                <div className={s.meta}>
                  <Pill kind="free">Free</Pill>
                </div>
              </div>
              <div className={s.row}>
                <h3>Growing?</h3>
                <p>Get Verified free. Couples and search engines can find you.</p>
                <div className={s.meta}>
                  <Pill kind="ver">Verified ✓</Pill>
                  <Pill kind="free">Free</Pill>
                </div>
              </div>
              <div className={s.row}>
                <h3>Established?</h3>
                <p>Bring your clients in free and keep them free. Your team, each on their own login.</p>
                <div className={s.meta}>
                  <Pill kind="free">Free</Pill>
                  {MORE_SEATS_FROM ? <Pill kind="plan">{MORE_SEATS_FROM}</Pill> : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5 · GET FOUND */}
        <section className={s.beat}>
          <div className={`${s.wrap} ${s.stack}`}>
            <div className={s.split}>
              <div className={s.beatHead} data-rv="">
                <h2>Couples check your free dates themselves.</h2>
                <p className={s.lede}>
                  From your QR, your page or your shop. They see only two things: available, or not bookable. Never who booked.
                </p>
                <p className={`${s.muted} ${s.small}`}>
                  Tap a day. The ask lands in your chat with the date and the services attached. <Pill kind="free">Free</Pill>
                </p>
                <div className={s.pagebit}>
                  <h3>
                    Your page is your marketing tool. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>Verified seal, photos, service cards, reviews and badges in one link. Put it on your posts, your booth, your table.</p>
                </div>
              </div>
              <div className={s.media}>
                <div className={s.phone} data-rv="">
                  <div className={s.screen}>
                    <div className={s.abar}>
                      <span className={s.mark}>
                        SET<b>NA</b>YAN
                      </span>
                    </div>
                    <CheckADateDemo />
                  </div>
                </div>
              </div>
            </div>

            <div className={s.sub}>
              <h3 data-rv="">
                One QR for every moment <Pill kind="free">Free</Pill>
              </h3>
              <p data-rv="">You don&apos;t pick &quot;a QR code&quot;. You pick the moment.</p>
              <div className={s.moments}>
                <div className={s.moment} data-rv="">
                  <Photo src={`${A}/07-expo-booth.webp`} alt="A backdrop with a QR code at an expo booth" ratio="r43" sizes="(min-width: 720px) 33vw, 100vw" />
                  <p className={s.step}>At a bazaar, an expo, your studio</p>
                  <h3>They find you</h3>
                  <div className={s.codes}>
                    <QrChip k="shortlist" />
                    <QrChip k="dates" />
                    <QrChip k="page" />
                  </div>
                  <p>Shortlist is made by you for one kind of event and one service. They scan, sign up free, and their event starts with you on it.</p>
                  <p className={s.fine}>Printed on your card, standee, backdrop, tarp, table-front and door print.</p>
                </div>
                <div className={s.moment} data-rv="">
                  <Photo src={`${A}/08-card-and-phone-scan.webp`} alt="A couple scans the back of a calling card at the counter" ratio="r43" sizes="(min-width: 720px) 33vw, 100vw" />
                  <p className={s.step}>The deal is closed</p>
                  <h3>They book you</h3>
                  <div className={s.codes}>
                    <QrChip k="booked" />
                  </div>
                  <p>You fill in the deal once. One code, for that client only. They scan, and their event is created with you booked on it.</p>
                  <p className={s.fine}>On the back of your card, or shown on your phone.</p>
                </div>
                <div className={s.moment} data-rv="">
                  <Photo src={`${A}/02-guest-scans-table-tent.webp`} alt="A guest scans a table tent at the welcome table" ratio="r43" sizes="(min-width: 720px) 33vw, 100vw" />
                  <p className={s.step}>For your team and the guests</p>
                  <h3>You&apos;re at their event</h3>
                  <div className={s.codes}>
                    <QrChip k="crew" />
                    <QrChip k="review" />
                  </div>
                  <p>Your team scans Crew and joins once you tap Allow. Guests scan Review on a table sign and leave you a review on the spot.</p>
                  <p className={s.fine}>On a crew card, and a table tent at the welcome table.</p>
                </div>
              </div>
              <Info label="Codes and search reach">
                <p>
                  Every code downloads, shares or copies as a link from your QR codes screen. Only a Verified shop is shown in
                  search: {reachSentence()}. Your page is ready for Google the moment you set an address.
                </p>
                <p>NFC tags, the door sticker and ready-made printed pieces.</p>
              </Info>
            </div>
          </div>
        </section>

        {/* 6 · CUSTOMERS */}
        <section className={`${s.beat} ${s.soft}`}>
          <div className={`${s.wrap} ${s.stack}`}>
            <div className={s.split}>
              <div className={s.beatHead} data-rv="">
                <h2>Talking is easy. The personal touch is yours.</h2>
                <p className={s.lede}>One chat per client, with the quote, the files and the schedule attached. The rest is you.</p>
                <Info label="Returning couples and discounts">
                  <p>
                    A returning couple reads &quot;— a returning client&quot; on the inquiry. Discounts you set (early booking,
                    off-peak, bundle, promo, returning couple) show on your card as one pill, like &quot;10% off · early
                    booking&quot;. A perk you keep off the public card is revealed in the chat once you say yes.
                  </p>
                  <p>Meetings: in person, or a call on your own phone or Viber, booked inside the chat.</p>
                </Info>
              </div>
              <Photo src={`${A}/15-consultation.webp`} alt="A supplier and a couple in a consultation" ratio="r54" />
            </div>
            <div className={s.notices}>
              <div className={s.notice} data-rv="">
                <span className={s.noticeIc}>1</span>
                <div>
                  <h3>
                    &quot;New booking inquiry.&quot; <Pill kind="free">Free</Pill>
                  </h3>
                  <p>With their date, place and headcount attached. Nothing is booked yet.</p>
                </div>
              </div>
              <div className={s.notice} data-rv="">
                <span className={s.noticeIc}>2</span>
                <div>
                  <h3>
                    Send the quote from the chat. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>Package, per guest or per hour. They accept or counter.</p>
                </div>
              </div>
              <div className={s.notice} data-rv="">
                <span className={s.noticeIc}>3</span>
                <div>
                  <h3>
                    &quot;First payment submitted — please confirm.&quot; <Pill kind="free">Free</Pill>
                  </h3>
                  <p>The receipt is attached. Confirm, and the date is held.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7 · PRICE SHAPES */}
        <section className={s.beat}>
          <div className={`${s.wrap} ${s.stack}`}>
            <div className={s.beatHead} data-rv="">
              <h2>Your price, your way.</h2>
              <p className={s.lede}>
                A caterer charges per guest. A band per hour. A tent by size. A photographer one price. All four fit, side by
                side.
              </p>
            </div>
            <div className={s.pshapes}>
              <div className={s.pcard}>
                <div className={s.pcTop}>
                  <span className={s.pcIc}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="9" cy="8" r="3.2" />
                      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
                      <circle cx="17" cy="9" r="2.4" />
                      <path d="M15.8 14.2c2.3.2 4 1.8 4.6 4.8" />
                    </svg>
                  </span>
                  <h3>Per guest</h3>
                </div>
                <p>The headcount quotes itself from the couple&apos;s RSVPs.</p>
                <PriceShapeCalc shape={{ kind: 'n', ...ex.perGuest, unit: 'guests', group: 'Guests' }} />
              </div>
              <div className={s.pcard}>
                <div className={s.pcTop}>
                  <span className={s.pcIc}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M12 7.5V12l3 2" />
                    </svg>
                  </span>
                  <h3>Per hour</h3>
                </div>
                <p>Set the hour and the minimum.</p>
                <PriceShapeCalc shape={{ kind: 'n', ...ex.perHour, unit: 'hours', group: 'Hours' }} />
              </div>
              <div className={s.pcard}>
                <div className={s.pcTop}>
                  <span className={s.pcIc}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 19 12 5l9 14" />
                      <path d="M8 19l4-6 4 6" />
                      <path d="M2.5 19h19" />
                    </svg>
                  </span>
                  <h3>By size</h3>
                </div>
                <p>Small, medium, large; one card each.</p>
                <PriceShapeCalc shape={{ kind: 'list', ...ex.bySize, group: 'Size' }} />
              </div>
              <div className={s.pcard}>
                <div className={s.pcTop}>
                  <span className={s.pcIc}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3.5 12.2V4.5h7.7l9.3 9.3-7.7 7.7z" />
                      <circle cx="8" cy="9" r="1.4" />
                    </svg>
                  </span>
                  <h3>One price</h3>
                </div>
                <p>The package, with inclusions and add-ons.</p>
                <PriceShapeCalc shape={{ kind: 'list', ...ex.onePrice, group: 'Add-ons' }} />
              </div>
            </div>
            <Info label="The quote builder">
              <p>
                The quote builder in the chat offers Flat, Per pax and Per hour, with line items, crew meal and transport, a
                discount with a &quot;why&quot;, and the payment schedule (first payment on booking, then the balance). Sizes are
                separate service cards.
              </p>
              <p>Examples above are illustrations, not prices from the app.</p>
            </Info>
          </div>
        </section>

        {/* 8 · WORKING TOGETHER + THE DAY */}
        <section className={`${s.beat} ${s.soft}`}>
          <div className={`${s.wrap} ${s.split} ${s.flip}`}>
            <div className={s.beatHead} data-rv="">
              <h2>You, the couple and the coordinator. One plan.</h2>
              <p className={s.lede}>Once you&apos;re booked, their event opens to you. On the day, tap your status and the coordinator sees it.</p>
              <div className={s.caps}>
                <div className={s.cap}>
                  <h3>
                    Your moment on their schedule. <Pill kind="free">Free</Pill>
                  </h3>
                  <div className={s.flow}>
                    <span className={s.chip}>Reception reveal · 5:30 PM · 15 min</span>
                    <span className={s.arr}>→</span>
                    <span>coordinator taps Accept</span>
                    <span className={s.arr}>→</span>
                    <span>on every guest&apos;s schedule</span>
                  </div>
                </div>
                <div className={s.cap}>
                  <h3>
                    The headcount updates itself. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>A guest RSVPs, your production sheet changes. Counts only; names never cross.</p>
                </div>
                <div className={s.cap}>
                  <h3>
                    Works with no signal. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>Your event-day screen and schedule are saved on your phone.</p>
                </div>
                <div className={s.cap}>
                  <h3>
                    Your crew, one code per event. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>They scan, you tap Allow. Each phone sees only the tools for the day.</p>
                </div>
              </div>
              <Info label="What opens to you, and the day">
                <p>
                  Your customer card opens the event: snapshot, headcount, meals, style, budget, seat plan, run of show, and the
                  doors for your service (mood board, seat plan, production sheet). Suggest · My times · My moment, then
                  &quot;Lock my times&quot; once you&apos;re set.
                </p>
                <p>
                  Status buttons: On site · Setup done · Ready to start · Packed up · Running late · Need help. The countdown
                  follows the couple&apos;s program.
                </p>
                <p>
                  Tools switch on by your type: production sheet, headcount, shot list, song desk, script and cues, seat plan,
                  mood board, check-in desk. The saved copy reads &quot;Saved for offline · updated 2:10 PM&quot; and turns amber
                  when it&apos;s old on the event day.
                </p>
                <p>
                  Guest QR scanner for the day: live for check-in and finding a seat (coordinator tools), and a supplier-side
                  scanner.
                </p>
              </Info>
            </div>
            <div className={s.media}>
              <div className={s.phone} data-rv="" aria-label="The event-day screen: tap your status and the coordinator sees it">
                <div className={`${s.screen} ${s.dayof}`}>
                  <div className={s.abar}>
                    <span className={s.mark}>
                      SET<b>NA</b>YAN
                    </span>
                  </div>
                  <p className={s.saved}>
                    <i />
                    Saved for offline · updated 2:10 PM
                  </p>
                  <p className={s.dK}>Your status</p>
                  <DayStatus />
                  <p className={s.dK}>Your moment</p>
                  <div className={s.momentRow}>
                    <span className={s.chip}>Reception reveal · 5:30 PM · 15 min</span>
                  </div>
                  <p className={s.dK}>Live reviews</p>
                  <div className={s.rev}>
                    <span className={s.stars} aria-hidden="true">
                      ★★★★★
                    </span>
                    <span className={s.vb}>✓ Verified booking</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 10 · PORTFOLIO */}
        <section className={s.beat}>
          <div className={s.wrap}>
            <div className={s.beatHead} data-rv="">
              <h2>Your portfolio builds itself.</h2>
              <p className={s.lede}>
                Every event you run here adds to your page: photos, reviews, badges. Couples see it. Search engines see it.
              </p>
              <div className={`${s.caps} ${s.pfCaps}`}>
                <div className={s.cap}>
                  <h3>
                    Photos from couples. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>A couple shares, you approve, it lands on your card with the Verified booking mark.</p>
                  <div className={s.sgal} aria-label="Sample photos from couples">
                    <span className={s.stag}>Sample</span>
                    <div className={s.sgrid}>
                      <figure>
                        <Image src={`${A}/supplier-photographer-hero.webp`} alt="A photographer shooting a wedding party" fill sizes="160px" />
                        <span className={s.appr}>
                          <small>Shared by the couple</small>
                          <b>Approve</b>
                        </span>
                      </figure>
                      {[
                        ['04-floor-standee', 'Guests at a garden wedding'],
                        ['09-tablet-at-booth', 'A couple at a reception table'],
                        ['supplier-videographer-hero', 'A videographer filming a rehearsal'],
                        ['03-nfc-dessert-table', 'Champagne glasses at a reception table'],
                        ['supplier-makeup-hero', 'A bride being made up'],
                      ].map(([img, alt]) => (
                        <figure key={img}>
                          <Image src={`${A}/${img}.webp`} alt={alt!} fill sizes="160px" />
                          <span className={s.vbm}>✓ Verified booking</span>
                        </figure>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={s.cap}>
                  <h3>
                    Reviews with proof. <Pill kind="free">Free</Pill>
                  </h3>
                  <p>Each one carries &quot;Verified booking&quot;. You can reply. Self-reviews are blocked.</p>
                  <p className={s.trust}>No fake reviews. No paid stars. Ever.</p>
                  <div className={s.srev} aria-label="Sample review">
                    <span className={s.stag}>Sample</span>
                    <div className={s.urev}>
                      <p className={s.urH}>
                        <b>Verified couple</b>
                        <span className={s.vb}>✓ Verified booking</span>
                      </p>
                      <p className={s.stars} aria-hidden="true">
                        ★★★★★
                      </p>
                      <p>
                        The same-day edit played at dinner and nobody could believe it was shot that morning. Juan’s team was calm
                        the whole day.
                      </p>
                      <div className={s.sreply}>
                        <p className={s.urH}>
                          <b>{SAMPLE_SHOP.name}</b>
                          <span className={s.rk}>Reply from the shop</span>
                        </p>
                        <p>
                          Thank you for trusting us with your day. Watching your guests see the film at dinner was the best part
                          for our whole team.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Info label="Your page and Google">
                <p>Your page is auto-built and ready for Google the moment you set an address. {FREE_PHOTOS} portfolio photos free.</p>
                <p>Event photos placed on your card by themselves.</p>
              </Info>
            </div>
          </div>
        </section>

        {/* 11 · GROW — `#model` is where the old page's fee model sat; a link to it lands on the fee here. */}
        <section className={s.beat} id="model">
          <div className={s.wrap}>
            <div className={s.split}>
              <div className={s.beatHead} data-rv="">
                <h2>Grow your business, not your fees.</h2>
                <p className={s.lede}>
                  Couples pay you directly, to your GCash or bank. It never passes through us. That&apos;s your money, and it&apos;s
                  yours to keep.
                </p>
                <p>{words.growFee}</p>
              </div>
              {fee.enabled && fee.schedule && words.figures ? (
                <FeeStory
                  schedule={fee.schedule}
                  payoff="The bigger you grow, the smaller our share."
                  steps={
                    <>
                      <li data-rv="">
                        <div>
                          <b>Start as a photobooth.</b> One small booking. The fee is {words.figures.head}.
                        </div>
                      </li>
                      <li data-rv="">
                        <div>
                          <b>Add video, coordination, souvenirs.</b> Same shop. More categories as you grow.
                        </div>
                      </li>
                    </>
                  }
                />
              ) : (
                <ol className={s.feeSteps}>
                  <li data-rv="">
                    <div>
                      <b>Start as a photobooth.</b> One small booking.
                    </div>
                  </li>
                  <li data-rv="">
                    <div>
                      <b>Add video, coordination, souvenirs.</b> Same shop. More categories as you grow.
                    </div>
                  </li>
                </ol>
              )}
            </div>

            <div className={s.sub}>
              <h3 data-rv="">
                Gifts in your package <Pill kind="free">Free to give</Pill> <Pill kind="plan">You buy the gifts</Pill>
              </h3>
              <p className={s.lede} data-rv="">
                Put Setnayan in your package. Buy Setnayan services as gifts, like Papic 150, Event Plus or Event Pro, and add
                them to your quote. Your client gets more from your package than they would buying alone, and it arrives with
                their first payment.
              </p>
            </div>

            <div className={`${s.sub} ${s.shelf} ${s.dark}`}>
              <h3 data-rv="">
                Badges <Pill kind="free">Free</Pill>
              </h3>
              <p data-rv="">
                Every event you run here earns a badge couples see on your page. From {BADGE_FIRST} events to {BADGE_LAST}.
              </p>
              <SupplierBadgeShelf className={s.ibgrid} />
              <p>Climb a badge, and we reward you, free.</p>
              <Info label="Fees, badges and rewards">
                <p>
                  The fee counts only on couples Setnayan brings you. Your own clients, imported or returning, never carry a fee.{' '}
                  {FIRST_BOOKING_FREE}
                </p>
                <p>
                  Badges climb at {BADGE_STEPS} finished events; stars come from trusted reviews; years count from the year you
                  started; Top Pick and Most Booked are monthly. Save to print gives you the badge file.
                </p>
                <p>Rewards per badge: Papic photo credits for your client&apos;s guests, an event upgrade, a free booking fee from 1,000 events.</p>
              </Info>
            </div>
          </div>
        </section>

        {/* 12 · WORTH IT */}
        <section className={`${s.beat} ${s.ivory}`}>
          <div className={`${s.wrap} ${s.stack}`}>
            <div className={s.beatHead} data-rv="">
              <h2>Three honest questions.</h2>
              <Info label="Returning couples">
                <p>
                  A couple who booked you keeps you in their Setnayan. When their next event comes, you&apos;re already there,
                  marked &quot;Returning client · you&apos;ve worked together before&quot;, with your Returning Couple discount ready.
                </p>
              </Info>
            </div>
            <div className={s.qs} data-play-once="">
              <div className={s.q}>
                <h3>Is it worth learning?</h3>
                <p>It&apos;s free, and Free is built to be very easy. Your page builds itself from what you add.</p>
              </div>
              <div className={s.q}>
                <h3>What&apos;s in it for me?</h3>
                <p>Found. Booked. Paid directly. One chat per client. A calm event day.</p>
              </div>
              <div className={s.q}>
                <h3>Will I still be here in 10 years?</h3>
                <p>What you build here stays: your reviews, your portfolio, your returning clients, your badges. It adds up.</p>
              </div>
            </div>
            <p className={s.promise}>We don&apos;t promise you our future. We promise that what you build here is yours.</p>
          </div>
        </section>

        {/* 12b · EVERYTHING */}
        <section className={s.beat}>
          <div className={s.wrap}>
            <details className={s.fold} data-rv="">
              <summary>
                <h2>Everything you get</h2>
                <span className={s.see}>See the full list</span>
                <span className={s.foldSum}>
                  {fold.map((g) => (
                    <span key={g.title} className={s.fchip}>
                      {FOLD_ICONS[g.title]}
                      {g.title}
                      <b>{g.lines.length}</b>
                    </span>
                  ))}
                </span>
              </summary>
              <div className={s.foldBody}>
                {fold.map((g) => (
                  <div key={g.title} className={s.foldGroup}>
                    <h3>
                      {FOLD_ICONS[g.title]}
                      {g.title}
                    </h3>
                    <ul>
                      {g.lines.map((l) => (
                        <li key={l.text}>
                          <span>{l.text}</span>
                          <span className={s.tags}>
                            <FoldPill pill={l.pill} />
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
        <section className={`${s.beat} ${s.soft}`} id="plans">
          <div className={`${s.wrap} ${s.stack}`}>
            <div className={s.beatHead} data-rv="">
              <h2>Free to join. Verified free. Grow when you&apos;re ready.</h2>
              <p className={s.lede}>
                Every tool to run your bookings is free. Paid plans add reach, a bigger team and more branches. Prices are per 4
                weeks.
              </p>
            </div>
            <div className={s.plans}>
              <div className={s.planstep} data-rv="">
                <span className={s.planN}>STEP 1</span>
                <h3>Free</h3>
                <p className={s.pzero}>₱0, always</p>
                <p>Every tool to run your bookings.</p>
                <p className={s.spec}>{freeSpec()}</p>
              </div>
              <div className={s.planstep} data-rv="">
                <span className={s.planN}>STEP 2</span>
                <h3>
                  Verified <Pill kind="ver">✓</Pill>
                </h3>
                <p className={s.pzero}>₱0, once your papers are approved</p>
                <p>Couples can find you.</p>
                <p className={s.spec}>{verifiedSpec()}</p>
                <p className={`${s.small} ${s.muted}`}>Your papers: {VERIFIED_PAPERS.join(' · ')}</p>
              </div>
              <div className={s.planstep} data-rv="">
                <span className={s.planN}>STEP 3</span>
                <h3>Grow</h3>
                <p>Pick the size that fits. Prices are per 4 weeks.</p>
                <GrowTiers cards={grow} start="pro" />
                <div className={s.addons}>
                  <p className={s.ak}>{ADDONS_HEAD}</p>
                  <p className={s.addonRow}>
                    <span>+1 branch</span>
                    <b>{prices.branch ?? 'Price unavailable'}</b>
                  </p>
                  <p className={s.addonRow}>
                    <span>+1 team seat</span>
                    <b>{prices.seat ?? 'Price unavailable'}</b>
                  </p>
                  <p className={s.fine}>{addonsFine()}</p>
                </div>
              </div>
            </div>
            {helper ? <p className={`${s.fine} ${s.helper}`}>{helper}</p> : null}
            <div className={s.plansCta} data-rv="">
              <a className={s.btn} href={OPEN_SHOP} data-sf-cta="">
                {CTA}
              </a>
              <Info label="About prices">
                <p>Only Verified shops are shown in search. Couples pay you directly; Setnayan never holds a peso.</p>
              </Info>
            </div>
            {afterPlans}
          </div>
        </section>

        {/* 14 · CLOSE */}
        <section className={s.close} id="close">
          <div className={s.wrap}>
            <p className={s.kicker}>Set na &apos;yan</p>
            <h2>Not just a place to sell. A place to stay.</h2>
            <p className={s.lede}>Open your shop. It takes two steps, and it&apos;s free.</p>
            <div>
              <a className={`${s.btn} ${s.closeCta}`} href={OPEN_SHOP} data-sf-cta="">
                {CTA}
              </a>
            </div>
            <div>
              <a className={s.realshop} href={codes.page.url}>
                <Image src={`${A}/setnayan-productions-logo-round.svg`} alt="" width={44} height={44} unoptimized />
                <span className={s.realshopT}>
                  <small>SEE A REAL SHOP</small>
                  <b>{SAMPLE_SHOP.name}</b>
                  <span className={s.mono}>{pageUrlShown}</span>
                </span>
              </a>
            </div>
            <p className={s.smallprint}>
              <span>Free to join</span>
              <span>Full dashboard free</span>
              <span>Your own clients never carry a fee</span>
            </p>
          </div>
        </section>

        <CtaDock href={OPEN_SHOP} label={CTA} />
      </QrSheetProvider>
    </SupplierFrontRoot>
  );
}
