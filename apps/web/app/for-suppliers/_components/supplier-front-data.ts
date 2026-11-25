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
import { deepSearchAllowanceWords } from '@/lib/deep-search-findings';
import { VENDOR_TIER_SECTIONS } from '@/app/_components/home/vendor-benefits';
import { bookingFeeCapAmount, bookingFeeFigures, bookingFeePhp, type BookingFeeSchedule } from '@/lib/booking-fee';
import { formatPhpRounded } from '@/lib/php';
import { SHOP_BADGE_KEYS, type ShopBadgeKey } from '@/lib/badge-tiers';
import { BADGE_NAME } from '@/lib/graph-unlocks';
import { BADGE_ART_H, BADGE_ART_W, SHELF_BADGE_KEYS, SHELF_FAMILY, VERIFIED_TILE_TITLE, badgeArtSrc } from '@/lib/shop-badge-shelf';
import { alwaysAllowedPack, bundleFreePacks, type ShopGiftBundle, type ShopGiftPack } from '@/lib/shop-gifts';
import type { PlanCredits } from '@/lib/event-plans';
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
import { SPECIALIZED_TOOLS, type SpecializedToolKey } from '@/lib/specialized-tools';
import { SHELF_TITLE, STORE_GRAPHS, isBuiltInWidget, isPaidStoreTool, isShopBadgeKey, qrWords, toolkitItems } from '@/lib/supplier-store';
import { avTemplateOf, payTemplateOf } from '@/lib/toolkit-templates';
import { PLAN_CHATBOT_LEVEL } from '@/lib/vendor-ai-level';
import {
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
        free('Portfolio photos, no limit'),
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
 * The one line under the plan cards that replaced the add-ons box (drawing § 1). Since 2026-11-22 Deep Search is NOT
 * sold (DECISION_LOG ✂️ "DEEP SEARCH IS RETIRED" + 🔎 "1 RUN A MONTH"): the line says what the paid plans include, from
 * the admin's monthly number (`platform_settings.deep_search_runs_per_month`, read by the caller; null = no number
 * said) — never a price. The plan that may add seats and branches is `ADDON_TIERS` (canBuyExtra*).
 */
export function buyMoreLine(deepSearchRunsPerMonth: number | null): string {
  const deep = `Deep Search: ${deepSearchAllowanceWords(deepSearchRunsPerMonth)}`;
  if (ADDON_TIERS.length === 0) return deep;
  return `${deep} On ${ADDON_TIERS.map(planName).join(' and ')}, you can also add a seat or a branch.`;
}

/** The Free card's words (drawing § 1, desktop): what Free gives, and that Verified joins it. */
export const FREE_CARD_LINE = 'Your page, portfolio, QR codes and the free set of tools. Verified once your papers are approved.';

