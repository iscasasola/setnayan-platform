/**
 * lib/plan-sheet.ts — THE PLAN SHEET, THE PURE HALF (Build 5 · Lane B; owner 10 Nov 2026: *"increasing allows them but we
 * ask if they want to upgrade to X Plan to allow this feature up to 5... see other features that will unlock"* · *"this
 * can also show a better way to expand and show their current plan and what happens if the pick this plan. and what to
 * pay."*; DECISION_LOG 2026-11-09 "GOING PAST A PLAN LIMIT ASKS TO UPGRADE…"; approved prototype
 * `settings_full_screen_2026-11-10/settings-full-screen.html`, Plans section).
 *
 * ONE component, two doors — both read this file:
 *   DOOR 1 · a limit   pressing + past a plan limit lets the number go up, then asks: "Upgrade to <the lowest plan that
 *                      allows it> to take up to <its limit> <thing>" + what else that plan unlocks + Upgrade / Keep <old>.
 *                      → `limitAsk`.
 *   DOOR 2 · Plan      the plan rows that open in place: Your plan → tap another → What changes (each limit now → after,
 *                      what else changes) and What you pay (today, then each cycle). → `planChanges`, `payToday`.
 *
 * READ, NEVER TYPED:
 *   · every limit is `TIER_CAPS` (`lib/vendor-tier-caps.ts`, twin `vendor_tier_limit`); a counted one (team seats) goes
 *     through the SAME flag-aware `allowance` the Plan's "gives you" fold uses, so the sheet never promises a seat the
 *     actions refuse;
 *   · "the lowest plan that allows it" walks the same table up the ladder (`VENDOR_TIERS`);
 *   · "what else changes" is `planGivesLines` for both plans — the lines the shop already reads on its Plan;
 *   · the amount today mirrors `create_vendor_subscription` (migration `the_plan_change_ladder`): kind by PLAN, never by
 *     price (`new` · `upgrade` · `renewal` · `downgrade`); the unused value of the plan being replaced is credited only on
 *     an `upgrade`; money already on the account comes off any charge; never below ₱0. The unused value is the server's
 *     own `vendor_unused_plan_value_php` — when it could not be read, there is NO number (`amount: null`), never a guess.
 *   · prices arrive from the catalogue; nothing here holds a peso.
 *   · words: `planWord` (Free · Free · Verified · Solo · Pro · Ultra) — no "tier", "proration" or "cycle".
 *
 * PURE: no I/O, no clock of its own, no env. 🔒 lib/plan-sheet.test.ts
 */
import { formatCount } from './format-number';
import { TIER_CAPS, VENDOR_TIERS, asVendorTier, type TierCaps, type VendorTier } from './vendor-tier-caps';
import { planWord } from './vendor-plan-change-words';
import { allowance, planGivesLines, type PlanLine } from './vendor-plan-rows';

/** The limits a shop can press + past — each read from the plan table (Lane B "Door 1" list). */
export const PLAN_LIMITS = [
  { key: 'bookingsPerDate', title: 'Bookings a day per card', thing: 'bookings a day on a card' },
  { key: 'cardsPerCategory', title: 'Cards per category', thing: 'cards in a category' },
  { key: 'mainCategories', title: 'Main categories', thing: 'main categories' },
  { key: 'teamSeats', title: 'Team seats', thing: 'team seats' },
  { key: 'branches', title: 'Branches', thing: 'branches' },
  { key: 'reach', title: 'Reach', thing: 'km of reach' },
] as const;
export type PlanLimitKey = (typeof PLAN_LIMITS)[number]['key'];

/** The plan's own number for a limit. `paywallOn` is `isVendorFeatureGateEnabled()` — the caller asks; this reads no env. */
export function limitOf(tierRaw: string | null | undefined, key: PlanLimitKey, paywallOn: boolean): number {
  const c: TierCaps = TIER_CAPS[asVendorTier(tierRaw)];
  switch (key) {
    case 'bookingsPerDate':
      return c.bookingsPerDatePerService;
    case 'cardsPerCategory':
      return c.servicesPerLeaf;
    case 'mainCategories':
      return c.parentCategories;
    case 'teamSeats':
      return allowance(c.agentAccounts, 'agentAccounts', paywallOn);
    case 'branches':
      return c.branchesIncluded;
    case 'reach':
      return c.serviceRadiusKm;
  }
}

/** A limit's value in words: "3" · "No limit" · reach "30 km" · "Nationwide" · "Not in search". */
export function limitWords(key: PlanLimitKey, v: number): string {
  if (key === 'reach') {
    if (!Number.isFinite(v)) return 'Nationwide';
    return v > 0 ? `${formatCount(v)} km` : 'Not in search';
  }
  return Number.isFinite(v) ? formatCount(v) : 'No limit';
}

