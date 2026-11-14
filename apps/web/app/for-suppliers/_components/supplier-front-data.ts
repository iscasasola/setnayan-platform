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
 *   · the 3D seat-plan logo                                           → `boothTierCanBrand` (booth-branding-tier-gate)
 *   · plan prices, the year price, the branch + seat add-ons          → the catalog, read by the page (getVendorPrices)
 *   · the booking fee                                                  → the live schedule, read by the page
 *
 * Pure module (no React, no I/O) — `supplier-front-reads-its-numbers.test.ts` runs it.
 */
import { VENDOR_TIER_SECTIONS } from '@/app/_components/home/vendor-benefits';
import { boothTierCanBrand } from '@/lib/booth-branding-tier-gate';
import { countNoun, formatCount } from '@/lib/format-number';
import { MILESTONE_THRESHOLDS } from '@/lib/service-card-record';
import { FREE_FINDABLE } from './plan-table-data';
import { FREE_HELPER_SEATS } from '@/lib/vendor-free-helper';
import { SPECIALIZED_TOOLS_INCLUDED_TIERS } from '@/lib/specialized-tools-access';
import { TILE_PARENT } from '@/lib/taxonomy';
import { PLAN_CHATBOT_LEVEL } from '@/lib/vendor-ai-level';
import {
  PORTFOLIO_FREE_BASE,
  TIER_CAPS,
  canBuyExtraBranches,
  canBuyExtraSeats,
  TIER_LABEL,
  firstPlanWith,
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

/** "20 km" / "nationwide" from a radius (Ultra is `Infinity`). */
function reach(km: number, nationwide = 'nationwide'): string {
  return Number.isFinite(km) ? `${formatCount(km)} km` : nationwide;
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
 * "1 category · 1 service card · found until your first inquiry" — Free's line, from its caps. The search half is the
 * 7 Nov rule the database applies (`vendor_profiles.is_findable`, lib/findable-shop.ts): an unverified shop shows in
 * search until its first inquiry, then waits for Verified. (It said "not in search yet" until Lane J — false since 7 Nov.)
 */
export function freeSpec(): string {
  const c = TIER_CAPS.free;
  return `${countNoun(c.parentCategories, 'category', 'categories')} · ${countNoun(c.servicesPerLeaf, 'service card', 'service cards')} · ${FREE_FINDABLE}`;
}

/** "20 km around you · the Verified seal · get paid in the app" — Verified's line. */
export function verifiedSpec(): string {
  return `${reach(TIER_CAPS.verified.serviceRadiusKm)} around you · the Verified seal · get paid in the app`;
}

/** How many main categories there are (the taxonomy's own parents) — "all 16" when a plan takes every one. */
export const MAIN_CATEGORY_COUNT = new Set(Object.values(TILE_PARENT)).size;

/**
 * A paid plan's spec line, e.g. Pro: "100 km · 8 categories · 10 service cards each · 3 bookings a day per service, at
 * each branch · 5 team seats · 3 branches · waiting list, 1 a date". A part a plan does not have (Plus's branches,
 * Plus's waiting list) is left out, as the prototype leaves it out. Every number is TIER_CAPS.
 */
export function growSpec(t: GrowTier): string {
  const c: TierCaps = TIER_CAPS[t];
  const parts = [
    reach(c.serviceRadiusKm, 'Nationwide'),
    c.parentCategories >= MAIN_CATEGORY_COUNT
      ? `all ${formatCount(MAIN_CATEGORY_COUNT)} categories`
      : countNoun(c.parentCategories, 'category', 'categories'),
    `${countNoun(c.servicesPerLeaf, 'service card', 'service cards')} each`,
    `${countNoun(c.bookingsPerDatePerService, 'booking', 'bookings')} a day per service, at each branch`,
    countNoun(c.agentAccounts, 'team seat', 'team seats'),
  ];
  if (c.branchesIncluded > 0) parts.push(countNoun(c.branchesIncluded, 'branch', 'branches'));
  if (c.waitlistAcceptances > 0) parts.push(`waiting list, ${formatCount(c.waitlistAcceptances)} a date`);
  return parts.join(' · ');
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
  { text: 'Your logo on the couple’s 3D seat plan (3D Booth add-on)', row: /3D seat plan/ },
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
  const firstBasic = GROW_TIERS.find((g) => PLAN_CHATBOT_LEVEL[g] === 'basic') ?? null;
  const firstAdvanced = GROW_TIERS.find((g) => PLAN_CHATBOT_LEVEL[g] === 'advanced') ?? null;
  const out: GrowLine[] = [];
  if (firstTools === t) out.push({ text: 'All specialized tools, included', lead: true });
  if (firstBasic === t) out.push({ text: 'AI chatbot, included', tail: ': answers price, dates and what’s included', lead: true });
  if (firstAdvanced === t) {
    out.push({ text: 'The smarter AI chatbot', tail: ': writes in your voice, replies in the couple’s language', lead: true });
  }
  if (t === GROW_TIERS[GROW_TIERS.length - 1]) out.push({ text: 'Higher limits built in, nothing to add on', lead: true });
  return out;
}

/**
 * The lines shown under one paid plan. A line whose Plans-page row is gone is dropped (never shown under a guess);
 * the 3D seat-plan line additionally sits under the FIRST plan `boothTierCanBrand` opens, so the gate and the page
 * cannot disagree.
 */
export function growLines(t: GrowTier): GrowLine[] {
  const firstBooth = GROW_TIERS.find((g) => boothTierCanBrand(g)) ?? null;
  return [...foldedLines(t), ...GROW_LINES.filter((l) => {
    const at = l.row.source.includes('3D') ? firstBooth : tierOfPlansRow(l.row);
    return at === t;
  }).map((l) => ({ text: l.text, tail: l.tail, lead: l.lead === true }))];
}

/** The papers Verified asks for, as the step says them. `REQUIRED_DOC_COUNT` holds the count (see the test). */
export const VERIFIED_PAPERS = ['DTI or SEC', 'BIR 2303', 'Permit', 'Bank proof'] as const;

/* ───────────────────────── reach, the free base, the badges ───────────────────────── */

/** "20 km around you, 30 km on Solo, 100 km on Pro, nationwide on Ultra" — the ⓘ under the QR codes. */
export function reachSentence(): string {
  const head = `${reach(TIER_CAPS.verified.serviceRadiusKm)} around you`;
  const rest = GROW_TIERS.map((t) => `${reach(TIER_CAPS[t].serviceRadiusKm)} on ${planName(t)}`);
  return [head, ...rest.slice(0, -1)].join(', ') + `, ${rest[rest.length - 1]}`;
}

/** Verified's own reach, for "Shown in search 20 km around you". */
export const VERIFIED_REACH = reach(TIER_CAPS.verified.serviceRadiusKm);

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
const reachGrowsFrom = firstPlanWith((c) => c.serviceRadiusKm > TIER_CAPS.verified.serviceRadiusKm);
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
        at(`Shown in search ${VERIFIED_REACH} around you`, 'verified'),
        at('Wider search reach as you grow', reachGrowsFrom),
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