/** The plan name a person reads ("Ultra" for `enterprise`), for the page's tabs. */
export function growName(t: GrowTier): string {
  return planName(t);
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


/* ══════════════════════ THE REDESIGN OF 23 NOV 2026 (owner-APPROVED, drawing v4.3.1) ══════════════════════
 *
 * Specs `prototypes/for_suppliers_redesign_2026-11-23/index.html` (v4.3.1) · DECISION_LOG 2026-11-23 "/for-suppliers
 * redesign APPROVED (owner)": *"if this is the best you can do, setnayan for suppliers approve."* Everything below is a
 * PURE fact the page prints, each read from where the app keeps it — never typed:
 *
 *   · the fee steps' fees      → `bookingFeePhp(v, schedule)` on the LIVE schedule; the two bookings are examples
 *   · the fee rows + cap line   → `bookingFeeFigures` / `bookingFeeCapAmount` on the same schedule
 *   · the gifts                 → the shop-gift packs (`fetchShopGiftPacks`, `platform_retail_catalog_v2`) + the
 *                                 event plans' included credits (`planCreditsFrom`) + the 10+1 bundle (`bundleFreePacks`)
 *   · the Toolkit count + sheet → `toolkitClaim` (lib/supplier-toolkit-count.ts) · `toolkitItems` (see `toolkitShelves`)
 *   · the plans                 → `planStair` (`TIER_CAPS`); prices from the catalog, handed in by the page
 *   · the badges row            → `SHOP_BADGE_KEYS`, their names `BADGE_NAME`, their art `badgeArtSrc`
 *
 * 🎞 MEDIA SLOTS (`FRONT_MEDIA`): every picture and clip the page draws, in ONE place, so the follow-up that swaps in
 * the real captures (DECISION_LOG: "replace it in a follow-up once video-loops has filmed them") edits this table only.
 */

/** Where the redesign's art lives (copied from the drawing's `art/`, stills as webp). */
export const FRONT_ART = '/marketing/2026-11-23/for-suppliers';

/** A clip: an mp4 that plays only while on screen, its poster painted first. `shape` is its crop (4:3 · 3:4). */
export type FrontClip = { src: string; poster: string; label: string; shape: 'wide' | 'tall' };
/** A still: one picture, its own size (for the box it reserves) and what it shows. */
export type FrontStill = { src: string; alt: string; w: number; h: number };

const clip = (name: string, label: string, shape: FrontClip['shape']): FrontClip => ({
  src: `${FRONT_ART}/clip-${name}.mp4`,
  poster: `${FRONT_ART}/clip-${name}-poster.webp`,
  label,
  shape,
});
const still = (name: string, alt: string, w: number, h: number): FrontStill => ({ src: `${FRONT_ART}/${name}.webp`, alt, w, h });

/** One beat of "A couple finds your card": the couple's pick (4:3) beside the cards it moves (3:4). */
export type CardBeat = { say: string; mean: string; pick: FrontClip; cards: FrontClip };

export const FRONT_MEDIA = {
  hero: { src: '/marketing/2026-11-20/for-suppliers/hero.webp', alt: 'A florist setting a long table before a reception' },
  beats: [
    {
      say: 'A couple picks Sat 19 Dec.',
      mean: 'Lumen Studio is booked that day. Its card steps aside.',
      pick: clip('date-pick', 'The couple picks 19 December on the month', 'wide'),
      cards: clip('date-cards', 'One card leaves the row', 'tall'),
    },
    {
      say: 'They invite 120 guests.',
      mean: 'Casa Lirio Catering shows its price for 120 guests by itself.',
      pick: clip('guests-pick', 'The couple picks 120 guests', 'wide'),
      cards: clip('guests-cards', 'The caterer’s price changes', 'tall'),
    },
    {
      say: 'Their venue is in Makati.',
      mean: 'Each card shows how far it is from their venue.',
      pick: clip('venue-pick', 'The couple picks a venue in Makati', 'wide'),
      cards: clip('venue-cards', 'Each card’s distance changes', 'tall'),
    },
  ] satisfies readonly CardBeat[],
  shop: [
    still('still-shop', 'A shop page: its name, Verified seal, stars, years in business and events', 750, 562),
    still('still-check-a-date', 'Check a date: a month showing which days are free', 800, 600),
  ],
  verified: [
    still('still-open-shop', 'Open your shop: three answers', 814, 610),
    still('still-clients', 'Your clients: booked, asked and to collect, then the first two clients', 854, 640),
  ],
  /** The two tool stills, keyed to the `SPECIALIZED_TOOLS` entry whose name and line they carry. */
  tools: [
    { key: 'papic_challenge', still: still('tool-papic', 'The Papic camera with its challenge', 780, 584) },
    { key: 'plan_3d', still: still('tool-3d', 'The 3D plan’s dessert station', 780, 584) },
  ] satisfies ReadonlyArray<{ key: SpecializedToolKey; still: FrontStill }>,
  gift: clip('gift-box', 'A gift box from the shop opens and a Papic ticket rises out', 'tall'),
} as const;

/* ── #fees · the timed steps ─────────────────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠ ILLUSTRATIONS, NOT PRICES: the two booking amounts the fee steps play (the drawing's). Each step's FEE is computed
 * from the live schedule by `bookingFeePhp`; nothing about the fee is typed.
 */
export const FEE_STEP_BOOKINGS = { usual: 80_000, big: 500_000 } as const;

/**
 * The share a booking the supplier brought carries: none. One formatted value ("0%") for the hero line and the
 * "Clients you bring" row, through the same formatter as the steps' shares — never typed into the page.
 */
export const BROUGHT_CLIENT_SHARE = new Intl.NumberFormat('en-PH', { style: 'percent', maximumFractionDigits: 1 }).format(0);

/** One step: what happened, the ONE figure, its line under it, then what it meant. */
export type FeeStep = { say: string; fee: string; sub: string; mean: string };

const PCT_OF = new Intl.NumberFormat('en-PH', { style: 'percent', maximumFractionDigits: 1 });

/**
 * The three steps, ₱0 → the usual fee → a bigger booking's fee, on the schedule the page read. `giftTitle` is the
 * smallest gift's catalogue title (the step-1 line names it); null when the gifts could not be read (the line then
 * says nothing rather than name a gift).
 */
export function feeSteps(schedule: BookingFeeSchedule, giftTitle: string | null): FeeStep[] {
  const f = bookingFeeFigures(schedule);
  const { usual, big } = FEE_STEP_BOOKINGS;
  const share = (v: number) => `${PCT_OF.format(bookingFeePhp(v, schedule) / v)} of the booking`;
  return [
    {
      say: `A couple you brought books you for ${formatPhpRounded(usual)}.`,
      fee: formatPhpRounded(0),
      sub: giftTitle ? `Your gift to them: ${giftTitle}` : '',
      mean: 'Clients you bring carry no fee.',
    },
    {
      say: `A couple who found you on Setnayan books ${formatPhpRounded(usual)}.`,
      fee: formatPhpRounded(bookingFeePhp(usual, schedule)),
      sub: share(usual),
      mean: `That is ${f.head} of the first ${f.band}.`,
    },
    {
      say: `A bigger booking: ${formatPhpRounded(big)}.`,
      fee: formatPhpRounded(bookingFeePhp(big, schedule)),
      sub: share(big),
      mean: `The rate drops above ${f.band}.`,
    },
  ];
}

/** The two fee rows and the cap line, on the same schedule: "5%, 3% above ₱100,000" · "Never more than ₱100,000.". */
export function feeRowWords(schedule: BookingFeeSchedule): { setnayan: string; cap: string } {
  const f = bookingFeeFigures(schedule);
  return {
    setnayan: `${f.head}, ${f.tail} above ${f.band}`,
    cap: `Never more than ${bookingFeeCapAmount(schedule)}. Your couple never pays it.`,
  };
}

/* ── #cards · the badges row ─────────────────────────────────────────────────────────────────────────────────────── */

/** The tier picture the row shows (the drawing's art is each family's third tier). */
const BADGE_ROW_TIER = 3;

/** The five shop badges, each with its name and its approved v84 picture — the Shop's own list, never a second one. */
export const BADGE_ROW: ReadonlyArray<{ key: ShopBadgeKey; name: string; src: string; w: number; h: number }> = SHOP_BADGE_KEYS.map(
  (k) => ({ key: k, name: BADGE_NAME[k], src: badgeArtSrc(SHELF_FAMILY[k], BADGE_ROW_TIER), w: BADGE_ART_W, h: BADGE_ART_H }),
);

/* ── #tools · the Toolkit count and its "See all" sheet ──────────────────────────────────────────────────────────── */

export type ToolkitTag = 'free' | 'paid' | 'built';
export type ToolkitRow = { key: string; name: string; line: string | null; tag: ToolkitTag | null };
type ToolkitShelfKey = 'tools' | 'payment_plans' | 'availability' | 'qr' | 'graphs' | 'badges';
export type ToolkitShelf = { key: ToolkitShelfKey; title: string; rows: ToolkitRow[] };

/**
 * 🧾 THE TOOLKIT'S SHEET, from the ONE Toolkit list (`toolkitItems`, lib/supplier-store.ts — Toolkit v19 PR 2): the
 * widgets (the Papic camera only while its privacy switch is on), the payment-plan and availability templates, the QR
 * designs, the graphs (named by `STORE_GRAPHS`) and the badges (the shelf's one list, `SHELF_BADGE_KEYS` — the same list
 * the Toolkit counts). Each item once, never padded; a
 * shelf with no item is left out. The sheet lists them by name — the page's ONE number is `toolkitClaim`
 * (lib/supplier-toolkit-count.ts), so no shelf carries a second count (controller, 24 Nov: one count).
 *
 * A tag is the Toolkit's own (owner a02673ac, 23 Nov): the paid widgets (`PAID_STORE_TOOLS`, each bought once in the
 * Toolkit, working only on a paid plan) are Paid; the built-in widgets (`BUILT_IN_WIDGETS`) and the built-in QR codes
 * are Built in; every other widget, template, QR design and graph is Free. A badge is earned, never sold: Built in.
 */
export function toolkitShelves(papicCapture: boolean): ToolkitShelf[] {
  const rows: Record<ToolkitShelfKey, ToolkitRow[]> = { tools: [], payment_plans: [], availability: [], qr: [], graphs: [], badges: [] };
  const widgetTag = (k: SpecializedToolKey): ToolkitTag => (isPaidStoreTool(k) ? 'paid' : isBuiltInWidget(k) ? 'built' : 'free');
  for (const i of toolkitItems({ papicCapture, badges: SHELF_BADGE_KEYS })) {
    if (i.kind === 'widget') {
      const t = SPECIALIZED_TOOLS.find((x) => x.key === i.key);
      if (t) rows.tools.push({ key: t.key, name: t.title, line: t.line, tag: widgetTag(t.key) });
    } else if (i.kind === 'template') {
      const t = i.of === 'pay' ? payTemplateOf(i.key) : avTemplateOf(i.key);
      if (t) rows[i.of === 'pay' ? 'payment_plans' : 'availability'].push({ key: `${i.of}:${t.key}`, name: t.name, line: null, tag: 'free' });
    } else if (i.kind === 'qr') {
      const w = qrWords(i.key);
      rows.qr.push({ key: i.key, name: w.name, line: w.line, tag: i.builtIn ? 'built' : 'free' });
    } else if (i.kind === 'graph') {
      rows.graphs.push({ key: i.key, name: STORE_GRAPHS[i.key].title, line: null, tag: 'free' });
    } else if (i.key === 'verified') {
      rows.badges.push({ key: i.key, name: VERIFIED_TILE_TITLE, line: null, tag: 'built' });
    } else if (isShopBadgeKey(i.key)) {
      rows.badges.push({ key: i.key, name: BADGE_NAME[i.key], line: null, tag: 'built' });
    }
  }
  const order: readonly ToolkitShelfKey[] = ['tools', 'payment_plans', 'availability', 'qr', 'graphs', 'badges'];
  return order.map((key) => ({ key, title: SHELF_TITLE[key], rows: rows[key] })).filter((sh) => sh.rows.length > 0);
}

/* ── #plans · the rail and the plan cards ────────────────────────────────────────────────────────────────────────── */

/**
 * The words a plan card says about the paid tools (owner a02673ac, 23 Nov: bought AND subscribed): from
 * `PRO_TOOLS_MIN_TIER` up a bought paid widget works (`stairHasTools`) — the drawing's "Paid tools: buy each once. They
 * work while you’re subscribed." A plan never says it includes a paid widget. Below it they are locked.
 */
export const PLAN_PAID_TOOLS_OK = 'Paid tools: buy each once. They work while you’re subscribed.';
export const PLAN_PAID_TOOLS_LOCKED = `Paid tools need ${planName(PRO_TOOLS_MIN_TIER)} or higher`;

/* ── #gift · what a supplier can hand a couple ───────────────────────────────────────────────────────────────────── */

export type GiftRow = { code: string; title: string; price: string; line: string };

/**
 * The three gifts the drawing names — the smallest Papic pack, Event Plus and Event Pro — read from the shop-gift
 * packs on sale (`ShopGiftPack`, the catalogue's title and list price). Their lines name the credits the catalogue
 * gives (the pack's own credits; the plans' `included_papic_credits`), or none when unread. `null` = the gifts could
 * not be read (the section then says so); a gift not on sale today is simply not listed.
 */
export function giftRows(packs: readonly ShopGiftPack[] | null, credits: Pick<PlanCredits, 'plusCredits' | 'proCredits'>): GiftRow[] | null {
  if (!packs) return null;
  const papic = alwaysAllowedPack(packs);
  const plus = packs.find((p) => p.kind === 'event_plus') ?? null;
  const pro = packs.find((p) => p.kind === 'event_pro') ?? null;
  const price = (p: ShopGiftPack) => formatPhpRounded(p.srpCentavos / 100);
  const papicWords = (n: number | null) => (n ? `, ${formatCount(n)} Papic credits` : '');
  const rows: GiftRow[] = [];
  if (papic) rows.push({ code: papic.code, title: papic.title, price: price(papic), line: `${formatCount(papic.credits)} Papic credits for their guests’ photos.` });
  if (plus) {
    rows.push({ code: plus.code, title: plus.title, price: price(plus), line: `Their Event Hub with every theme, a cinematic Save the Date${papicWords(credits.plusCredits)}.` });
  }
  if (pro) {
    rows.push({
      code: pro.code,
      title: pro.title,
      price: price(pro),
      line: `Everything in ${plus?.title ?? 'Event Plus'}, with their own photos and video, Setnayan AI${papicWords(credits.proCredits)}, no Setnayan mark.`,
    });
  }
  return rows;
}

/** "from ₱99" — the smallest gift's list price; null when the gifts could not be read. */
export function giftFromPrice(packs: readonly ShopGiftPack[] | null): string | null {
  const p = packs ? alwaysAllowedPack(packs) : null;
  return p ? formatPhpRounded(p.srpCentavos / 100) : null;
}

/** "Buy 10, get 1 free." — the smallest pack's bundle, as the catalogue sets it; null when none is on sale or unread. */
export function giftBundleLine(packs: readonly ShopGiftPack[] | null, bundles: readonly ShopGiftBundle[] | null): string | null {
  const papic = packs ? alwaysAllowedPack(packs) : null;
  const b = papic && bundles ? bundles.find((x) => x.pack.code === papic.code) : null;
  if (!b) return null;
  const free = bundleFreePacks(b);
  if (free <= 0) return null;
  return `Buy ${formatCount(b.quantity - free)}, get ${formatCount(free)} free.`;
}

/**
 * The rail bar's height for a plan (0–1): its storage over the biggest plan's, straight (the drawing's `gb / 1000`), so
 * the bars read as the room each plan holds. Read from `TIER_CAPS`; a plan with no size reads 0 (the bar's 5 px floor).
 */
export function railShare(t: VendorTier): number {
  const max = Math.max(...STAIR_TIERS.map((x) => TIER_CAPS[x].storageBytes ?? 0));
  const b = TIER_CAPS[t].storageBytes ?? 0;
  return max > 0 ? b / max : 0;
}
