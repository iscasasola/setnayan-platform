/**
 * 💰 WHERE A COUPLE BUYS A PLAN (RW-13, owner 2026-11-13: *"We want events ultra to be purchasable now"*).
 *
 * A plan is bought INSIDE an event — the checkout drawer needs the event (`InlineCheckoutDrawer` `eventId`), and the
 * charge reads what that event already paid (`readUltraUpgradeCharge` asks only the difference from Plus or Pro). The
 * one in-event web door is the event's plan screen (`/dashboard/[eventId]/studio/website-pro`, Free · Plus · Pro ·
 * Ultra, each with its drawer). Every public door — /pricing, /pricing/plan, the front door — leads THERE, through
 * the "Add to an event" picker the service pages already use. Nothing here holds a price or a credit count.
 */
import { PLAN_PRICE_CODES } from './event-plans';

export type PlanKey = keyof typeof PLAN_PRICE_CODES;

export const PLAN_KEYS: readonly PlanKey[] = Object.keys(PLAN_PRICE_CODES) as PlanKey[];

/** The plan's own words on a door ("Event Ultra"). */
export const PLAN_NAME: Readonly<Record<PlanKey, string>> = { plus: 'Event Plus', pro: 'Event Pro', ultra: 'Event Ultra' };

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && (PLAN_KEYS as readonly string[]).includes(v);
}

/** The event's plan screen, opened at this plan's card (`?plan=` rings it; `#plan-<key>` scrolls to it). */
export function planScreenHref(eventId: string, plan: PlanKey): string {
  return `/dashboard/${eventId}/studio/website-pro?plan=${plan}#plan-${plan}`;
}

/**
 * A signed-out visitor's door: sign in, then back to /pricing, where the same row now opens the event picker. The
 * `next` is a plain same-site path (`isSafeNext`).
 */
export const PLAN_SIGN_IN_HREF = '/login?next=%2Fpricing';
