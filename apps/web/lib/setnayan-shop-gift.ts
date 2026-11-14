/**
 * 🎁 SETNAYAN GIFTS TO A SHOP — the words and the small rules. Pure (no I/O, no clock), so every sentence is tested.
 *
 * ⚖ Owner rulings, 14 Nov 2026 (DECISION_LOG): "SETNAYAN CAN GIFT A SUPPLIER TWO KINDS OF THING — GIFTS TO GIVE AWAY,
 * OR SUPPLIER PLAN TIME" · "A GIFTED SUPPLIER PLAN: THE SHOP CHOOSES — WAIT FOR ITS CURRENT PLAN TO END, OR UPGRADE NOW"
 * · "A GIFTED SUPPLIER PLAN IS A STRATEGIC TASTE OF THE HIGHER TIER" · "FINAL — A GIFTED SUPPLIER PLAN LASTS 28 DAYS" ·
 * "A SHOP ALREADY ON SUPPLIER ULTRA CAN BE GIFTED PLAN TIME — IT ADDS 28 DAYS" · "PRESSING REDEEM IS THE CLAIM" ·
 * "GIFT DESIGN APPROVED". The copy is the approved drawing's (artifact QSMD9BaefarMRNQAnMFiND, frames 4 · 5, Claiming,
 * "Today, after Later", "During the gift", "Before it ends").
 *
 * 🔑 WHAT A SHOP MAY PRESS is decided by the DATABASE (`setnayan_shop_gift_choices`), from its plan at that moment —
 * never re-derived here. This file only words each choice. The claim itself is `setnayan_shop_gift_claim`: the press
 * IS the claim, exactly once (migration 20271345573127; tests/db/a-setnayan-gift-is-claimed-once.db.test.ts).
 *
 * 🔑 NO PRICE LIVES HERE. "Stay on <plan>" shows the 28-day price READ from `vendor_billing_catalog`
 * (`readPersonalInvitePlanPrices`), passed in; with no price read the button says no price rather than a typed one.
 */
import { formatCount } from './format-number';
import { formatPhp } from './php';
import { planWord } from './vendor-plan-change-words';

/** What a shop can press on a Setnayan gift (the database's `setnayan_shop_gift_choices`). */
export type ShopGiftChoice = 'stock' | 'start' | 'now' | 'after' | 'extend';
export const SHOP_GIFT_CHOICES: readonly ShopGiftChoice[] = ['stock', 'start', 'now', 'after', 'extend'];

/** The gift stock Setnayan can send (the shop-gift kinds a badge reward can land as — `shop_badge_reward_grant`). */
export type ShopGiftStockKind = 'papic' | 'event_plus' | 'event_pro';

/** The plans Setnayan can send time on. */
export type ShopGiftPlanTier = 'solo' | 'pro' | 'enterprise';
export const SHOP_GIFT_PLAN_TIERS: readonly ShopGiftPlanTier[] = ['solo', 'pro', 'enterprise'];

/** One 28-day block (owner: "28 days"). The database's `plan_days` default is the same ruling. */
export const SHOP_PLAN_GIFT_DAYS = 28;
/** The "ends in N days" notice shows in the gift's last week (owner ruling, "the last 7 days"). */
export const SHOP_PLAN_GIFT_ENDS_SOON_DAYS = 7;
/** Most units of one stock gift (the badge-reward door's own limit, `shop_badge_rewards_units_range`). */
export const SHOP_GIFT_MAX_UNITS = 10;

const DAY_MS = 86_400_000;

/** "Ultra" · "Pro" · "Plus" · "Free" — the short plan word the drawing uses on Today ("Ultra · gift · …"). */
export function shortPlanWord(tier: string | null | undefined): string {
  return planWord(tier).replace(/^Supplier /, '').replace(/ · Verified$/, '');
}

/** The seal's words — the same two lines on every Setnayan gift to a shop (frames 4 · 5). */
export const SHOP_GIFT_SEAL = { kicker: 'A gift for your shop', from: 'A gift from Setnayan', tap: 'Tap to open' } as const;

