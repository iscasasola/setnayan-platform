/**
 * /for-suppliers — the owner-approved page of 20 Nov 2026 (`prototypes/for_suppliers_2026-11-20/` in the spec corpus:
 * `site/index.html` is the drawing, `notes.html` its rulings). "Run the business you already have." It REPLACES the
 * 6 Nov page (`prototypes/for_suppliers_2026-11-06/`) section for section; the drawing's words, on the app's tokens
 * (`supplier-front.module.css`) and Discover's own section heads, chips and button (`front-door.css`).
 *
 * 🚦 A LINE SHIPS ONLY WHEN ITS BUILD IS LIVE (owner, 20 Nov 2026). Where the drawing names something the app does
 * not do yet, this page says what the app does TODAY, and never "Coming":
 *   · the fee: the LIVE schedule (`bookingFeeFigures`, `bookingFeePhp`) with its ₱100,000 lock (`bookingFeeCapAmount`,
 *     PR #8061) — the lede, the "Never more than" line and the ruler's lock; "every 100,000th fee is on us" is live in
 *     billing but this page does not read its N yet, so it is not a switch;
 *   · who books free: the switches are the free bookings that are live (you bring the event first; a client you brought
 *     onto Setnayan; a badge's free booking fee ticket). A first booking from Setnayan is NOT free since 20 Nov
 *     ("BILLING MUST FOLLOW THE RETIRED COPY", PR #8061);
 *   · the fee is charged when the client agrees to book (`BOOKING_FEE_CHARGED_WHEN`), not with the first payment;
 *   · the gift with every booking (drawn "Coming") is not built, so its section is not drawn at all;
 *   · Plans: the Ultra Add-on and storage are not live, so the ⓘ names only the live caps (`TIER_CAPS`), and the fine
 *     line claims only what is true on every plan (inquiries are never limited).
 *
 * WHERE EVERY NUMBER COMES FROM: plan prices → `prices` (`getVendorPrices`, the catalog; "—" when unread) · the fee
 * → `fee.schedule` (the LIVE schedule) · caps → `TIER_CAPS` · the papers → `VERIFIED_PAPERS` · the sample cards'
 * prices are formatted from numbers (`mallPrice`), and the section says they are samples.
 *
 * 🔁 REDRAWN 23 Nov 2026 (owner-approved `prototypes/for_suppliers_redraw_2026-11-23/for_suppliers_redraw_fable.html`):
 *   · § 5 is the live cards (`SupplierLiveCards`): the real Check a date month and Card 14, played on native scroll;
 *   · § 7 is the plans as growth stairs (`PlanStairs`, facts from `planStair`), replacing the plan rows;
 *   · a new specialized-tools part under Plans: each paid tool's chip reads its own live gate — the Cake Maker's from
 *     the special tools' start date (`readSpecialToolsPaidFrom` → `specialToolsOpenToAll`), the Papic challenge and
 *     3D plan from the plan gate (`PRO_TOOLS_MIN_TIER`); the on-the-day tools are `SPECIALIZED_TOOLS`.
 *   Held by `the-redraw-plays-what-ships.test.ts`.
 *
 * The shell (`app/(shell)/layout.tsx`) draws the top bar and the footer: the drawing's header and footer are not drawn
 * here (`for-suppliers-wears-the-shell.test.ts`).
 */
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Check,
  Flag,
  Library,
  ListOrdered,
  Lock,
  Mic,
  Music,
  Radio,
  ScanLine,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { actionButtonClass } from '@/components/action-button-class';
