import { formatCount } from './format-number';
import { DAILY_CAPACITY_MAX } from './vendor-tier-caps';

/**
 * A SERVICE CARD'S BOOKINGS PER DATE — THE SHOP'S OWN NUMBER, ON EVERY PLAN (owner 2026-11-18, DECISION_LOG "SUPPLIER
 * PLANS REBUILT", ruling 17, verbatim: *"a cake business can handle 30 cakes in a day. So they need to purchase
 * unlimited from us. I think that is wrong pricing."*). Bookings per date stopped being a plan allowance — it reverses
 * the 2026-11-06 "BOOKINGS PER DATE PER SERVICE IS A PLAN ALLOWANCE" row and returns to 23 Oct "plans price reach,
 * never income": every booking pays the booking fee.
 *
 * The card editor's number (`vendor_services.daily_capacity`, "How many events a day can this service take?") is the
 * shop's to set, up to {@link DAILY_CAPACITY_MAX} (500 since ruling 18: *"Yes, 500"*). The DATABASE honours that number
 * (`service_card_daily_limit`, with no plan cap over it since migration `supplier_plans_rebuilt`). Pure.
 */

/** The words the editor shows beside the field. */
export function bookingsPerDateHelp(): string {
  return `You set how many bookings a day this service takes, up to ${formatCount(DAILY_CAPACITY_MAX)}. Every plan.`;
}

/**
 * Null when the number may be saved; otherwise the sentence the editor shows. Blank (null) always saves. A card that
 * already holds a number above the ceiling (set before it existed) may be re-saved with that SAME number.
 */
export function bookingsPerDateRefusal(input: { requested: number | null; stored: number | null }): string | null {
  const { requested, stored } = input;
  if (requested === null || requested <= DAILY_CAPACITY_MAX) return null;
  if (stored !== null && requested === stored) return null;
  return `A service takes up to ${formatCount(DAILY_CAPACITY_MAX)} bookings a day.`;
}
