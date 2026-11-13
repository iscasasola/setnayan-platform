/**
 * booking-cost-write.ts — WHICH columns one save of a booking's costing writes.
 *
 * Pulled out of `updateVendorCosts` (app/dashboard/[eventId]/vendors/actions.ts) so the rule can be tested by
 * calling it, not by reading source.
 *
 * 🔒 A FIELD YOU CANNOT SEE IS A FIELD YOU DO NOT WRITE (#5936, controller audit on PR #7560).
 * Since `event_vendor_money_read`, a Suppliers=Edit delegate whose Budget & payments area is Off reads every booking
 * amount as HIDDEN (`money_shown: false`, every amount null). The Details sheet then pre-fills Price as '' and posts
 * it back with `price_only` — and the old payload wrote `total_cost_php = NULL`. A delegate fixes a phone number,
 * taps Save, and the couple's ₱120,000 is gone. Worse, the hidden total read as 0, so `totalChanged` fired and the
 * pax surcharge re-baselined from nothing.
 *
 * So when the amounts are hidden, NONE of the five booking amounts is written (whatever the form posted), and the
 * total is never compared — a hidden total is not a measured total. The non-money crew fields still save.
 */
import { BOOKING_MONEY_COLUMNS } from '@/lib/event-vendor-money';

export type BookingCostWriteInput = {
  /** The caller manages only the price (bench control, Add-manually and Details sheets). */
  priceOnly: boolean;
  /** An accepted marketplace quote already settles the price — the price columns are not this form's to write. */
  quoteSettlesPrice: boolean;
  /**
   * What this caller read of the booking's amounts through `event_vendor_money_read`; null when the row itself
   * did not read (behaviour unchanged from before #5936).
   */
  existing: { total_cost_php: number | null; money_shown: boolean } | null;
  newTotal: number | null;
  transport: number | null;
  foodAllowance: number | null;
  crewSize: number | null;
  crewMealCovered: boolean;
};

export type BookingCostWrite = {
  payload: Record<string, unknown>;
  /** The base total actually changed — the caller re-baselines the pax surcharge (it adds those columns). */
  totalChanged: boolean;
};

export function bookingCostWrite(i: BookingCostWriteInput): BookingCostWrite {
  const moneyHidden = i.existing != null && i.existing.money_shown === false;

  const payload: Record<string, unknown> = i.priceOnly
    ? i.quoteSettlesPrice
      ? {}
      : { total_cost_php: i.newTotal }
    : i.quoteSettlesPrice
    ? { crew_size: i.crewSize, crew_meal_covered: i.crewMealCovered }
    : {
        total_cost_php: i.newTotal,
        transport_php: i.transport,
        food_allowance_php: i.crewMealCovered ? null : i.foodAllowance,
        crew_size: i.crewSize,
        crew_meal_covered: i.crewMealCovered,
      };

  if (moneyHidden) {
    for (const col of BOOKING_MONEY_COLUMNS) delete payload[col];
    return { payload, totalChanged: false };
  }

  const totalChanged =
    !i.quoteSettlesPrice &&
    i.existing != null &&
    Number(i.existing.total_cost_php ?? 0) !== Number(i.newTotal ?? 0);

  return { payload, totalChanged };
}