import { specialToolsOpenToAll } from '@/lib/special-tools';
import type { SpecializedToolKey } from '@/lib/specialized-tools';
import { bookingFeeCapAmount, bookingFeeFigures, bookingFeeMinimumAmount, type BookingFeeSchedule } from '@/lib/booking-fee';
import { BOOKING_FEE_CHARGED_WHEN } from '@/lib/booking-fee-lock';
import { FEE_FREE_CHIP, FEE_SCOPE, SUPPLIER_FREE_BOOKING_LINE } from '@/lib/booking-fee-who-words';
import { TIER_CAPS, type VendorTier } from '@/lib/vendor-tier-caps';
import { countNoun, formatCount } from '@/lib/format-number';
import { formatPeso } from '@/lib/v2-catalog-pure';
import { CARD_MEDALS } from '@/lib/public-badges';
import { openShopWithPlanHref } from '@/lib/supplier-plan-offer';
import { CLIENTS_FOOTNOTE } from '@/lib/supplier-client-room';
import { PLAN_PERIOD } from '@/lib/vendor-plan-change-words';
import { monthlyPlanPrice } from '@/lib/v2-catalog';
import { FREE_FINDABLE } from './plan-table-data';
import {
  EVERY_PLAN_TOOLS,
  FIRST_TOOLS_TIER,
  GROW_TIERS,
  PAID_TOOL_TILES,
  STAIR_TIERS,
  VERIFIED_PAPERS,
  growName,
  liveCardsMonth,
  paidToolChip,
  planStair,
  stairHasTools,
  verifiedSpec,
  type GrowTier,
} from './supplier-front-data';
import { FeeRuler, PlanStairs, type FreeWhen, type StairCard } from './supplier-front-client';
import { SupplierLiveCards } from './supplier-live-cards';
import { Info } from './supplier-front-info';
import { SupplierHowWeEarn } from './supplier-how-we-earn';
import { VENDOR_DEEP_SEARCH_SKU_CODE } from '@/lib/vendor-deep-search-addon';
import s from './supplier-front.module.css';

