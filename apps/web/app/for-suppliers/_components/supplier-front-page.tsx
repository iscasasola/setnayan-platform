/**
 * /for-suppliers — the owner-APPROVED redesign of 23 Nov 2026 (specs `prototypes/for_suppliers_redesign_2026-11-23/`,
 * `index.html` v4.3.1 and its `art/`; DECISION_LOG 2026-11-23 "/for-suppliers redesign APPROVED (owner)": *"if this is
 * the best you can do, setnayan for suppliers approve."*). Built 1:1 with HOUSE_DESIGN_STANDARD Part I applied: no
 * shadow on a static card (the fee card included), a hairline on every card, card radius 12, no gradient except the
 * band under the hero's words, no pastel icon tiles, tabular numbers. It REPLACES the 20 Nov page and its 23 Nov redraw
 * section for section, on the same route, the same tokens and Discover's own button (`fd-btn-terra`).
 *
 * The page, top to bottom: hero · #cards (three beats, each a 4:3 pick beside a 3:4 card clip, then the badges row) ·
 * #shop · #fees (the timed steps, the two fee rows, the cap line, the first-supplier rule) · #verified (Today / Verified
 * and "Try it. No risk.") · #tools (two stills, the Toolkit count and its sheet) · #gift · #plans (Verified picked) ·
 * the close · the following "Open your shop".
 *
 * WHERE EVERY NUMBER COMES FROM (nothing is typed):
 *   · the fee steps, fee rows and cap line → `feeSteps` / `feeRowWords` on `fee.schedule`, the LIVE schedule;
 *   · the gifts and "from ₱…" → `gifts.packs` (the shop-gift packs on sale, `platform_retail_catalog_v2`), the plans'
 *     included credits, the 10+1 bundle — `giftRows` / `giftFromPrice` / `giftBundleLine`;
 *   · the Toolkit count → `toolkitClaim(toolkitTotal(cardTemplates))` (lib/supplier-toolkit-count.ts: the live card
 *     templates plus what the code ships, rounded down); its sheet → `toolkitShelves` (the one Toolkit list,
 *     `toolkitItems`), names only; its tags → `PAID_STORE_TOOLS`;
 *   · the plans → `planStair` (`TIER_CAPS`) and `prices` (`getVendorPrices`, "—" when unread);
 *   · the badges → `BADGE_ROW` (`SHOP_BADGE_KEYS`, `BADGE_NAME`, the v84 art).
 * A part whose read failed says so ("Couldn't read the gifts.") — never ₱0, never empty.
 *
 * 🎞 Every picture and clip is a slot in `FRONT_MEDIA` (supplier-front-data.ts): the follow-up that swaps in the real
 * captures edits that table only. Clips fetch nothing until they are near the screen and play only while on it.
 *
 * The shell (`app/(shell)/layout.tsx`) draws the one top bar and the footer (`for-suppliers-wears-the-shell.test.ts`).
 * 🔒 `the-redesign-builds-the-drawing.test.ts`.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CreditCard, LogOut } from 'lucide-react';
import type { BookingFeeSchedule } from '@/lib/booking-fee';
import { FEE_FIRST_SUPPLIER_LINE } from '@/lib/booking-fee-who-words';
import { SPECIALIZED_TOOLS } from '@/lib/specialized-tools';
import { OPEN_SHOP_VERIFIED_HREF, openShopWithPlanHref } from '@/lib/supplier-plan-offer';
import { doorOpenShopHref, onSiteHref } from '@/lib/doors';
import { siteOrigin } from '@/lib/site-origin';
import { formatPhpRounded } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import type { PlanCredits } from '@/lib/event-plans';
import type { ShopGiftBundle, ShopGiftPack } from '@/lib/shop-gifts';
import { CLIENTS_FOOTNOTE } from '@/lib/supplier-client-room';
import { PLAN_PERIOD } from '@/lib/vendor-plan-change-words';
import { monthlyPlanPrice } from '@/lib/v2-catalog';
import {
  BADGE_ROW,
  BROUGHT_CLIENT_SHARE,
  FRONT_MEDIA,
  GROW_TIERS,
  PLAN_PAID_TOOLS_LOCKED,
  PLAN_PAID_TOOLS_OK,
  STAIR_TIERS,
  feeRowWords,
  feeSteps,
  giftBundleLine,
  giftFromPrice,
  giftRows,
  planStair,
  railShare,
  toolkitShelves,
  type FrontStill,
  type GrowTier,
} from './supplier-front-data';
import { toolkitClaim, toolkitTotal } from '@/lib/supplier-toolkit-count';
import { FeeSteps, FrontClip, OpenShopFollow, PlanPicker, ToolkitCount, type PlanCard } from './supplier-front-client';
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
/** The gifts as the page read them: the packs on sale and the 10+1 bundles (null = unread), and the plans' credits. */
export type SupplierFrontGifts = {
  packs: readonly ShopGiftPack[] | null;
  bundles: readonly ShopGiftBundle[] | null;
  credits: Pick<PlanCredits, 'plusCredits' | 'proCredits'>;
};