/** The waiting line on Today after Later ("Today, after Later"): no Got it — only claiming closes it. */
export const SHOP_GIFT_WAITING = { line: '🎁 A gift from Setnayan is waiting', open: 'Open' } as const;

/** The claim's three states (drawing, "Claiming the gift"). */
export const SHOP_GIFT_CLAIM_WORDS = {
  claiming: 'Claiming…',
  offline: 'The claim didn’t reach us. Try again sends the same claim, so it can never become a second gift.',
  tryAgain: 'Try again',
  claimed: 'Claimed',
  later: 'Later',
  close: 'Close',
} as const;

/** A gift as the moment draws it. */
export type ShopGiftView = {
  giftId: string;
  type: 'stock' | 'plan';
  /** Stock: "3 × Papic 1000" (the pack title READ from the catalogue). */
  stockLine?: string;
  /** Plan: the gifted tier. */
  planTier?: ShopGiftPlanTier;
  planDays?: number;
  /** The shop's plan now (for "You're on Supplier Pro now"), or null with no plan. */
  currentTier: string | null;
  /** What the database lets the shop press now. Empty = the gift waits (another gift is running). */
  choices: readonly ShopGiftChoice[];
  claimed: boolean;
};

export type ShopGiftButton = { choice: ShopGiftChoice; label: string; main: boolean };

/** The opened gift's words and buttons (frames 4 · 5 and the same-plan ruling). */
export function shopGiftMomentWords(g: ShopGiftView): {
  title: string;
  what: string;
  lines: string[];
  buttons: ShopGiftButton[];
} {
  if (g.type === 'stock') {
    return {
      title: 'Setnayan sent you gifts',
      what: `${g.stockLine ?? 'Gifts'} to give your couples`,
      lines: ['They join your gifts, ready to put on a quote', 'Shop › Promote › Your gifts'],
      buttons: g.choices.includes('stock') ? [{ choice: 'stock', label: 'Add to my gifts', main: true }] : [],
    };
  }
  const gifted = planWord(g.planTier);
  const days = formatCount(g.planDays ?? SHOP_PLAN_GIFT_DAYS);
  if (g.choices.includes('extend')) {
    return {
      title: `${days} more days of ${gifted}`,
      what: `Setnayan added ${days} days to your ${gifted}`,
      lines: ['Your next renewal moves later by the same days'],
      buttons: [{ choice: 'extend', label: 'Add them to my plan', main: true }],
    };
  }
  const title = `Setnayan sent you ${gifted}`;
  const what = `${gifted} on your own shop, for ${days} days`;
  if (g.choices.includes('start')) {
    return {
      title,
      what,
      lines: ['Starts when you press Start it', 'Your plan comes back afterwards'],
      buttons: [{ choice: 'start', label: 'Start it', main: true }],
    };
  }
  const current = g.currentTier ? planWord(g.currentTier) : null;
  const buttons: ShopGiftButton[] = [];
  if (g.choices.includes('now')) buttons.push({ choice: 'now', label: 'Upgrade now', main: true });
  if (g.choices.includes('after')) {
    buttons.push({ choice: 'after', label: 'Start it when my plan ends', main: buttons.length === 0 });
  }
  if (buttons.length === 0) {
    return { title, what, lines: ['It opens when the gift you are on now ends'], buttons };
  }
  return {
    title,
    what,
    lines: current
      ? [
          `Try everything ${shortPlanWord(g.planTier)} opens, on top of your ${shortPlanWord(g.currentTier)}`,
          g.choices.includes('now')
            ? `You’re on ${current} now. Upgrade today, or have it start when ${current} ends.`
            : `You’re on ${current} now. It starts when ${current} ends.`,
        ]
      : [],
    buttons,
  };
}

/** A plan gift while it runs. */
export type RunningPlanGift = {
  giftId: string;
  tier: ShopGiftPlanTier;
  startsAt: string;
  endsAt: string;
  /** The plan the gift paused (handed back when it ends), or null — the shop goes back to Free. */
  returnTier: string | null;
  /** 'extend' — days added to the shop's own plan: there is nothing to go back to. */
  extend: boolean;
};

