/**
 * supplier-front-data — what the /for-suppliers page SAYS that is a fact about the app, derived from where the app
 * keeps it. The words are the owner-approved prototype's (`prototypes/for_suppliers_2026-11-06/index.html`,
 * approved 6 Nov 2026, DECISION_LOG "SUPPLIER FRONT PAGE (/for-suppliers): ONE STORY FOR EVERYONE — APPROVED");
 * every NUMBER and every PLAN NAME next to a feature is read, never typed (README § "Where every number comes from"):
 *
 *   · reach · categories · cards · seats · branches · waiting list  → `TIER_CAPS` (lib/vendor-tier-caps.ts)
 *   · which plan a Solo / Pro / Ultra line sits under                 → the Plans page's own rows,
 *                                                                       `VENDOR_TIER_SECTIONS` (vendor-benefits.ts)
 *   · which plan first has a fold line ("Pro+")                       → the same rows, or `firstPlanWith(TIER_CAPS)`
 *   · the 3D seat-plan logo                                           → a paid widget, bought in the Toolkit (owner a02673ac, not a plan line)
 *   · plan prices, the year price, the branch + seat add-ons          → the catalog, read by the page (getVendorPrices)
 *   · the booking fee                                                  → the live schedule, read by the page
 *
 * Pure module (no React, no I/O) — `supplier-front-reads-its-numbers.test.ts` runs it.
 */
import { VENDOR_TIER_SECTIONS } from '@/app/_components/home/vendor-benefits';
import { bookingFeeCapPhp, bookingFeeLockPointPhp, bookingFeePhp, type BookingFeeSchedule } from '@/lib/booking-fee';
import { countNoun, formatCount } from '@/lib/format-number';
import { MILESTONE_THRESHOLDS } from '@/lib/service-card-record';
import { FREE_FINDABLE } from './plan-table-data';
import { storageWords } from '@/lib/downgrade-limits';
import { planRole, planSummaryWords } from '@/lib/supplier-storage';
import { clientsKeptWords, planStorageLine } from '@/lib/supplier-client-room';

/** A plan's size in words. `null` is only the type's "unreadable row" — every plan has a size — so it never invents one. */
const sizeWords = (bytes: number | null): string => (bytes == null ? 'Your storage' : storageWords(bytes));
import { FREE_HELPER_SEATS } from '@/lib/vendor-free-helper';
import { PRO_TOOLS_MIN_TIER, SPECIALIZED_TOOLS_INCLUDED_TIERS } from '@/lib/specialized-tools-access';
import { SPECIALIZED_TOOLS, type SpecializedTool, type SpecializedToolKey } from '@/lib/specialized-tools';
import { isPaidStoreTool } from '@/lib/supplier-store';
import { PAID_WIDGET_PLAN_WORDS } from '@/lib/special-tools';
import type { CardBadgeView } from '@/lib/card-badges';
import { PLAN_CHATBOT_LEVEL } from '@/lib/vendor-ai-level';
import {
  PORTFOLIO_FREE_BASE,
  TIER_CAPS,
  canBuyExtraBranches,
  canBuyExtraSeats,
  TIER_LABEL,
  firstPlanWith,
  isPaidSize,
  isTierAtLeast,
  type TierCaps,
  type VendorTier,
} from '@/lib/vendor-tier-caps';

/** The three paid plans, in the order the Grow step shows them. `enterprise` is the code key; people read "Ultra". */
export const GROW_TIERS = ['solo', 'pro', 'enterprise'] as const;
export type GrowTier = (typeof GROW_TIERS)[number];

/**
 * THE SAMPLE SHOP the page shows and links to (owner 6 Nov: *"Use setnayan. production … across the whole
 * frontpage"*; a dot is not allowed in a shop address, `VENDOR_SLUG_RE`, so the hyphen).
 * ⚠ The demo shop in production is still `setnaprod` — every code on this page scans to a dead address until the
 * owner renames it (shop settings; slug forwarding keeps the old link). Flagged in the PR, not done here.
 */
export const SAMPLE_SHOP = { slug: 'setnayan-production', name: 'Setnayan Productions' } as const;

/** The plan name a person reads for a code key — Verified for the free verified step, Ultra for `enterprise`. */
function planName(t: VendorTier): string {
  return t === 'verified' ? 'Verified' : TIER_LABEL[t];
}

/** The pill beside a feature: "Verified", "Solo+", "Pro+", or "Ultra" (nothing is above Ultra on this page). */
export function planPill(t: VendorTier | null): string {
  if (t === null || t === 'free') return 'Free';
  if (t === 'verified') return 'Verified';
  if (t === 'enterprise') return planName('enterprise');
  return `${planName(t)}+`;
}