const RANK: Record<VendorTier, number> = Object.fromEntries(VENDOR_TIERS.map((t, i) => [t, i])) as Record<VendorTier, number>;

/** The plans the sheet lists, the shop's own first. Free shows only while it is the shop's plan (a Verified shop cannot
 *  pick being unverified); Free · Verified always shows — it is where a paid plan steps down to. */
export function sheetPlans(currentRaw: string | null | undefined): VendorTier[] {
  const current = asVendorTier(currentRaw);
  const rest = VENDOR_TIERS.filter((t) => t !== current && t !== 'free');
  return [current, ...rest];
}

export type PlanDirection = 'same' | 'up' | 'down';

export function planDirection(fromRaw: string | null | undefined, toRaw: string | null | undefined): PlanDirection {
  const a = RANK[asVendorTier(fromRaw)];
  const b = RANK[asVendorTier(toRaw)];
  return a === b ? 'same' : b > a ? 'up' : 'down';
}

export type LimitChange = { key: PlanLimitKey; title: string; now: string; after: string; changed: boolean };

export type PlanChanges = {
  direction: PlanDirection;
  /** Every limit, now → after (the prototype's "What changes" rows). */
  limits: LimitChange[];
  /** What else changes — the Plan's own "gives you" lines that differ, worded for the plan picked. */
  also: PlanLine[];
};

// "gives you" lines already shown as a limit row above — not repeated under "Also".
const COVERED_BY_LIMITS = new Set(['services', 'helpers', 'reach', 'branches']);

/** What moving from one plan to another changes — every number read from the plan table. */
export function planChanges(fromRaw: string | null | undefined, toRaw: string | null | undefined, paywallOn: boolean): PlanChanges {
  const from = asVendorTier(fromRaw);
  const to = asVendorTier(toRaw);
  const limits = PLAN_LIMITS.map((l) => {
    const a = limitOf(from, l.key, paywallOn);
    const b = limitOf(to, l.key, paywallOn);
    return { key: l.key, title: l.title, now: limitWords(l.key, a), after: limitWords(l.key, b), changed: a !== b };
  });
  const before = new Map(planGivesLines(from, paywallOn).map((g) => [g.key, g.line]));
  const also = planGivesLines(to, paywallOn).filter((g) => !COVERED_BY_LIMITS.has(g.key) && before.get(g.key) !== g.line);
  return { direction: planDirection(from, to), limits, also };
}

/** The lowest plan ABOVE the shop's own that takes `wanted` of a limit — or null when no plan does. */
export function lowestPlanAllowing(
  currentRaw: string | null | undefined,
  key: PlanLimitKey,
  wanted: number,
  paywallOn: boolean,
): VendorTier | null {
  const current = asVendorTier(currentRaw);
  for (const t of VENDOR_TIERS) {
    if (RANK[t] <= RANK[current]) continue;
    if (limitOf(t, key, paywallOn) >= wanted) return t;
  }
  return null;
}

export type LimitAsk = {
  /** The plan to offer; null = no plan takes that many (the sheet says so, with no Upgrade). */
  plan: VendorTier | null;
  /** "Upgrade to Pro to take up to 3 bookings a day on a card" · "Get verified to take up to 20 km of reach". */
  headline: string;
  /** The other limits that plan raises, "Main categories 2 → 8" — the "see other features that will unlock" part. */
  alsoUnlocks: string[];
  /** "Keep 1" — the setting saves at the current limit until the plan is paid (apply-then-pay; nothing given free). */
  keep: string;
  /** The value that is saved until then. */
  savedAt: number;
};

/**
 * DOOR 1 — the ask when + goes past the plan's limit. Null when `wanted` is within the limit (no sheet). The setting
 * saves at the current limit (`savedAt`); the shop is never handed the higher number for free.
 */
export function limitAsk(
  currentRaw: string | null | undefined,
  key: PlanLimitKey,
  wanted: number,
  paywallOn: boolean,
): LimitAsk | null {
  const current = asVendorTier(currentRaw);
  const cap = limitOf(current, key, paywallOn);
  if (!(wanted > cap)) return null;
  const meta = PLAN_LIMITS.find((l) => l.key === key)!;
  const plan = lowestPlanAllowing(current, key, wanted, paywallOn);
  const keep = `Keep ${limitWords(key, cap)}`;
  if (!plan) {
    return { plan: null, headline: `No plan takes more than ${limitWords(key, cap)} ${meta.thing} today`, alsoUnlocks: [], keep, savedAt: cap };
  }
  const upTo = limitWords(key, limitOf(plan, key, paywallOn));
  const verb = plan === 'verified' ? 'Get verified' : `Upgrade to ${planWord(plan)}`;
  const headline =
    key === 'reach'
      ? `${verb} to reach ${upTo === 'Nationwide' ? 'nationwide' : upTo}`
      : `${verb} to take up to ${upTo} ${meta.thing}`;
  const ch = planChanges(current, plan, paywallOn);
  const alsoUnlocks = [
    ...ch.limits.filter((l) => l.changed && l.key !== key).map((l) => `${l.title} ${l.now} → ${l.after}`),
    ...ch.also.map((g) => `${g.title}: ${g.line}`),
  ];
  return { plan, headline, alsoUnlocks, keep, savedAt: cap };
}