// Absolute: this page is also the supplier door's front page, where a relative link is a 308 hop first (`onSiteHref`).
const SITE = siteOrigin();
const OPEN_SHOP = onSiteHref(doorOpenShopHref('supplier'), SITE);
const CTA = 'Open your shop';
const FREE_LINE = 'No card needed.'; // L9 P4 + L4b (brand.md claim 3): no "free to start" or "free to stay" promise
const HERO_CTA_ID = 'sf-hero-cta';
const CLOSE_CTA_ID = 'sf-close-cta';
/** The plan the cards open on (as drawn). */
const START_PLAN = STAIR_TIERS.indexOf('verified');

const isGrowTier = (t: string): t is GrowTier => (GROW_TIERS as readonly string[]).includes(t);

function Still({ still }: { still: FrontStill }) {
  return (
    <div className={s.cap}>
      <Image src={still.src} alt={still.alt} width={still.w} height={still.h} loading="lazy" sizes="(min-width: 760px) 360px, 100vw" />
    </div>
  );
}

function Part({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section className={s.part} id={id} aria-labelledby={`sf-h-${id}`}>
      <h2 id={`sf-h-${id}`}>{title}</h2>
      {lede ? <p className={s.lede}>{lede}</p> : null}
      {children}
    </section>
  );
}

