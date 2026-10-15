/**
 * lib/vendor-plan-rows.ts — the words on the supplier's Plan screen (simpler supplier dashboard step 6; owner-APPROVED
 * 2026-10-14; prototype `supplier_easy_dashboard_2026-10-14_fable.html` SCREENS.plan).
 *
 * PURE. Every line is DERIVED from values the page already read — the plan table (`TIER_CAPS`), the live booking-fee
 * standing (`resolveBookingFeeStanding`), the catalogue price. Nothing here types a peso, a rate or a cap:
 *   · "What <plan> gives you" reads `TIER_CAPS` (checklist 16.2: the prototype's typed "Free · 1 booking a cycle" was
 *     wrong; the build must read the table). Counted features go through the SAME flag-aware allowance the actions
 *     enforce (`vendorAllowance` semantics), so the fold never promises a number the shop cannot use, or hides one it can.
 *   · The booking-fee line reads the live schedule through `bookingFeeScheduleSummary(standing.schedule)` and the
 *     standing's own ordinal ("N of 5 used") — never `FEE_RATE`, never a flat ₱ (checklist X2).
 *
 * Held by `lib/vendor-plan-rows.test.ts`.
 */
import { bookingFeeScheduleSummary } from './booking-fee';
import type { BookingFeeStanding } from './booking-fee-disclosure';
import { FREE_BOOKING_LIMIT } from './booking-fee-lock';
import { FREE_HELPER_SEATS } from './vendor-free-helper';
import { formatCount } from './format-number';
import { TIER_CAPS, VENDOR_TIERS, asVendorTier, type VendorTier } from './vendor-tier-caps';
import { planWord } from './vendor-plan-change-words';

export type PlanRowBadge = { tone: 'ok' | 'wait' | 'no' | 'quiet'; word: string };
export type PlanLine = { key: string; title: string; line: string };

const n = (v: number) => (Number.isFinite(v) ? formatCount(v) : 'No limit');
const plural = (v: number, one: string, many: string) => (v === 1 ? one : many);

/** The smallest plan that includes a counted feature — mirrors `entryTierAllowance`, kept local so this file stays pure of flags. */
function entryAllowance(key: 'agentAccounts' | 'waitlistAcceptances'): number {
  for (const t of VENDOR_TIERS) {
    const v = TIER_CAPS[t][key];
    if (v > 0) return v;
  }
  return 0;
}

/** A counted feature as the shop actually gets it — the plan's own number, or the entry plan's while the paywall is off. */
function allowance(planValue: number, key: 'agentAccounts' | 'waitlistAcceptances', paywallOn: boolean): number {
  if (planValue > 0) return planValue;
  return paywallOn ? planValue : entryAllowance(key);
}

/**
 * "What <plan> gives you" — read from the plan table, one line each. `paywallOn` is `isVendorFeatureGateEnabled()`
 * (the caller asks; this file reads no env). While it is OFF, every plan gets what the paywall would otherwise hold
 * back, and the lines say so rather than quoting a cap nobody enforces.
 */
export function planGivesLines(tierRaw: string | null | undefined, paywallOn: boolean): PlanLine[] {
  const tier: VendorTier = asVendorTier(tierRaw);
  const c = TIER_CAPS[tier];
  const seats = allowance(c.agentAccounts, 'agentAccounts', paywallOn);
  const waitlist = allowance(c.waitlistAcceptances, 'waitlistAcceptances', paywallOn);
  const free = FREE_HELPER_SEATS > 0 ? ` + ${formatCount(FREE_HELPER_SEATS)} free Helper` : '';
  const reach = !Number.isFinite(c.serviceRadiusKm) || c.serviceRadiusKm >= 100
    ? 'Nationwide'
    : c.serviceRadiusKm > 0
      ? `${formatCount(c.serviceRadiusKm)} km around you`
      : 'Not in couples’ search on this plan';
  const insights = !paywallOn
    ? 'All of it — open to every plan today'
    : c.marketIntel
      ? 'All of it, with demand and price compare'
      : c.performanceAdvanced
        ? 'Funnel and where bookings come from'
        : c.performanceTrends
          ? 'The basics'
          : 'Not on this plan';
  return [
    {
      key: 'services',
      title: 'Services you can put up',
      line: `${n(c.servicesPerLeaf)} per kind · ${Number.isFinite(c.parentCategories) ? `${formatCount(c.parentCategories)} ${plural(c.parentCategories, 'kind of work', 'kinds of work')}` : 'every kind of work'}`,
    },
    {
      key: 'helpers',
      title: 'Helpers',
      line: Number.isFinite(seats)
        ? `${formatCount(seats)} team ${plural(seats, 'seat', 'seats')}${free}`
        : `No limit${free}`,
    },
    {
      key: 'waitlist',
      title: 'Waiting list',
      line: waitlist > 0 ? `${n(waitlist)} a date` : 'Not on this plan',
    },
    {
      key: 'holding',
      title: 'Asking for a date · couples at once',
      line: `${n(c.whitelistPerDate)} a date`,
    },
    { key: 'reach', title: 'How far you reach', line: reach },
    { key: 'insights', title: 'How is my business doing', line: insights },
    {
      key: 'web',
      title: 'Your own web address',
      line: c.customWebsiteName ? 'Yes' : 'Comes with Pro',
    },
  ];
}