/** The plan whose Plans-page rows (`VENDOR_TIER_SECTIONS`) carry a row matching `row`, or null when none does. */
export function tierOfPlansRow(row: RegExp): VendorTier | null {
  const hit = VENDOR_TIER_SECTIONS.find((s) => s.groups.some((g) => g.items.some((i) => row.test(i.n))));
  return hit ? hit.tier : null;
}

/* ───────────────────────── the steps: Free → Verified → Grow ───────────────────────── */

/**
 * "1 category · 1 service card live · found until your first inquiry" — Free's line, from its caps. The search half is the
 * 7 Nov rule the database applies (`vendor_profiles.is_findable`, lib/findable-shop.ts): an unverified shop shows in
 * search until its first inquiry, then waits for Verified. (It said "not in search yet" until Lane J — false since 7 Nov.)
 */
export function freeSpec(): string {
  const c = TIER_CAPS.free;
  return `${countNoun(c.parentCategories, 'category', 'categories')} · ${countNoun(c.serviceCardsTotal, 'service card', 'service cards')} live · ${FREE_FINDABLE}`;
}

/**
 * "You set your own reach · the Verified seal · get paid in the app" — Verified's line. Reach is not a plan allowance
 * since 2026-11-19 (owner: *"unlock the range. not plan dependend anymore"*): verified, every plan sets its own.
 */
export function verifiedSpec(): string {
  // 💬 Owner 21 Nov: "AI Chatbot is for verified and up" — read from the gate's own table, never typed.
  const chatbot = (PLAN_CHATBOT_LEVEL.verified ?? 'none') !== 'none' ? ' · the AI chatbot' : '';
  return `${VERIFIED_REACH} · the Verified seal · get paid in the app${chatbot}`;
}

/**
 * A paid plan's spec line, from its caps. 💾 Owner 2026-11-22 ("SAME FEATURES IN EVERY SIZE" + "STARTER BUSINESS"): the
 * plans are storage sizes, so the size leads; Plus says its starter limits, Pro and Ultra say "no limit". E.g. Plus:
 * "50 GB · every category · 15 service cards live · you and 2 more"; Pro: "256 GB · every category · no limit on
 * cards, people or branches". A part a plan does not have (Plus's branches) is left out. Every number is TIER_CAPS;
 * a no-limit cap is said in words, never as "—" or "Infinity".
 */
export function growSpec(t: GrowTier): string {
  const c: TierCaps = TIER_CAPS[t];
  const parts = [
    sizeWords(c.storageBytes),
    Number.isFinite(c.parentCategories) ? countNoun(c.parentCategories, 'category', 'categories') : 'every category',
  ];
  const unlimited = !Number.isFinite(c.serviceCardsTotal) && !Number.isFinite(c.agentAccounts) && !Number.isFinite(c.branchesIncluded);
  if (unlimited) return [...parts, 'no limit on cards, people or branches'].join(' · ');
  // Cards are unlimited to MAKE; the plan counts the LIVE ones (owner 19 Nov 2026, lib/live-cards-cap.ts).
  parts.push(Number.isFinite(c.serviceCardsTotal) ? `${countNoun(c.serviceCardsTotal, 'service card', 'service cards')} live` : 'no limit on live cards');
  parts.push(Number.isFinite(c.agentAccounts) ? `you and ${formatCount(c.agentAccounts)} more` : 'no limit on people');
  if (!Number.isFinite(c.branchesIncluded)) parts.push('no limit on branches');
  else if (c.branchesIncluded > 0) parts.push(countNoun(c.branchesIncluded, 'branch', 'branches'));
  return parts.join(' · ');
}

/**
 * Each plan's one line on its card, from its caps (owner 2026-11-22: the plans are sizes with the same features, and a
 * plan is never shown as its size alone). A paid size leads with its role ("The starter business: …"); Free and Verified
 * already carry their name on the card, so their line is the summary itself ("Run your own clients, … and 50 MB.").
 * Clients first (owner 2026-11-23 "Yes, clients first", `clientsKeptWords`): "Keeps about 60 clients at a time*. Run
 * your own clients, … and 50 MB." The asterisk's footnote is `CLIENTS_FOOTNOTE`, said once under the plans.
 */
export function planLine(t: VendorTier): string {
  const clients = clientsKeptWords(t);
  const lead = clients ? `${clients}. ` : '';
  if (!isPaidSize(t)) {
    const w = planSummaryWords(t);
    return `${lead}${w.charAt(0).toUpperCase()}${w.slice(1)}.`;
  }
  return `${lead}${planRole(t)}: ${planSummaryWords(t)}.`;
}


