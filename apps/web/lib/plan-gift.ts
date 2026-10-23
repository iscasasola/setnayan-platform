/**
 * lib/plan-gift.ts — A PLAN SETNAYAN GAVE, in the supplier's words. Pure.
 *
 * Prototype `supplier_personal_invite_2026-10-23.html` (owner-approved) frames B6 · C1 · C2 · C3: a shop on a plan
 * Setnayan gave (a personal invite's offer, or any admin comp — `tier_source = 'admin_comp'`, which `setVendorTier`
 * and `claim_ready_the_invited_shop` stamp and nothing self-serve does) reads it as a gift, with its end day:
 *   · Today's Shop line   — "Pro · free until 31 Jan 2027 · from Setnayan" · in the last week "Pro · 7 days left on
 *                           the gift";
 *   · Today's door        — in the last week only: "Your free Pro ends 31 Jan" (`CREDIT_WARNING_WINDOW_DAYS`, the
 *                           same seven days the credit notice uses — time to act before a weekend);
 *   · Your plan           — "free until 31 Jan 2027 · a gift from Setnayan".
 * The mechanism is the shipped comp lapse (`tier_expires_at`); these are words, not machinery. In-app only — no email
 * (owner 2026-10-11).
 */
import { CREDIT_WARNING_WINDOW_DAYS } from './vendor-credit-warning';
import { planWord } from './vendor-plan-change-words';
import { formatCount } from './format-number';
import { dayAfterWords, manilaDayOf, offerDayWords } from './personal-invite-offer';

const PAID = new Set(['solo', 'pro', 'enterprise']);
const DAY_MS = 86_400_000;

export type PlanGift = {
  /** The plan's word ("Pro", "Ultra"). */
  plan: string;
  /** The last free day, Manila `YYYY-MM-DD`. */
  untilDay: string;
  /** Whole days left (1 on the last day). */
  daysLeft: number;
};

/** The gift a shop is on right now, or null (not a comp, no end day, a free plan, or already over). */
export function planGiftOf(
  row: { tier_state?: string | null; tier_source?: string | null; tier_expires_at?: string | null } | null,
  nowMs: number,
): PlanGift | null {
  if (!row || row.tier_source !== 'admin_comp' || !row.tier_state || !PAID.has(row.tier_state) || !row.tier_expires_at) {
    return null;
  }
  const endMs = Date.parse(row.tier_expires_at);
  if (!Number.isFinite(endMs) || endMs <= nowMs) return null;
  const untilDay = manilaDayOf(row.tier_expires_at);
  if (!untilDay) return null;
  return { plan: planWord(row.tier_state), untilDay, daysLeft: Math.max(1, Math.ceil((endMs - nowMs) / DAY_MS)) };
}

/** In the last week — the door shows and the Shop line counts down. */
export function giftEndsSoon(g: PlanGift): boolean {
  return g.daysLeft <= CREDIT_WARNING_WINDOW_DAYS;
}

/** Today's Shop line for a gifted shop (frames B6 / C2). */
export function giftShopLine(g: PlanGift): string {
  return giftEndsSoon(g)
    ? `${g.plan} · ${formatCount(g.daysLeft)} ${g.daysLeft === 1 ? 'day' : 'days'} left on the gift`
    : `${g.plan} · free until ${offerDayWords(g.untilDay)} · from Setnayan`;
}

/** Today's door in the gift's last week (frame C2), or null before it. Tap opens Your plan. */
export function giftDoorWords(g: PlanGift): { title: string; body: string } | null {
  if (!giftEndsSoon(g)) return null;
  const day = offerDayWords(g.untilDay).replace(/ \d{4}$/, '');
  return {
    title: `Your free ${g.plan} ends ${day}`,
    body: `Keep ${g.plan}, or do nothing — Free from ${dayAfterWords(g.untilDay)}`,
  };
}

/** Your plan's answer line while the gift runs (frame C1): "free until 31 Jan 2027 · a gift from Setnayan". */
export function giftPlanLine(g: PlanGift): string {
  return `free until ${offerDayWords(g.untilDay)} · a gift from Setnayan`;
}

/** Your plan's answer line once a gift has ended (frame C3): "your Pro gift ended 31 Jan 2027". */
export function giftEndedLine(plan: string, untilDay: string): string {
  return `your ${plan} gift ended ${offerDayWords(untilDay)}`;
}

/**
 * Your plan's **Portfolio photos** row (frames C1 · C3). `held` = photos on the page, `cap` = `portfolioPhotoCap`,
 * `gifted` = the cap came from the shop's own allowance (a personal invite's 100). The 100 is the shop's to keep, so
 * the row says so while a plan gift runs, and keeps saying "your gift" after it ends. Past the cap nothing is taken
 * away — the row says the photos are kept and the next one waits for Papic credits (`PORTFOLIO_OVER_BASE_MESSAGE`).
 */
export function portfolioPlanRowLine(input: {
  held: number;
  cap: number;
  gifted: boolean;
  /** The running plan gift's last day (frame C1), or null. */
  giftUntilDay: string | null;
  /** A plan gift that has ended (frame C3). */
  giftEnded: boolean;
}): string {
  const { gifted, giftUntilDay, giftEnded } = input;
  const held = formatCount(input.held);
  const cap = formatCount(input.cap);
  if (giftEnded || input.held > input.cap) {
    return `${held} kept · ${cap} free${gifted ? ' (your gift)' : ''} · more with Papic credits soon`;
  }
  const until = giftUntilDay ? offerDayWords(giftUntilDay).replace(/ \d{4}$/, '') : null;
  if (gifted) return `${held} of ${cap} free · your gift${until ? `, it stays after ${until}` : ''}`;
  return `${held} of ${cap} free`;
}
