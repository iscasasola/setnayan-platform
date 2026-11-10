/**
 * _facts.ts — every number and plan tag /for-coordinators shows, READ from the code that enforces it.
 *
 * Owner, 6 Nov (build brief): "every price/cap READ from `platform_retail_catalog_v2` /
 * `vendor_billing_catalog` / `lib/vendor-tier-caps.ts`, never typed." The approved prototype
 * (`prototypes/for_coordinators_2026-11-06/index.html`, corpus) typed them; here each one is a function
 * of the module that decides it, so a cap that moves moves the page with it:
 *
 *   reach · categories · service cards · team seats · branches · waiting list ... `TIER_CAPS` (lib/vendor-tier-caps.ts)
 *   the plan a fold line opens from ............................................ `firstPlanWith` over `TIER_CAPS`
 *   50 portfolio photos ......................................................... `PORTFOLIO_FREE_BASE`
 *   one free helper .............................................................. `FREE_HELPER_SEATS` (lib/vendor-free-helper.ts)
 *   access ends 7 days after the event .......................................... `DELEGATE_GRACE_DAYS`
 *   badges at 10 · 50 · … · 10,000 ............................................... `MILESTONE_THRESHOLDS`
 *   the booking fee's two rates and its band .................................... the LIVE schedule (`getLiveBookingFeeSchedule`)
 *
 * Prices are not here — they are read per request in `_prices.server.ts`.
 *
 * Pure: no I/O, so the guard beside the page can call every function.
 */

import type { BookingFeeSchedule } from '@/lib/booking-fee';
import { DELEGATE_GRACE_DAYS } from '@/lib/delegate-access-window';
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';
import { MILESTONE_THRESHOLDS } from '@/lib/service-card-record';
import { FREE_HELPER_SEATS } from '@/lib/vendor-free-helper';
import {
  PORTFOLIO_FREE_BASE,
  TIER_CAPS,
  TIER_LABEL,
  firstPlanWith,
  type TierCaps,
  type VendorTier,
} from '@/lib/vendor-tier-caps';

import { FREE_FINDABLE } from '@/app/for-suppliers/_components/supplier-front-data';

import { countWord, type ClaimSwitch } from './_claims';

export { DELEGATE_GRACE_DAYS, FREE_HELPER_SEATS, PORTFOLIO_FREE_BASE };

/** "1 category" / "2 categories". */
function many(n: number, one: string, more: string): string {
  return `${formatCount(n)} ${n === 1 ? one : more}`;
}

/** "20 km" — or "Nationwide" for a plan whose reach is `Infinity` (Ultra since 2026-11-04). */
export function reachWords(km: number, nationwide = 'Nationwide'): string {
  return Number.isFinite(km) ? `${formatCount(km)} km` : nationwide;
}

/** The name a person reads for a tier — "Verified", not "Free · Verified"; "Ultra", never "enterprise". */
export function planName(t: VendorTier): string {
  return t === 'verified' ? 'Verified' : TIER_LABEL[t];
}

/** The paid ladder a person sees, in order. */
export const GROW_TIERS = ['solo', 'pro', 'enterprise'] as const;
export type GrowTier = (typeof GROW_TIERS)[number];

/**
 * Free's spec line — "1 category · 1 service card · found until your first inquiry". The search half is the rule the
 * database applies (`vendor_profiles.is_findable`, lib/findable-shop.ts, 7 Nov) — the SAME words /for-suppliers says
 * (`FREE_FINDABLE`). It said "not in search yet" until Build 6 Lane J, false since 7 Nov.
 */
export function freeSpec(): string {
  const c = TIER_CAPS.free;
  return `${many(c.parentCategories, 'category', 'categories')} · ${many(c.servicesPerLeaf, 'service card', 'service cards')} · ${FREE_FINDABLE}`;
}

/** Verified's spec line — "20 km around you · the Verified seal · get paid in the app". */
export function verifiedSpec(): string {
  return `${reachWords(TIER_CAPS.verified.serviceRadiusKm)} around you · the Verified seal · get paid in the app`;
}

/**
 * A paid plan's spec line, e.g. Pro: "100 km · 8 categories · 10 service cards each · 5 team seats ·
 * 3 branches · waiting list, 1 a date". A cap of 0 is left out (Solo has no branches and no waiting list).
 */