/** "Everything in Free, plus" — the plan below, by the Grow order (Verified joins Free, 2026-11-14). */
export function growPlus(t: GrowTier): string {
  const below: Record<GrowTier, VendorTier> = { solo: 'free', pro: 'solo', enterprise: 'pro' };
  return `Everything in ${planName(below[t])}, plus`;
}

/**
 * The lines each paid plan ADDS — the prototype's words, each tied to the Plans page row it summarises. The plan a
 * line is shown under is WHERE THAT ROW LIVES, so moving a row on the Plans page moves it here (the owner's
 * 2026-11-05 "same as the Plans" rule: one source for both pages). `lead` lines are drawn bold.
 */
export const GROW_LINES: ReadonlyArray<{ text: string; tail?: string; lead?: true; row: RegExp }> = [
  { text: 'Your own web address', lead: true, row: /^Your own web address$/ },
  { text: 'Personalize your page: intro, accent colour, featured services, sections', row: /^Personalize your public page$/ },
  { text: 'Quote-to-booking funnel', row: /^Quote-to-booking funnel$/ },
  { text: 'Won and lost reasons', row: /^Won & lost reasons$/ },
  { text: 'Your own reply and booking metrics', row: /^Your own funnel metrics$/ },
  { text: 'Earnings dashboard', row: /^Earnings dashboard$/ },
  { text: 'Recap sharing to your Facebook Page', row: /^Recap sharing$/ },
  // (The 3D seat-plan logo left the plan lines: it is the 3D plan widget, bought in the Toolkit — owner a02673ac.)
  { text: 'Premium two-column page', tail: ' with a sticky Inquire rail', lead: true, row: /^Premium two-column page$/ },
  { text: 'One business identity for your whole crew', row: /^One clean business identity$/ },
  { text: 'Demand Radar', row: /^Demand Radar$/ },
  { text: 'Reverse-image theft watch', row: /^Reverse-image theft watch$/ },
  { text: 'Custom /your-name address and full written reviews', row: /^Custom slug \+ full written reviews$/ },
  { text: 'Featured in Stories', row: /^Featured in Stories$/ },
  { text: 'Editorial and article spotlights', row: /^Editorial & article spotlights$/ },
  { text: 'Priority support', row: /^Priority support$/ },
  { text: 'Flagship page with video films', lead: true, row: /^Flagship page \+ video films$/ },
  { text: 'Multi-admin for your team', row: /multi-admin/ },
  { text: 'Market Intelligence: your category vs peers', row: /^Market Intelligence/ },
  { text: 'Front-of-line dispute handling', row: /^Front-of-line dispute handling$/ },
];

export type GrowLine = { text: string; tail?: string; lead: boolean };

/**
 * 💳 WHAT FOLDED INTO EACH PLAN (owner 2026-11-14, DECISION_LOG "SIMPLER SUPPLIER PLANS" item 3) — the lines that
 * used to be add-ons, each placed under the FIRST plan the gate itself opens it on:
 *   · specialized tools → `SPECIALIZED_TOOLS_INCLUDED_TIERS` (the unlock's own mirror of the database gate);
 *   · the chatbot and its smarter level → `PLAN_CHATBOT_LEVEL` (the table the inbox's gate reads);
 *   · Ultra's higher limits → the plan has none of the old "+1" add-ons to buy (`canBuyUltraAddOn`).
 */
export function foldedLines(t: GrowTier): GrowLine[] {
  const firstTools = GROW_TIERS.find((g) => SPECIALIZED_TOOLS_INCLUDED_TIERS.includes(g)) ?? null;
  // Verified comes first: when the chatbot opens on Verified (21 Nov), `verifiedSpec` says it and no plan repeats it.
  const firstBasic = (['verified', ...GROW_TIERS] as const).find((g) => PLAN_CHATBOT_LEVEL[g] === 'basic') ?? null;
  const firstAdvanced = GROW_TIERS.find((g) => PLAN_CHATBOT_LEVEL[g] === 'advanced') ?? null;
  const out: GrowLine[] = [];
  if (firstTools === t) out.push({ text: 'Every free widget, included', lead: true });
  // 🧰 Owner a02673ac (23 Nov): a paid widget is bought once in the Toolkit and works only on a paid plan — so the plan
  // says it lets them work, never that it includes them.
  if (t === PRO_TOOLS_MIN_TIER) out.push({ text: 'Paid widgets work here', tail: ': buy each once in the Toolkit', lead: true });
  if (firstBasic === t) out.push({ text: 'AI chatbot, included', tail: ': answers price, dates and what’s included', lead: true });
  if (firstAdvanced === t) {
    out.push({ text: 'The smarter AI chatbot', tail: ': writes in your voice, replies in the couple’s language', lead: true });
  }
  // 💾 Owner 2026-11-22 "SAME FEATURES IN EVERY SIZE": every feature sits under the first paid size, so Pro and Ultra
  // say what they ADD — their room, and no limits — read from their caps. Nothing is sold on top (no add-ons).
  if (t !== GROW_TIERS[0]) {
    out.push({ text: `${sizeWords(TIER_CAPS[t].storageBytes)} for your files`, lead: true });
    const c = TIER_CAPS[t];
    const below = TIER_CAPS[GROW_TIERS[GROW_TIERS.indexOf(t) - 1]!];
    if (!Number.isFinite(c.serviceCardsTotal) && Number.isFinite(below.serviceCardsTotal)) {
      out.push({ text: 'No limit on cards, people or branches', lead: true });
    }
  }
  return out;
}