/** The server's own name for a purchase (`vendor_plan_change_kind`) — by PLAN, never by price. */
export type ChangeKind = 'new' | 'upgrade' | 'renewal' | 'downgrade';

export function changeKind(
  currentRaw: string | null | undefined,
  tierExpiresAt: string | null,
  pickedRaw: string | null | undefined,
  nowMs: number,
): ChangeKind {
  const end = tierExpiresAt ? new Date(tierExpiresAt).getTime() : NaN;
  if (!Number.isFinite(end) || end <= nowMs) return 'new';
  const d = planDirection(currentRaw, pickedRaw);
  return d === 'up' ? 'upgrade' : d === 'down' ? 'downgrade' : 'renewal';
}

export type PayToday = {
  /** Pesos due today — null when the unused value of the current plan could not be read (said, never guessed). */
  amount: number | null;
  /** One line under "Today". */
  line: string;
};

/**
 * WHAT YOU PAY TODAY — the same arithmetic as `create_vendor_subscription`: price − min(price, credited), where credited
 * is the unused value of the plan being replaced (an `upgrade` only) plus money already on the account.
 */
export function payToday(input: {
  kind: ChangeKind;
  price: number;
  /** `vendor_unused_plan_value_php` for this shop; null = the read failed. Only an upgrade uses it. */
  unusedPhp: number | null;
  /** `vendor_profiles.subscription_credit_php`. */
  creditPhp: number;
  currentRaw: string | null | undefined;
  /** "8 Dec 2026" — when the current paid plan ends. */
  endsOn: string | null;
}): PayToday {
  const credit = Number.isFinite(input.creditPhp) && input.creditPhp > 0 ? input.creditPhp : 0;
  const was = planWord(input.currentRaw);
  if (input.kind === 'upgrade') {
    if (input.unusedPhp === null) {
      return { amount: null, line: `Less what is left of ${was} — the exact amount shows on your order` };
    }
    const off = Math.min(input.price, Math.max(0, input.unusedPhp) + credit);
    return { amount: input.price - off, line: off > 0 ? `Starts today · less what is left of ${was}` : 'Starts today' };
  }
  const amount = input.price - Math.min(input.price, credit);
  const lessCredit = credit > 0 ? ' · less the money on your account' : '';
  if (input.kind === 'downgrade') {
    return { amount, line: `Starts when ${was} ends${input.endsOn ? ` on ${input.endsOn}` : ''}${lessCredit}` };
  }
  if (input.kind === 'renewal') {
    return { amount, line: `Adds a new term${input.endsOn ? ` after ${input.endsOn}` : ''}${lessCredit}` };
  }
  return { amount, line: `Starts the day your payment is confirmed${lessCredit}` };
}

/**
 * A plan row's one line while it is shut. Another plan: "Up to 3 a day per card · 100 km · 5 team seats" (the
 * prototype's row line), read from the table; a lower plan while a paid one runs: "Lower plan · starts after 8 Dec 2026".
 */
export function planRowLine(
  currentRaw: string | null | undefined,
  toRaw: string | null | undefined,
  paywallOn: boolean,
  expiresOn: string | null,
): string {
  const to = asVendorTier(toRaw);
  if (planDirection(currentRaw, to) === 'down' && expiresOn) return `Lower plan · starts after ${expiresOn}`;
  const a = limitOf(to, 'bookingsPerDate', paywallOn);
  const reach = limitWords('reach', limitOf(to, 'reach', paywallOn));
  const seats = limitOf(to, 'teamSeats', paywallOn);
  const seatWords = Number.isFinite(seats) ? `${formatCount(seats)} team ${seats === 1 ? 'seat' : 'seats'}` : 'team seats with no limit';
  const reachWords = reach === 'Not in search' ? 'not in search' : reach === 'Nationwide' ? 'nationwide' : reach;
  return `Up to ${limitWords('bookingsPerDate', a)} a day per card · ${reachWords} · ${seatWords}`;
}