export function growSpec(t: GrowTier): string {
  const c: TierCaps = TIER_CAPS[t];
  const parts = [
    reachWords(c.serviceRadiusKm),
    many(c.parentCategories, 'category', 'categories'),
    `${many(c.servicesPerLeaf, 'service card', 'service cards')} each`,
    many(c.agentAccounts, 'team seat', 'team seats'),
  ];
  if (c.branchesIncluded > 0) parts.push(many(c.branchesIncluded, 'branch', 'branches'));
  if (c.waitlistAcceptances > 0) parts.push(`waiting list, ${formatCount(c.waitlistAcceptances)} a date`);
  return parts.join(' · ');
}

/** "20 km around you, 30 km on Solo, 100 km on Pro, nationwide on Ultra" — the search reach, plan by plan. */
export function reachLadderSentence(): string {
  const head = `${reachWords(TIER_CAPS.verified.serviceRadiusKm)} around you`;
  const rest = GROW_TIERS.map((t) => `${reachWords(TIER_CAPS[t].serviceRadiusKm, 'nationwide')} on ${planName(t)}`);
  return [head, ...rest.slice(0, -1)].join(', ') + `, ${rest[rest.length - 1]}`;
}

/** The pill a plan-gated line wears: "Solo+" / "Pro+" — or the bare name at the top of the ladder. */
export function planPill(t: VendorTier): string {
  return t === 'enterprise' ? planName(t) : `${planName(t)}+`;
}

/** The first plan a capability opens on, as its pill. Never null for a capability some plan has. */
function pillFor(has: (c: TierCaps) => boolean): string {
  const t = firstPlanWith(has);
  if (!t) throw new Error('no plan opens this capability — the line would promise something nobody can buy');
  return planPill(t);
}

/* ── The booking fee, in words, from the LIVE schedule ─────────────────────────────────────────── */

/** "5%" for 0.05 — at most three decimals, never a trailing zero. */
export function pctWords(rate: number): string {
  return `${Number((rate * 100).toFixed(3))}%`;
}
/** "₱100,000". */
export function pesoWords(php: number): string {
  return formatPhp(php);
}

/* ── "Everything you get" — the fold ──────────────────────────────────────────────────────────── */

export type FoldTag = { kind: 'free' | 'ver' | 'plan'; text: string };
export type FoldItem = { text: string; tag: FoldTag; needs?: ClaimSwitch };
export type FoldGroup = { name: string; icon: 'find' | 'book' | 'together' | 'day' | 'grow'; items: readonly FoldItem[] };

const FREE: FoldTag = { kind: 'free', text: 'Free' };
const plan = (has: (c: TierCaps) => boolean): FoldTag => ({ kind: 'plan', text: pillFor(has) });

/**
 * The prototype's five groups, word for word, with each plan pill read from the caps and each
 * switch-dependent line carrying the switch it needs. Built per call so a test can read it.
 */