/**
 * The lines shown under one paid plan. A line whose Plans-page row is gone is dropped (never shown under a guess);
 * the 3D seat-plan line is not a plan line any more (a paid widget, bought in the Toolkit — owner a02673ac).
 */
export function growLines(t: GrowTier): GrowLine[] {
  // 🧰 Owner a02673ac (23 Nov): the branded 3D booth is a paid widget bought in the Toolkit, no longer a plan line.
  return [...foldedLines(t), ...GROW_LINES.filter((l) => tierOfPlansRow(l.row) === t).map((l) => ({ text: l.text, tail: l.tail, lead: l.lead === true }))];
}

/** The papers Verified asks for, as the step says them. `REQUIRED_DOC_COUNT` holds the count (see the test). */
export const VERIFIED_PAPERS = ['DTI or SEC', 'BIR 2303', 'Permit'] as const;

/* ───────────────────────── reach, the free base, the badges ───────────────────────── */

/**
 * 🔓 REACH IS NOT A PLAN ALLOWANCE (owner 2026-11-19, verbatim: *"ok unlock the range. not plan dependend anymore."* ·
 * *"Free Unverified account will have a range of 0km."*). An unverified shop is found by its own link or QR; a verified
 * shop on ANY plan sets how far it goes. No km per plan is printed anywhere on this page.
 */
export const VERIFIED_REACH = 'You set your own reach';

/** The ⓘ under the QR codes — one sentence, the same on every plan. */
export function reachSentence(): string {
  return 'until then you are found by your own link and QR; once verified, you set how far you go, on every plan';
}

/** The free photo base ("50 portfolio photos"). */
export const FREE_PHOTOS = formatCount(PORTFOLIO_FREE_BASE);

/** "10 · 50 · 100 · 500 · 1,000 · 5,000 · 10,000" — where a badge climbs. */
export const BADGE_STEPS = MILESTONE_THRESHOLDS.map((n) => formatCount(n)).join(' · ');
export const BADGE_FIRST = formatCount(MILESTONE_THRESHOLDS[0]);
export const BADGE_LAST = formatCount(MILESTONE_THRESHOLDS[MILESTONE_THRESHOLDS.length - 1]);

/* ───────────────────────── Everything you get (the fold) ───────────────────────── */

export type FoldLine = { text: string; pill: string };
export type FoldGroup = { title: string; lines: FoldLine[] };

const seatsFrom = firstPlanWith((c) => c.agentAccounts > 0);
const waitlistFrom = firstPlanWith((c) => c.waitlistAcceptances > 0);
const branchesFrom = firstPlanWith((c) => c.branchesIncluded > 0);

/**
 * The five groups behind "Everything you get" — the prototype's lines and counts (9 · 11 · 6 · 6 · 9). A line marked
 * Free is free on every plan; a plan pill is READ (the Plans-page row's plan, or the first plan whose caps carry it).
 */