export type SupplierFrontPrices = {
  // Monthly only — no yearly supplier plan (owner 2026-11-22).
  soloMonthly: string | null;
  proMonthly: string | null;
  enterpriseMonthly: string | null;
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

/** A Grow tier (a paid size) — the code keys whose prices the catalog sells. */
const isGrowTier = (t: VendorTier): t is GrowTier => (GROW_TIERS as readonly VendorTier[]).includes(t);

/** The sample shop's peso in the chat bubble — formatted from a number, never typed as a figure. */
const peso = (n: number) => `₱${formatPeso(n)}`;

/** Today in Manila ("YYYY-MM-DD") — Check a date's own "today" for the sample month. */
function manilaToday(nowMs: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(nowMs);
}

/** The on-the-day tools' icons, one per tool key (lucide only). A key with none draws the wrench. */
const DAY_TOOL_ICON: Partial<Record<SpecializedToolKey, LucideIcon>> = {
  scanner: ScanLine,
  song_bank: Library,
  song_desk: Music,
  emcee_script: Mic,
  floor_command: Flag,
  run_of_show: ListOrdered,
  headcount: Users,
  live_watch: Radio,
};

/** The three paid tools as pictures (the drawing's art, on the page's tokens). Decoration: the name says what it is. */
function ToolArt({ k }: { k: SpecializedToolKey }) {
  if (k === 'cake_tool') {
    return (
      <svg className={s.pic} viewBox="0 0 200 150" aria-hidden="true">
        <ellipse className={s.picS} cx="100" cy="132" rx="74" ry="8" />
        <rect className={`${s.picC} ${s.d1}`} x="40" y="96" width="120" height="34" rx="6" />
        <rect className={`${s.picA} ${s.d2}`} x="58" y="64" width="84" height="32" rx="6" />
        <rect className={`${s.picC} ${s.d3}`} x="76" y="36" width="48" height="28" rx="6" />
        <circle className={`${s.picG} ${s.d3}`} cx="100" cy="28" r="6" />
        <circle className={s.picA} cx="22" cy="40" r="7" />
        <circle className={s.picG} cx="22" cy="60" r="7" />
        <circle className={s.picK} cx="22" cy="80" r="7" />
      </svg>
    );
  }
  if (k === 'papic_challenge') {
    return (
      <svg className={s.pic} viewBox="0 0 200 150" aria-hidden="true">
        <g transform="rotate(-14 100 130)">
          <g className={s.f1}>
            <rect className={s.picC} x="66" y="34" width="68" height="84" rx="5" />
            <rect className={s.picS} x="72" y="40" width="56" height="52" rx="3" />
          </g>
        </g>
        <g transform="rotate(14 100 130)">
          <g className={s.f3}>
            <rect className={s.picC} x="66" y="34" width="68" height="84" rx="5" />
            <rect className={s.picS} x="72" y="40" width="56" height="52" rx="3" />
          </g>
        </g>
        <g className={s.f2}>
          <rect className={s.picC} x="66" y="30" width="68" height="84" rx="5" />
          <rect className={s.picA} x="72" y="36" width="56" height="52" rx="3" />
          <circle className={s.picOk} cx="124" cy="102" r="7" />
          <path className={s.picTick} d="m120.5 102 2.5 2.5 4.5-4.5" />
          <rect className={s.picS} x="74" y="98" width="34" height="6" rx="3" />
        </g>
      </svg>
    );
  }
  return (
    <svg className={s.pic} viewBox="0 0 200 150" aria-hidden="true">
      <path className={s.picC} d="M100 40 184 84 100 128 16 84z" />
      <path className={s.picL} d="M58 62 142 106M142 62 58 106" />
      <ellipse className={s.picS} cx="72" cy="84" rx="14" ry="7" />
      <ellipse className={s.picS} cx="100" cy="100" rx="14" ry="7" />
      <ellipse className={s.picS} cx="100" cy="68" rx="14" ry="7" />
      <g className={s.d2}>
        <path className={s.picK} d="M124 70 148 82v20l-24-12z" />
        <path className={s.picG} d="M148 82 166 73v20l-18 9z" />
        <path className={s.picA} d="M124 70 142 61l24 12-18 9z" />
        <circle className={s.picC} cx="136" cy="86" r="5" />
      </g>
    </svg>
  );
}

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

/** The special tools' start date as the page read it (`readSpecialToolsPaidFrom`, the reader the gate itself uses). */
export type SupplierFrontSpecialTools = { status: 'ok'; paidFrom: string | null } | { status: 'unread' };

export function SupplierFrontPage({
  prices,
  fee,
  afterPlans,
  giftFrom = null,
  specialTools = { status: 'unread' },
  nowMs = Date.now(),
}: {
  prices: SupplierFrontPrices;
  /** The special tools' start date; unread → the Cake Maker's chip says nothing (never "open", never "locked"). */
  specialTools?: SupplierFrontSpecialTools;
  /** The server's clock: the sample month, Check a date's today, and the special tools' gate. */
  nowMs?: number;
  /** Papic 150's catalogue LIST price, formatted ("₱…"), for the "How Setnayan earns" gift row; null when unread. */
  giftFrom?: string | null;
  fee: SupplierFrontFee;
  /** The sample shop's codes — the 6 Nov page drew them; the 20 Nov drawing does not. Optional so the lab still type-checks. */
  codes?: SupplierFrontCodes;
  /** The supplier feature paywall's state (`isVendorFeatureGateEnabled`). Kept for the callers; the 20 Nov page draws no paywall line. */
  paywallOn: boolean;
  /** Drawn under the plans — the page passes the "Couple pricing" return leg (`/pricing` ↔ `/for-suppliers`). */
  afterPlans?: ReactNode;
}) {
  const f = fee.enabled && fee.schedule ? bookingFeeFigures(fee.schedule) : null;
  /** What "How Setnayan earns" is handed: the same live figures the fee card prints. */
  const words = { figures: f };
  const tapers = fee.schedule ? fee.schedule.tailRate < fee.schedule.rate : false;
  const cards = (t: VendorTier) => TIER_CAPS[t].serviceCardsTotal;

  const freeWhen: FreeWhen[] = [
    { label: 'You bring the event first', hint: FEE_FREE_CHIP },
    { label: 'A couple you brought onto Setnayan', hint: SUPPLIER_FREE_BOOKING_LINE },
    { label: 'You have a free booking fee ticket', hint: 'Your ticket is used on your next booking, automatically.' },
  ];

  /** The growth stairs: every fact read (`planStair`), every price the catalog's, one door each. */
  const growPrice = (t: GrowTier) => monthlyPlanPrice(prices, t);
  const stairs: StairCard[] = STAIR_TIERS.map((t) => {
    const step = planStair(t);
    if (!isGrowTier(t)) {
      return { ...step, price: '₱0', per: 'always', cta: t === 'free' ? CTA : 'Get Verified free', href: OPEN_SHOP, main: t === 'free' };
    }
    return { ...step, price: growPrice(t), per: PLAN_PERIOD.per, cta: `Start on ${step.name}`, href: openShopWithPlanHref(t), main: false };
  });
  /** The tools' door: the first plan that carries them all, its catalog price and its checkout door. */
  const toolsDoor =
    FIRST_TOOLS_TIER && isGrowTier(FIRST_TOOLS_TIER)
      ? { name: growName(FIRST_TOOLS_TIER), price: growPrice(FIRST_TOOLS_TIER), href: openShopWithPlanHref(FIRST_TOOLS_TIER) }
      : null;
  /** The Cake Maker's live gate: open to every plan before the admin's date; null when the date could not be read. */
  const specialOpen = specialTools.status === 'ok' ? specialToolsOpenToAll(specialTools.paidFrom, nowMs) : null;

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
        <div className={s.heroInfo}>
          <Info label="How the fee works">
            <p>
              Free to join and free to run your bookings. Couples pay you straight to your GCash or bank; Setnayan never
              takes a cut of the deal. {SUPPLIER_FREE_BOOKING_LINE}
            </p>
            <p>
              <a className={s.tlink} href="#earn">
                How Setnayan earns
              </a>
            </p>
          </Info>
        </div>
        <nav className={`fd-chips ${s.chips}`} aria-label="On this page">
          <a className="fd-chip" href="#tools">Free tools</a>
          <a className="fd-chip" href="#verified">Get Verified free</a>
          <a className="fd-chip" href="#model">Fees</a>
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

      {/* 5 · YOUR SERVICE CARDS — the live cards (redraw 23 Nov): four Card 14 samples answer a couple's date, guests and
          venue, played by the scroll and by a tap (`supplier-live-cards.tsx`). */}
      <section className={s.part} id="cards" aria-labelledby="sf-h-cards" data-rv="">
        <SecHead id="sf-h-cards">Your service cards</SecHead>
        <p className={s.ledeText}>One card. It fits every couple.</p>
        <SupplierLiveCards month={liveCardsMonth(nowMs)} today={manilaToday(nowMs)} />
        <Lede text="Medals are earned from real bookings. Never bought.">
          <p>
            {CARD_MEDALS.length === 6 ? 'Six' : formatCount(CARD_MEDALS.length)} medals can sit on a card:{' '}
            {CARD_MEDALS.map((m) => m.name).join(', ')}. Your shop also earns badges and seals. None can be paid for.
          </p>
        </Lede>
        <p className={s.fine}>Sample cards. The same card shows in Find, on your shop page and in chats.</p>
      </section>

      {/* 6 · FEES */}
      <section className={s.part} id="model" aria-labelledby="sf-h-fees" data-rv="">
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
                <b>How much.</b> {f.head} of the first {f.band} of a booking, then {f.tail} of the rest. Once the fee
                reaches {bookingFeeCapAmount(fee.schedule)} it locks there, however big the booking.
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
            <b>Who books you free.</b> {SUPPLIER_FREE_BOOKING_LINE}
          </p>
          <p>
            <b>Free booking fee tickets.</b> A ticket you already hold is applied automatically to your next booking that
            carries the fee, and that booking’s fee is free.
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
            <p className={s.feeLock}>
              <Lock aria-hidden className={s.fxLk} strokeWidth={2.2} />
              <span>
                Never more than <b>{bookingFeeCapAmount(fee.schedule)}</b>
              </span>
            </p>
            <FeeRuler schedule={fee.schedule} freeWhen={freeWhen} />
            {tapers ? <p className={s.fbSay}>The bigger you grow, the smaller our share.</p> : null}
            <p className={s.feeWhen}>{BOOKING_FEE_CHARGED_WHEN}</p>
            <p className={s.feeWhen}>
              <b>{FEE_FREE_CHIP}.</b> {SUPPLIER_FREE_BOOKING_LINE}
            </p>
          </div>
        ) : null}
        <p className={s.fine}>Hosts never see the fee. They never pay it.</p>
        <SupplierHowWeEarn
          feeEnabled={fee.enabled}
          figures={words.figures}
          plans={{ plus: prices.soloMonthly, pro: prices.proMonthly, ultra: prices.enterpriseMonthly }}
          deepSearch={prices.bySku[VENDOR_DEEP_SEARCH_SKU_CODE] ?? null}
          giftFrom={giftFrom}
        />
      </section>

      {/* 7 · PLANS — growth stairs, Free → Ultra (redraw 23 Nov). Every fact is `planStair` (TIER_CAPS); every price the
          catalog's, "—" when unread; each card one door (Free and Verified open a shop; a paid size opens a shop with that
          plan picked — `every-plan-has-a-checkout-door.test.ts`). */}
      <section className={s.part} id="plans" aria-labelledby="sf-h-plans" data-rv="">
        <SecHead id="sf-h-plans">Plans</SecHead>
        <p className={s.ledeText}>Start free. Grow when your business does.</p>
        <PlanStairs plans={stairs} />
        <p className={s.fine} data-clients-footnote="">{CLIENTS_FOOTNOTE}</p>
        <p className={`${s.fine} ${s.same}`}>Same tools in every paid size. Only the room grows.</p>
        <p className={s.fine}>No plan limits your inquiries.</p>
        {afterPlans ? <div className={s.after}>{afterPlans}</div> : null}
      </section>

      {/* SPECIALIZED TOOLS — under Plans (redraw 23 Nov). The three that come with a paid size, each chip from its OWN live
          gate (`paidToolChip`): the Papic challenge and the 3D plan are Plus and up always (`PRO_TOOLS_MIN_TIER`); the Cake
          Maker is open to every plan until the admin's start date (`special_tools_paid_from`), and says so. Then the
          on-the-day tools every shop has. Names and lines are `SPECIALIZED_TOOLS`. */}
      <section className={s.part} id="special" aria-labelledby="sf-h-special" data-rv="">
        <SecHead id="sf-h-special">Specialized tools</SecHead>
        <p className={s.ledeText}>Built for your craft. In every paid size.</p>
        <ul className={s.strip} aria-label="Which plans carry the specialized tools">
          {STAIR_TIERS.map((t) => (
            <li key={t} className={stairHasTools(t) ? s.stripYes : undefined}>
              {stairHasTools(t) ? <Check aria-label="has them" className={s.stripIc} strokeWidth={2.4} /> : <Lock aria-label="locked" className={s.stripIc} strokeWidth={2} />}
              {planStair(t).name}
            </li>
          ))}
        </ul>
        <ul className={`${s.row} ${s.shelf}`}>
          {PAID_TOOL_TILES.map((t) => {
            const chip = paidToolChip(t.key, specialOpen);
            return (
              <li key={t.key} className={s.tool}>
                <div className={s.art}>
                  {chip ? (
                    <span className={s.inc} data-tool-chip={chip.locked ? 'locked' : 'open'}>
                      {chip.locked ? <Lock aria-hidden className={s.incIc} strokeWidth={2} /> : <Check aria-hidden className={s.incIc} strokeWidth={2.4} />}
                      {chip.words}
                    </span>
                  ) : null}
                  <ToolArt k={t.key} />
                </div>
                <b>{t.title}</b>
                <span>{t.line}</span>
              </li>
            );
          })}
        </ul>
        {toolsDoor ? (
          <div className={s.gate}>
            <p className={s.stairPrice}>
              <b>{toolsDoor.price ?? '—'}</b>
              <small>{PLAN_PERIOD.per}, with {toolsDoor.name}</small>
            </p>
            <Link className={actionButtonClass('brand', { main: false })} href={toolsDoor.href}>
              <span className="lbl">Start on {toolsDoor.name}</span>
            </Link>
          </div>
        ) : null}
        <h3 className={s.sub}>On the day, in every plan</h3>
        <ul className={s.dayTools}>
          {EVERY_PLAN_TOOLS.map((t) => {
            const Icon = DAY_TOOL_ICON[t.key] ?? Wrench;
            return (
              <li key={t.key}>
                <Icon aria-hidden className={s.dayIc} strokeWidth={2} />
                {t.title}
              </li>
            );
          })}
        </ul>
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