export function foldGroups(): readonly FoldGroup[] {
  return [
    {
      name: 'Get found',
      icon: 'find',
      items: [
        { text: 'Your public page, auto-built, ready for Google', tag: FREE },
        { text: `${formatCount(PORTFOLIO_FREE_BASE)} portfolio photos`, tag: FREE },
        { text: 'Six QR codes: Shortlist, Check a date, My page, Booked, Crew, Review', tag: FREE },
        {
          text: `Shown in search ${reachWords(TIER_CAPS.verified.serviceRadiusKm)} around you`,
          tag: { kind: 'ver', text: 'Verified' },
        },
        { text: 'Wider search reach as you grow', tag: plan((c) => c.serviceRadiusKm > TIER_CAPS.verified.serviceRadiusKm) },
        { text: 'Your own web address', tag: plan((c) => c.customWebsiteName) },
        { text: 'Featured in Stories, editorial spotlights', tag: plan((c) => c.editorialFeatures) },
        { text: 'NFC tags, door sticker, ready-made printed pieces', tag: FREE },
      ],
    },
    {
      name: 'Get booked',
      icon: 'book',
      items: [
        { text: 'One inbox; only inquiries that match what you do', tag: FREE },
        { text: 'Quote in the chat: flat, per guest, per hour', tag: FREE },
        { text: 'Reservation → progress → balance on one timeline, with proof', tag: FREE },
        { text: 'Paid straight to your GCash or bank', tag: FREE },
        { text: 'Discounts, perks and the Setnayan gift on your cards', tag: FREE },
        { text: 'Give Setnayan gifts (like Papic) with your quote; you buy the stock', tag: FREE },
        { text: 'Double-booking guard', tag: FREE },
        { text: 'A day check before you accept, so two events never clash', tag: FREE },
        { text: 'Inquiries, payments and schedule changes reach your phone as notices', tag: FREE },
        { text: 'Waiting list per date', tag: plan((c) => c.waitlistAcceptances > 0) },
        { text: 'Meetings: in person, or a call on your own phone or Viber', tag: FREE },
      ],
    },
    {
      name: 'Plan together',
      icon: 'together',
      items: [
        { text: 'Full Event Access: Edit, View or Off per part, set by the couple', tag: FREE },
        { text: 'Ask the host for the parts you need', tag: FREE },
        { text: 'One login opens every event you run', tag: FREE },
        { text: 'One run of show; each supplier sees only their rows', tag: FREE, needs: 'runOfShow' },
        { text: 'Auto-arrange the seat plan, then move anyone by hand', tag: FREE },
        { text: 'Prepare in private, release when ready', tag: FREE, needs: 'prepRelease' },
        { text: 'Booked suppliers and deposits, tracked for the couple', tag: FREE },
        { text: 'Private notes, and notes the couple can read', tag: FREE, needs: 'privateNotes' },
        { text: 'Import past clients', tag: FREE },
      ],
    },
    {
      name: 'Run the day',
      icon: 'day',
      items: [
        { text: 'Cue the show, part by part', tag: FREE, needs: 'dayOfFree' },
        { text: 'Requests inbox for every supplier', tag: FREE, needs: 'dayOfFree' },
        { text: 'Approve or decline supplier time changes', tag: FREE },
        { text: 'Check-in desk and seat scanner', tag: FREE, needs: 'dayOfFree' },
        { text: 'Announcements on every guest’s phone', tag: FREE, needs: 'announcements' },
        { text: 'Saved for no signal', tag: FREE },
        { text: `${countWord(FREE_HELPER_SEATS)} helper seat${FREE_HELPER_SEATS === 1 ? '' : 's'}`, tag: FREE },
        { text: 'Team seats, each with their own login', tag: plan((c) => c.agentAccounts > 0) },
      ],
    },
    {
      name: 'Grow',
      icon: 'grow',
      items: [
        { text: `Badges from ${badgeSpan()} events; stars; years`, tag: FREE },
        { text: 'Returning-client mark and discount', tag: FREE },
        { text: 'Reviews with "Verified booking"; right of reply', tag: FREE },
        { text: 'Price-position meter, profile score', tag: FREE },
        { text: 'Earnings dashboard, won and lost reasons', tag: plan((c) => c.soloBusinessTools) },
        { text: 'Reverse-image theft watch', tag: plan((c) => c.theftWatch) },
        { text: 'Branches under one shop', tag: plan((c) => c.branchesIncluded > 0) },
        // Category benchmarks vs peers — the Ultra row of the shipped plan list
        // (`app/_components/home/vendor-benefits.ts`, "Market Intelligence — category benchmarks vs peers").
        // No cap flag isolates it (`marketIntel` is Pro's Demand Radar), so it is named by the plan it is sold in.
        { text: 'Market Intelligence', tag: { kind: 'plan', text: planPill('enterprise') } },
        { text: 'Gifts per badge', tag: FREE },
      ],
    },
  ];
}

/* ── Badges ───────────────────────────────────────────────────────────────────────────────────── */

/** "10 to 10,000" — the first and last rung of the events ladder. */
export function badgeSpan(): string {
  const first = MILESTONE_THRESHOLDS[0];
  const last = MILESTONE_THRESHOLDS[MILESTONE_THRESHOLDS.length - 1];
  return `${formatCount(first)} to ${formatCount(last)}`;
}

/** "10 · 50 · 100 · 500 · 1,000 · 5,000 · 10,000" — every rung. */
export function badgeRungs(): string {
  return MILESTONE_THRESHOLDS.map((n) => formatCount(n)).join(' · ');
}

/* ── The fee slider's three steps ─────────────────────────────────────────────────────────────── */

/** What the fee slider is allowed to compute with — the live schedule's numbers only. */
export type FeeFacts = Pick<BookingFeeSchedule, 'rate' | 'tailRate' | 'tier1LimitPhp' | 'minPhp'>;