/**
 * The Booking fee row — from the LIVE standing for the shop's NEXT Setnayan booking (eventId null), plus how many
 * bills are waiting. `null` = render no row (the fee system is off). An unread standing says so; it never reads as free.
 */
export function bookingFeeRow(
  standing: BookingFeeStanding,
  dueCount: number,
): { line: string; badge: PlanRowBadge | null } | null {
  const due: PlanRowBadge | null = dueCount > 0 ? { tone: 'no', word: `${formatCount(dueCount)} to pay` } : null;
  switch (standing.kind) {
    case 'silent':
      return due ? { line: 'Bills waiting', badge: due } : null;
    case 'not_sourced':
      return { line: 'Only on couples Setnayan brings you · your own clients are free', badge: due };
    case 'unreadable':
      return { line: 'Couldn’t check your fee just now — nothing changed', badge: due };
    case 'launch_offer':
      return { line: 'Setnayan launch offer · your next booking’s fee is waived', badge: due ?? { tone: 'ok', word: 'Waived' } };
    case 'promo_window':
      return { line: `${bookingFeeScheduleSummary(standing.schedule)} · waived while a Setnayan promotion runs`, badge: due ?? { tone: 'ok', word: 'Waived' } };
    case 'free': {
      const used = Math.max(0, Math.min(FREE_BOOKING_LIMIT, standing.ordinal - 1));
      return {
        line: `${bookingFeeScheduleSummary(standing.schedule)} · your first ${formatCount(FREE_BOOKING_LIMIT)} are free`,
        badge: due ?? { tone: 'quiet', word: `${formatCount(used)} of ${formatCount(FREE_BOOKING_LIMIT)} used` },
      };
    }
    case 'billable':
      return {
        line: `${bookingFeeScheduleSummary(standing.schedule)} · locked until settled`,
        badge: due ?? { tone: 'quiet', word: `${formatCount(FREE_BOOKING_LIMIT)} of ${formatCount(FREE_BOOKING_LIMIT)} used` },
      };
  }
}

const RANK: Record<VendorTier, number> = { free: 1, verified: 2, solo: 3, pro: 4, enterprise: 5, custom: 6 };

/**
 * What picking a plan DOES, in one line — the live ladder (migration `the_plan_change_ladder`): a higher plan is live
 * the day it is paid; a lower one starts when the current term ends; Free is simply not paying the next one (nothing
 * renews by itself). `expiresOn` is the day words for `tier_expires_at`, or null.
 */
export function planPickLine(currentRaw: string | null | undefined, picked: string, expiresOn: string | null): string {
  const current = asVendorTier(currentRaw);
  const next = asVendorTier(picked);
  if (next === 'free' || next === 'verified') {
    if (RANK[current] <= RANK.verified) return 'You are on Free — nothing to pay';
    return expiresOn
      ? `Nothing renews by itself · ${planWord(current)} ends ${expiresOn}, then Free`
      : 'Nothing renews by itself · skip the next payment and you are on Free';
  }
  if (next === current) return expiresOn ? `Adds a new term after ${expiresOn}` : 'Starts once your payment is confirmed';
  if (RANK[next] > RANK[current]) return 'Starts the day your payment is confirmed · what is left of your plan comes off';
  return expiresOn ? `Starts when ${planWord(current)} ends · ${expiresOn}` : 'Starts when your current plan ends';
}