export function SupplierFrontPage({
  prices,
  fee,
  gifts = { packs: null, bundles: null, credits: { plusCredits: null, proCredits: null } },
  afterPlans,
  papicCapture = false,
  cardTemplates = null,
}: {
  prices: SupplierFrontPrices;
  fee: SupplierFrontFee;
  /** The gifts' read; absent = unread (the gift part then says it could not read them). */
  gifts?: SupplierFrontGifts;
  /** The supplier feature paywall's state (`isVendorFeatureGateEnabled`). Kept for the callers; the page draws no paywall line. */
  paywallOn: boolean;
  /** Drawn under the plans — the page passes the "Couple pricing" return leg (`/pricing` ↔ `/for-suppliers`). */
  afterPlans?: ReactNode;
  /** The Papic camera's privacy switch (`isVendorPapicCaptureEnabled`) — the Toolkit lists it only while on. */
  papicCapture?: boolean;
  /** The starting card templates the admin keeps (`readCardTemplateCount`) — the one live part of the Toolkit count; null = unread. */
  cardTemplates?: number | null;
}) {
  const schedule = fee.enabled ? fee.schedule : null;
  const giftFrom = giftFromPrice(gifts.packs);
  const giftList = giftRows(gifts.packs, gifts.credits);
  const smallestGift = gifts.packs ? (giftList?.[0]?.title ?? null) : null;
  const steps = schedule ? feeSteps(schedule, smallestGift) : null;
  const rows = schedule ? feeRowWords(schedule) : null;
  const bundle = giftBundleLine(gifts.packs, gifts.bundles);

  /** The Toolkit: ONE count, the honest total rounded down (`toolkitClaim`); the sheet names the one Toolkit list's items. */
  const shelves = toolkitShelves(papicCapture);
  const claim = toolkitClaim(toolkitTotal(cardTemplates));

  /** The plan cards: every fact `planStair` (TIER_CAPS), every price the catalog's, one real door each. */
  const growPrice = (t: GrowTier) => monthlyPlanPrice(prices, t);
  const plans: PlanCard[] = STAIR_TIERS.map((t) => {
    const step = planStair(t);
    const tools = { ok: step.tools, text: step.tools ? PLAN_PAID_TOOLS_OK : PLAN_PAID_TOOLS_LOCKED };
    const base = { tier: t, name: step.name, keep: step.clients ?? step.role, size: step.sizeLine ?? `${step.size} storage`, share: railShare(t), tools };
    if (!isGrowTier(t)) {
      return { ...base, price: 'Free', per: null, cta: t === 'free' ? CTA : 'Get verified', href: t === 'free' ? OPEN_SHOP : onSiteHref(OPEN_SHOP_VERIFIED_HREF, SITE) };
    }
    return { ...base, price: growPrice(t), per: PLAN_PERIOD.per, cta: `Start on ${step.name}`, href: onSiteHref(openShopWithPlanHref(t), SITE) };
  });

  const tileTools = FRONT_MEDIA.tools.flatMap((m) => {
    const t = SPECIALIZED_TOOLS.find((x) => x.key === m.key);
    return t ? [{ ...m, title: t.title, line: t.line }] : [];
  });

  return (
    <div className={s.root}>
      {/* HERO */}
      <section className={s.hero} aria-labelledby="sf-h-top">
        <figure className={s.hp}>
          <Image src={FRONT_MEDIA.hero.src} alt={FRONT_MEDIA.hero.alt} fill priority sizes="(min-width: 760px) 720px, 100vw" />
          <figcaption>
            <p className={s.kick}>For suppliers</p>
            <h1 id="sf-h-top">Run the business you already have.</h1>
            <p className={s.sub}>Your clients, quotes and dates. One free place.</p>
          </figcaption>
        </figure>
        <p className={s.cta}>
          <Link id={HERO_CTA_ID} className={`fd-btn-terra ${s.btn}`} href={OPEN_SHOP} data-sf-cta="">
            {CTA}
          </Link>
        </p>
        <p className={`${s.fine} ${s.c}`}>{FREE_LINE}</p>
        <p className={`${s.fine} ${s.c} ${s.tight}`}>
          No fee on clients you bring. Every booking includes a Setnayan gift for your couple{giftFrom ? `, from ${giftFrom}` : ''}.
        </p>
      </section>

      {/* #cards · A couple finds your card */}
      <Part id="cards" title="A couple finds your card." lede="It already knows their date, their venue and their guest count.">
        <p className={s.story}>
          <b className={s.say}>This is a couple planning their event.</b>
          <span className={s.mean}>These are four suppliers’ cards.</span>
        </p>
        {FRONT_MEDIA.beats.map((b, i) => (
          <div key={b.pick.src} className={s.beat}>
            <p className={s.story}>
              <b className={s.say}>
                <i>
                  {formatCount(i + 1)} / {formatCount(FRONT_MEDIA.beats.length)}
                </i>
                {b.say}
              </b>
            </p>
            <div className={s.caps}>
              <FrontClip clip={b.pick} />
              <FrontClip clip={b.cards} />
            </div>
            <p className={s.story}>
              <span className={s.mean}>{b.mean}</span>
            </p>
          </div>
        ))}
        <h3 className={s.h3}>Badges you earn</h3>
        <div className={s.bdgs}>
          {BADGE_ROW.map((b) => (
            <p key={b.key}>
              <Image src={b.src} alt="" width={b.w} height={b.h} loading="lazy" sizes="84px" />
              <span>{b.name}</span>
            </p>
          ))}
        </div>
        <p className={s.fine}>Earned from real bookings. Never bought.</p>
      </Part>

      {/* #shop */}
      <Part id="shop" title="Your page answers before you do." lede="Dates, reviews and events, at one address.">
        <div className={s.caps}>
          {FRONT_MEDIA.shop.map((st) => (
            <Still key={st.src} still={st} />
          ))}
        </div>
        <p className={`${s.fine} ${s.c}`}>Reviews come only from completed bookings.</p>
      </Part>

      {/* #fees */}
      <Part id="fees" title="The clients you bring stay yours." lede="Start free.">
        {steps && rows ? (
          <>
            <FeeSteps
              figureLabel="Your fee"
              intro={{ say: 'Two couples book you.', mean: 'One you brought. One found you on Setnayan.' }}
              steps={steps}
            />
            <ul className={s.rows}>
              <li>
                <div className={s.hd}>
                  <b>Clients you bring</b>
                  <span className={s.big}>{BROUGHT_CLIENT_SHARE}</span>
                </div>
              </li>
              <li>
                <div className={s.hd}>
                  <b>Clients Setnayan brings</b>
                  <span className={s.big}>{rows.setnayan}</span>
                </div>
              </li>
            </ul>
            <p className={s.fine}>{rows.cap}</p>
          </>
        ) : (
          <p className={s.story}>
            {fee.enabled ? 'Couldn’t read the booking fee just now. It is shown in full before you agree to any booking.' : 'There is no booking fee while it is switched off.'}
          </p>
        )}
        <p className={s.rule}>{FEE_FIRST_SUPPLIER_LINE}</p>
      </Part>

      {/* #verified */}
      <Part id="verified" title="The day your papers come through." lede="Open today, even without permits.">
        <div className={s.caps}>
          {FRONT_MEDIA.verified.map((st) => (
            <Still key={st.src} still={st} />
          ))}
        </div>
        <ul className={s.rows}>
          <li>
            <div className={s.hd}>
              <b>Today</b>
              <span className={s.tag} data-tag="free">
                Free
              </span>
            </div>
            <p>Open your shop. Bring your clients.</p>
          </li>
          <li>
            <div className={s.hd}>
              <b>Verified</b>
              <span className={s.tag} data-tag="free">
                Free
              </span>
            </div>
            <p>We check your papers. Couples can find you.</p>
          </li>
        </ul>
        <div className={s.risk} data-rv="">
          <h3 className={s.h3}>Try it. Leave anytime.</h3>
          <div className={s.r3}>
            <p>
              <i>
                <CreditCard aria-hidden strokeWidth={2} />
              </i>
              <b>Free to open</b>
              <b>No card</b>
            </p>
            <p>
              <i className={s.num}>{formatPhpRounded(0)}</i>
              <b>Free</b>
              <b>a month</b>
            </p>
            <p>
              <i>
                <LogOut aria-hidden strokeWidth={2} />
              </i>
              <b>Leave</b>
              <b>anytime</b>
              <small>From Profile</small>
            </p>
          </div>
        </div>
      </Part>

      {/* #tools: no lede (re-walk 24 Nov 2026, controller call). "Most of them free." sat over the only two tiles, both
          Paid, so it was false where it stood. What is free is said where it is true: the Toolkit count and its sheet. */}
      <Part id="tools" title="Tools made for your trade.">
        <div className={`${s.caps} ${s.tiles}`}>
          {tileTools.map((t) => (
            <figure key={t.key} className={s.tile}>
              <Still still={t.still} />
              <figcaption>
                <b>{t.title}</b> {t.line}.{' '}
                <span className={s.tag} data-tag="paid">
                  Paid
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <ToolkitCount claim={claim} shelves={shelves} />
      </Part>

      {/* #gift */}
      <Part id="gift" title="A gift you hand your couple." lede="Something you could not offer alone.">
        <div className={`${s.caps} ${s.giftCap}`}>
          <FrontClip clip={FRONT_MEDIA.gift} />
        </div>
        {giftList && giftList.length ? (
          <ul className={s.rows}>
            {giftList.map((g) => (
              <li key={g.code}>
                <div className={s.hd}>
                  <b>{g.title}</b>
                  <span className={s.big}>{g.price}</span>
                </div>
                <p>{g.line}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.story}>Couldn’t read the gifts just now.</p>
        )}
        <p className={s.fine}>Every booking includes one.{bundle ? ` ${bundle}` : ''}</p>
      </Part>

      {/* #plans */}
      <Part id="plans" title="When you outgrow free." lede="No hurry.">
        <PlanPicker plans={plans} start={START_PLAN} />
        <p className={s.fine} data-clients-footnote="">{CLIENTS_FOOTNOTE}</p>
        <p className={s.fine}>No plan limits your inquiries.</p>
        {afterPlans ? <div className={s.after}>{afterPlans}</div> : null}
      </Part>

      {/* CLOSE */}
      <section className={s.close} id="start" aria-labelledby="sf-h-close">
        <h2 id="sf-h-close">Open your shop.</h2>
        <p className={s.lede}>Then make your first service card. Free.</p>
        <Link id={CLOSE_CTA_ID} className={`fd-btn-terra ${s.btn}`} href={OPEN_SHOP}>
          {CTA}
        </Link>
      </section>

      <OpenShopFollow href={OPEN_SHOP} label={CTA} watch={[HERO_CTA_ID, CLOSE_CTA_ID]} />
    </div>
  );
}