export function foldGroups(): FoldGroup[] {
  const free = (text: string): FoldLine => ({ text, pill: 'Free' });
  const at = (text: string, t: VendorTier | null): FoldLine => ({ text, pill: planPill(t) });
  return [
    {
      title: 'Get found',
      lines: [
        free('Your public page, auto-built, ready for Google'),
        free(`${FREE_PHOTOS} portfolio photos`),
        free('Six QR codes: Shortlist, Check a date, My page, Booked, Crew, Review'),
        at('Shown in search, as far as you go', 'verified'),
        at('Your own reach on every plan — you set it', 'verified'),
        at('Your own web address', tierOfPlansRow(/^Your own web address$/)),
        at('Featured in Stories, editorial spotlights', tierOfPlansRow(/^Featured in Stories$/)),
        free('NFC tags, door sticker, ready-made printed pieces'),
      ],
    },
    {
      title: 'Get booked',
      lines: [
        free('One inbox; only inquiries that match what you do'),
        free('Quote in the chat: flat, per guest, per hour'),
        free('Reservation → progress → balance on one timeline, with proof'),
        free('Paid straight to your GCash or bank'),
        free('Discounts, perks and the Setnayan gift on your cards'),
        free('Give Setnayan gifts (like Papic) with your quote; you buy the stock'),
        free('Double-booking guard'),
        free('A day check before you accept, so two events never clash'),
        free('Inquiries, payments and schedule changes reach your phone as notices'),
        at('Waiting list per date', waitlistFrom),
        free('Meetings: in person, or a call on your own phone or Viber'),
      ],
    },
    {
      title: 'Work together',
      lines: [
        free('Their event opens to you once booked'),
        free('Your moment on their schedule, one tap to approve'),
        free('Headcount live from RSVPs'),
        free("Your questions travel to the couple's page"),
        free('Contract on record, change-order trail'),
        free('Import past clients'),
      ],
    },
    {
      title: 'Run the day',
      lines: [
        free('Now · Next · Arrived, status buttons'),
        free('Saved for no signal'),
        free('Crew code, one per event'),
        at('Team seats, each with their own login', seatsFrom),
        free('Review QR and live reviews'),
        free('Tools by your type: production sheet, shot list, song desk, script, seat plan, mood board'),
      ],
    },
    {
      title: 'Grow',
      lines: [
        free(`Badges from ${BADGE_FIRST} to ${BADGE_LAST} events; stars; years`),
        free('Returning-client mark and discount'),
        free('Reviews with "Verified booking"; right of reply'),
        free('Price-position meter, profile score'),
        at('Earnings dashboard, won and lost reasons', tierOfPlansRow(/^Earnings dashboard$/)),
        at('Reverse-image theft watch', tierOfPlansRow(/^Reverse-image theft watch$/)),
        at('Branches under one shop', branchesFrom),
        at('Market Intelligence', tierOfPlansRow(/^Market Intelligence/)),
        free('Gifts per badge'),
      ],
    },
  ];
}

/* ───────────────────────── illustrations (NOT prices) ───────────────────────── */

/**
 * The four "Your price, your way" cards. ⚠ THESE ARE ILLUSTRATIONS, NOT PRICES FROM THE APP — the page says so in
 * the card section's ⓘ ("Examples above are illustrations, not prices from the app."). They are the only peso
 * figures typed for this page, and they live here, in one named place, so the guard can tell them apart.
 */
export const PRICE_SHAPE_EXAMPLES = {
  perGuest: { rate: 850, n: 150, step: 10, min: 10, max: 1000 },
  perHour: { rate: 4000, n: 5, step: 1, min: 2, max: 12 },
  bySize: {
    start: 1,
    list: [
      { label: 'Small tent · 100 guests', value: 18000 },
      { label: 'Medium tent · 200 guests', value: 32000 },
      { label: 'Large tent · 300 guests', value: 45000 },
    ],
  },
  onePrice: {
    start: 0,
    list: [
      { label: 'Full day', value: 45000 },
      { label: 'Full day + drone', value: 53000 },
      { label: 'Full day + drone + album', value: 60000 },
    ],
  },
} as const;

/** The fee slider's travel — an example booking price the visitor drags, not a price. */
export const FEE_SLIDER = { min: 10000, max: 1000000, step: 5000, start: 300000 } as const;

/**
 * The fee ruler's stops (approved drawing `prototypes/for_suppliers_2026-11-20/`, "Test it: drag the bar"): EXAMPLE
 * booking prices a visitor swipes through, not prices. Each stop's fee is computed from the LIVE schedule by
 * `bookingFeePhp` — no fee is typed anywhere. The ruler opens on `FEE_STOP_START`.
 *
 * 🔒 The drawing's 26th stop — where the fee reaches the ₱100,000 lock — is NOT typed here: `feeRulerStops` adds it from
 * the schedule (`bookingFeeLockPointPhp`), so an edited cap or rate moves it. On the live schedule it lands at 80%.
 */
export const FEE_STOPS = [
  50000, 75000, 100000, 150000, 200000, 250000, 300000, 400000, 500000, 600000, 750000, 1000000, 1250000, 1500000, 1750000,
  2000000, 2250000, 2500000, 2750000, 3000000, 4000000, 5000000, 6000000, 8000000, 10000000,
] as const;
export const FEE_STOP_START = 6;

/** One ruler stop: the booking price, its fee, whether the fee sits at the lock, and whether it is the lock point. */
export type FeeRulerStop = { v: number; fee: number; locked: boolean; lockPoint: boolean };

/** The ruler's stops on a schedule — the example prices plus the lock point, in order, each with its LIVE fee. PURE. */
export function feeRulerStops(schedule: BookingFeeSchedule): FeeRulerStop[] {
  const cap = bookingFeeCapPhp(schedule);
  const at = bookingFeeLockPointPhp(schedule);
  const vs = [...new Set<number>([...FEE_STOPS, ...(at !== null ? [at] : [])])].sort((a, b) => a - b);
  return vs.map((v) => {
    const fee = bookingFeePhp(v, schedule);
    return { v, fee, locked: fee >= cap, lockPoint: v === at };
  });
}