/** Whole days left, counting today (1 on the last day); 0 once it is over. */
export function planGiftDaysLeft(g: Pick<RunningPlanGift, 'endsAt'>, nowMs: number): number {
  const end = Date.parse(g.endsAt);
  if (!Number.isFinite(end) || end <= nowMs) return 0;
  return Math.max(1, Math.ceil((end - nowMs) / DAY_MS));
}

/**
 * 🔔 WHEN A PLAN GIFT SAYS "ENDS SOON" (owner 14 Nov 2026, DECISION_LOG "A GIFTED SUPPLIER PLAN SAYS 'ENDS SOON' 7
 * DAYS BEFORE AND AGAIN 1 DAY BEFORE"): the 7-day stage from a week out, the 1-day stage on its last day. Null before
 * the week, before the gift has started, and once it is over. No daily countdown in between.
 */
export const PLAN_GIFT_NOTICE_STAGES = [7, 1] as const;
export type PlanGiftNoticeStage = (typeof PLAN_GIFT_NOTICE_STAGES)[number];

export function planGiftNoticeStage(g: Pick<RunningPlanGift, 'startsAt' | 'endsAt'>, nowMs: number): PlanGiftNoticeStage | null {
  if (Date.parse(g.startsAt) > nowMs) return null;
  const left = planGiftDaysLeft(g, nowMs);
  if (left === 0) return null;
  if (left <= 1) return 1;
  return left <= SHOP_PLAN_GIFT_ENDS_SOON_DAYS ? 7 : null;
}

/** "Saturday 21 November" — the day it ends, in words, in Manila. */
export function planGiftEndDayWords(endsAt: string): string {
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Manila' });
}

/**
 * The "ends soon" words — the SAME for the in-app notice and the email: the end date in words, what happens if the shop
 * does nothing (it goes back to its own plan, nothing lost), and ONE button, "Stay on <plan>". `stayPricePhp` is the
 * plan's 28-day price READ from the catalogue; null → the words name no price, never a typed one.
 */
export function planGiftEndingWords(
  g: Pick<RunningPlanGift, 'tier' | 'returnTier' | 'extend' | 'endsAt'>,
  stayPricePhp: number | null,
): { title: string; body: string; stay: string } {
  const plan = planWord(g.tier);
  const day = planGiftEndDayWords(g.endsAt);
  const price = stayPricePhp != null && Number.isFinite(stayPricePhp) ? ` for ${formatPhp(stayPricePhp)} every ${SHOP_PLAN_GIFT_DAYS} days` : '';
  const after = g.extend
    ? `your ${plan} ends then, as it would have`
    : `your shop goes back to ${planWord(g.returnTier ?? 'free')} that day, with nothing lost`;
  return {
    title: `Your ${plan} gift ends ${day}`,
    body: `Stay on ${plan}${price}, or do nothing and ${after}.`,
    stay: `Stay on ${plan}`,
  };
}

/** The one plain line on the day a plan gift ends (no line for days added to the shop's own plan — nothing changes). */
export function planGiftEndedLine(g: { tier: string; returnTier: string | null }): string {
  return `Your ${planWord(g.tier)} gift has ended. Your shop is back on ${planWord(g.returnTier ?? 'free')}.`;
}

/** What a finished press says, for the toast under the moment. */
export function claimedWords(choice: ShopGiftChoice, tier: string | null | undefined): string {
  switch (choice) {
    case 'stock':
      return 'Added to your gifts.';
    case 'extend':
      return `${SHOP_PLAN_GIFT_DAYS} days added to your ${planWord(tier)}.`;
    case 'after':
      return `${planWord(tier)} starts when your plan ends.`;
    default:
      return `You’re on ${planWord(tier)} now.`;
  }
}

/** Admin: the gift as one line ("3 × Papic 1000" · "28 days of Supplier Ultra"). */
export function adminGiftLine(g: { type: 'stock' | 'plan'; stockLine?: string; planTier?: string | null; planDays?: number }): string {
  return g.type === 'stock'
    ? (g.stockLine ?? 'Gift stock')
    : `${formatCount(g.planDays ?? SHOP_PLAN_GIFT_DAYS)} days of ${planWord(g.planTier)}`;
}