/* ───────────────────────── small read facts the page prints ───────────────────────── */

/** "More seats from Solo" — the first plan whose caps carry a team seat. Null if no plan does. */
export const MORE_SEATS_FROM: string | null = seatsFrom ? `More seats from ${planName(seatsFrom)}` : null;

/**
 * "Every plan, Free included, comes with one free Helper for the event day." — from `FREE_HELPER_SEATS`
 * (lib/vendor-free-helper.ts). Null when the free Helper is switched off (`0`), so the line is not printed.
 */
export function helperLine(): string | null {
  const n = FREE_HELPER_SEATS;
  if (n <= 0) return null;
  const helpers = n === 1 ? 'one free Helper' : `${formatCount(n)} free Helpers`;
  return `Every plan, Free included, comes with ${helpers} for the event day.`;
}

/** The plans that may buy an extra branch AND an extra seat (today only Ultra) — `canBuyExtra*` in vendor-tier-caps. */
export const ADDON_TIERS: GrowTier[] = GROW_TIERS.filter((t) => canBuyExtraBranches(t) && canBuyExtraSeats(t));

/**
 * The one line under the plan cards that replaced the add-ons box (drawing § 1): "Deep Search is ₱499 a search on any
 * plan. On Ultra, you can also add a seat or a branch." The price is the catalogue row the search CHARGES; unread → the
 * sentence names no figure. The plan that may add seats and branches is `ADDON_TIERS` (canBuyExtra*).
 */
export function buyMoreLine(deepSearchPrice: string | null): string {
  const deep = deepSearchPrice ? `Deep Search is ${deepSearchPrice} a search on any plan.` : 'Deep Search is bought one search at a time, on any plan.';
  if (ADDON_TIERS.length === 0) return deep;
  return `${deep} On ${ADDON_TIERS.map(planName).join(' and ')}, you can also add a seat or a branch.`;
}

/** The Free card's words (drawing § 1, desktop): what Free gives, and that Verified joins it. */
export const FREE_CARD_LINE = 'Your page, portfolio, QR codes and the free set of tools. Verified once your papers are approved.';

/** The plan name a person reads ("Ultra" for `enterprise`), for the page's tabs. */
export function growName(t: GrowTier): string {
  return planName(t);
}

/* ───────────────────────── 5 · the live service cards (redraw 23 Nov) ───────────────────────── */

/**
 * 🃏 THE LIVE CARDS (owner-approved drawing `prototypes/for_suppliers_redraw_2026-11-23/for_suppliers_redraw_fable.html`,
 * owner 23 Nov: *"Approved, build it"*). Four Card 14 samples answer a couple's date, guest count and venue; the scroll
 * plays four states and a tap drives the same state. ⚠ ILLUSTRATIONS, NOT APP DATA — the shops, prices, ratings, km and
 * closed days are samples, and the section says so ("Sample cards."). They live here, in one named place, beside the
 * other illustrations, so the guards can tell them apart. Every WORD a card prints is the app's own: the price band is
 * `mallPrice`, the date line `DATE_FIT_WORDS`, the distance `aboutKmLine`, the month `SeatMonths`.
 */
export type LiveCardSample = {
  name: string;
  cover: string;
  shop: string;
  city: string;
  /** A one-price card's price (pesos); null on the per-guest card. */
  price: number | null;
  priceNote: string | null;
  /** The per-guest card's rate (pesos per guest) — its band says the couple's total (`mallPrice`). */
  perGuest: number | null;
  rating: { avg: number; count: number };
  badges: readonly CardBadgeView[];
  /** The days of the sample month this shop closed (Check a date's grey, striped days). */
  closed: readonly number[];
  /** km to each sample venue, in `LIVE_VENUES` order. */
  km: readonly number[];
  /** Where the shop sits on the venue sketch (its viewBox is 300 × 150). */
  at: readonly [number, number];
};

const LIVE_ART = '/marketing/2026-11-20/for-suppliers';

export const LIVE_CARD_SAMPLES: readonly LiveCardSample[] = [
  {
    name: 'Plated dinner, five courses',
    cover: `${LIVE_ART}/t-price.webp`,
    shop: 'Casa Lirio Catering',
    city: 'Pasig',
    price: null,
    priceNote: null,
    perGuest: 850,
    rating: { avg: 4.9, count: 212 },
    badges: [
      { key: 'trending_now', since: null },
      { key: 'rave_reviews', since: null },
      { key: 'verified', since: null },
    ],
    closed: [6, 12, 13, 24, 25, 26, 31],
    km: [52, 7, 9],
    at: [212, 60],
  },
  {
    name: 'Full-day photo & video',
    cover: `${LIVE_ART}/c-photo.webp`,
    shop: 'Lumen Studio',
    city: 'Quezon City',
    price: 45999,
    priceNote: 'whole day, 2 shooters',
    perGuest: null,
    rating: { avg: 4.9, count: 128 },
    badges: [
      { key: 'trending_now', since: null },
      { key: 'verified', since: null },
    ],
    closed: [5, 19, 20, 24, 25, 27],
    km: [61, 12, 3],
    at: [180, 22],
  },
  {
    name: 'Bridal make-up and hair',
    cover: `${LIVE_ART}/c-makeup.webp`,
    shop: 'Blush by Ria',
    city: 'Makati',
    price: 18999,
    priceNote: 'bride + 1, with trial',
    perGuest: null,
    rating: { avg: 4.8, count: 86 },
    badges: [
      { key: 'quick_responder', since: null },
      { key: 'rave_reviews', since: null },
      { key: 'verified', since: null },
    ],
    closed: [13, 24, 25, 30],
    km: [48, 2, 13],
    at: [140, 76],
  },
  {
    name: 'Event highlights film',
    cover: `${LIVE_ART}/c-video.webp`,
    shop: 'Reel Day Films',
    city: 'Pasig',
    price: 35999,
    priceNote: '4-minute film',
    perGuest: null,
    rating: { avg: 5.0, count: 41 },
    badges: [
      { key: 'hot_booking', since: null },
      { key: 'verified', since: null },
    ],
    closed: [12, 24, 25],
    km: [53, 6, 10],
    at: [198, 44],
  },
];

/** The three sample venues and where each sits on the sketch. */
export const LIVE_VENUES: ReadonlyArray<{ name: string; pin: readonly [number, number] }> = [
  { name: 'Tagaytay', pin: [96, 122] },
  { name: 'Makati', pin: [152, 66] },
  { name: 'Quezon City', pin: [166, 32] },
];

/** The guest counts a couple can try. One dot on the slide is ten guests. */
export const LIVE_GUESTS = [50, 120, 250] as const;
export const LIVE_GUESTS_PER_DOT = 10;

/** One state of the stage: the couple's day (of the sample month), guests, venue (index) and the slide in view. */
export type LiveState = { day: number; guests: number; venue: number; slide: 0 | 1 | 2 };

/** What the scroll plays, step by step (the drawing's SCRIPT): the day moves, then the guests, then the venue. */
export const LIVE_SCRIPT: readonly LiveState[] = [
  { day: 12, guests: 50, venue: 0, slide: 0 },
  { day: 19, guests: 50, venue: 0, slide: 0 },
  { day: 19, guests: 120, venue: 0, slide: 1 },
  { day: 19, guests: 120, venue: 1, slide: 2 },
];

/** Where the scroll's progress (0–1) switches step — the drawing's 10 · 40 · 70 %. */
export function liveStepAt(progress: number): number {
  return progress < 0.1 ? 0 : progress < 0.4 ? 1 : progress < 0.7 ? 2 : 3;
}

/**
 * The sample month: the coming December (the season the drawing plays — 12 Dec is a "Popular day"), or next year's
 * once December has begun. Read from the server's clock, so the month is never in the past.
 */
export function liveCardsMonth(nowMs: number): { y: number; m: number } {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear();
  return { y: d.getUTCMonth() >= 11 ? y + 1 : y, m: 12 };
}

/* ───────────────────────── 7 · plans as growth stairs (redraw 23 Nov) ───────────────────────── */

/** Every plan, smallest to biggest — the stairs. */
export const STAIR_TIERS: readonly VendorTier[] = ['free', 'verified', ...GROW_TIERS];

/** A fact on a plan card: an optional bold lead ("15", "No limit") and the words after it. */
export type StairFact = { lead: string | null; text: string };

/** One step of the stairs, every part read: caps → `TIER_CAPS`, words → `planRole` / `storageWords`. */
export type PlanStair = {
  tier: VendorTier;
  name: string;
  role: string;
  size: string;
  /** The card's headline, clients first (`clientsKeptWords`, owner 2026-11-23 "Yes, clients first"); null = lead with the size. */
  clients: string | null;
  /** The line under the headline: the size, and for a counted plan how to make room (`planStorageLine`). */
  sizeLine: string | null;
  /** The size's share of the biggest plan's, on a log scale (50 MB and 1 TB both stay visible). 0–1. */
  share: number;
  services: StairFact;
  people: StairFact & { team: boolean };
  branches: StairFact;
  /** On Discover and Find — every verified shop, on every plan (`marketplaceSearchable`, gated on verification). */
  marketplace: boolean;
  /** A bought paid widget works on this plan (`specialTools`, `PRO_TOOLS_MIN_TIER` — owner a02673ac). */
  tools: boolean;
};

const finite = (n: number) => Number.isFinite(n);

/** The role line over a plan's name: a paid size's own role (`planRole`); Free runs, Verified gets found. */
function stairRole(t: VendorTier): string {
  if (isPaidSize(t)) return planRole(t);
  return t === 'verified' ? 'Get found' : 'Run your own clients';
}

/** Does a bought paid widget work on this plan? The gates, read — never a list typed here (owner a02673ac). */
export function stairHasTools(t: VendorTier): boolean {
  return TIER_CAPS[t].specialTools && isTierAtLeast(t, PRO_TOOLS_MIN_TIER);
}

export function planStair(t: VendorTier): PlanStair {
  const c = TIER_CAPS[t];
  const sizes = STAIR_TIERS.map((x) => TIER_CAPS[x].storageBytes ?? 0).filter((b) => b > 0);
  const lo = Math.log10(Math.min(...sizes)) - 0.5;
  const hi = Math.log10(Math.max(...sizes));
  const b = c.storageBytes ?? 0;
  const share = b > 0 ? Math.max(0.06, Math.min(1, (Math.log10(b) - lo) / (hi - lo))) : 0;
  const services: StairFact = finite(c.serviceCardsTotal)
    ? { lead: formatCount(c.serviceCardsTotal), text: c.serviceCardsTotal === 1 ? ' live service' : ' live services' }
    : { lead: 'No limit', text: ' on services' };
  const people = !finite(c.agentAccounts)
    ? { lead: 'No limit', text: ' on people', team: true }
    : c.agentAccounts > 0
      ? { lead: null, text: `You and ${formatCount(c.agentAccounts)} more`, team: true }
      : { lead: null, text: 'Just you', team: false };
  const branches: StairFact = !finite(c.branchesIncluded)
    ? { lead: 'No limit', text: ' on branches' }
    : c.branchesIncluded > 0
      ? { lead: formatCount(c.branchesIncluded), text: c.branchesIncluded === 1 ? ' branch' : ' branches' }
      : { lead: null, text: 'Main shop' };
  return {
    tier: t,
    name: t === 'free' ? 'Free' : planName(t),
    role: stairRole(t),
    size: sizeWords(c.storageBytes),
    clients: clientsKeptWords(t),
    sizeLine: planStorageLine(t),
    share,
    services,
    people,
    branches,
    marketplace: t !== 'free' && c.marketplaceSearchable,
    tools: stairHasTools(t),
  };
}

/* ───────────────────────── specialized tools (redraw 23 Nov) ───────────────────────── */

/**
 * The three paid widgets drawn here (the Toolkit sells four: the Song bank is drawn in the Toolkit only). Each one is
 * bought once in the Toolkit and works only while the shop is on Plus, Pro or Ultra (owner a02673ac, 23 Nov 2026:
 * bought AND subscribed — the plan alone no longer includes it). Names and lines are `SPECIALIZED_TOOLS`.
 */
export const PAID_TOOL_GATES: Readonly<Partial<Record<SpecializedToolKey, 'toolkit'>>> = {
  cake_tool: 'toolkit',
  papic_challenge: 'toolkit',
  plan_3d: 'toolkit',
};

export const PAID_TOOL_TILES: readonly SpecializedTool[] = SPECIALIZED_TOOLS.filter((t) => PAID_TOOL_GATES[t.key]);
/**
 * The on-the-day tools every shop has, on every plan — every FREE widget the Toolkit lists: never a paid one (the Song
 * bank is bought, so it is not "in every plan"), never a gated one (the Papic camera waits on its privacy switch).
 */
export const EVERY_PLAN_TOOLS: readonly SpecializedTool[] = SPECIALIZED_TOOLS.filter((t) => !PAID_TOOL_GATES[t.key] && !isPaidStoreTool(t.key) && !t.gate);

/** The first plan a bought widget works on — "Start on Plus". */
export const FIRST_TOOLS_TIER: VendorTier | null = STAIR_TIERS.find(stairHasTools) ?? null;
/** "Buy once · Plus, Pro or Ultra" — the chip on a paid widget's picture, from the plan table (a02673ac). */
export const PAID_WIDGET_CHIP_WORDS = `Buy once · ${PAID_WIDGET_PLAN_WORDS}`;

/** The chip on one paid widget's picture: bought once, works on a paid plan. Not a paid widget = no chip. */
export function paidToolChip(key: SpecializedToolKey): { words: string; locked: boolean } | null {
  return PAID_TOOL_GATES[key] ? { words: PAID_WIDGET_CHIP_WORDS, locked: true } : null;
}
