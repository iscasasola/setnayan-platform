/**
 * SUPPLIERS TO REVIEW — the pure roll-up behind /admin/booking-fees.
 *
 * ⚖ OWNER, 2026-10-07: *"flag suppliers with several booked-but-unsettled
 * events"*. ⚖ 2026-10-12 #12: a count of EVENTS, admin-set, default 2, REVIEW
 * ONLY (`platform_settings.fee_review_unsettled_events_min`). Audit H2 / item 14.
 *
 * One supplier's event counts when the COUPLE'S side says it is booked — a
 * booked status, or a payment recorded against it — and no SETTLED booking fee
 * exists for that booking. That is the shape of a booking made off the
 * handshake: the couple acts as if booked, Setnayan was never paid or waived.
 *
 * 🔑 IT DECIDES NOTHING. It lists. No penalty, no charge, no message to anyone.
 * PURE — no database — so every rule is executed by a test.
 */
import { FEE_SETTLED_STATUSES } from '@/lib/event-access-stage';

/** Statuses on `event_vendors` that mean "booked" from the couple's side. */
export const COUPLE_SIDE_BOOKED_STATUSES: ReadonlySet<string> = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

export type ReviewBookingRow = {
  eventVendorId: string;
  eventId: string | null;
  vendorProfileId: string;
  status: string;
};
export type ReviewPaymentRow = { eventVendorId: string; amountPhp: number };
export type ReviewChargeRow = { eventVendorId: string | null; status: string; amountCentavos: number };

export type SupplierToReview = {
  vendorProfileId: string;
  /** Distinct events booked on the couple's side with no settled fee. */
  events: number;
  /** Payments the couple recorded on those bookings, in pesos. */
  paymentsPhp: number;
  /** Booking fees billed and not yet paid on those bookings, in centavos. */
  owedCentavos: number;
};

export function suppliersToReview(args: {
  bookings: readonly ReviewBookingRow[];
  payments: readonly ReviewPaymentRow[];
  charges: readonly ReviewChargeRow[];
  minEvents: number;
}): SupplierToReview[] {
  // No usable count ⇒ list nobody. The count is the owner's setting; a guessed
  // fallback here would be a number nobody set (the page says it could not read it).
  if (!(Number.isFinite(args.minEvents) && args.minEvents >= 1)) return [];
  const min = Math.floor(args.minEvents);

  const paidByBooking = new Map<string, number>();
  for (const p of args.payments) {
    const n = Number(p.amountPhp);
    if (!Number.isFinite(n) || n <= 0) continue;
    paidByBooking.set(p.eventVendorId, (paidByBooking.get(p.eventVendorId) ?? 0) + n);
  }
  const settled = new Set<string>();
  const owedByBooking = new Map<string, number>();
  for (const c of args.charges) {
    if (!c.eventVendorId) continue;
    if (FEE_SETTLED_STATUSES.has(c.status)) settled.add(c.eventVendorId);
    if (c.status === 'pending') {
      owedByBooking.set(c.eventVendorId, (owedByBooking.get(c.eventVendorId) ?? 0) + Math.max(0, c.amountCentavos));
    }
  }

  const bySupplier = new Map<string, { events: Set<string>; paymentsPhp: number; owedCentavos: number }>();
  for (const b of args.bookings) {
    if (!b.eventId) continue;
    const bookedSide = COUPLE_SIDE_BOOKED_STATUSES.has(b.status) || paidByBooking.has(b.eventVendorId);
    if (!bookedSide || settled.has(b.eventVendorId)) continue;
    const s = bySupplier.get(b.vendorProfileId) ?? { events: new Set<string>(), paymentsPhp: 0, owedCentavos: 0 };
    s.events.add(b.eventId);
    s.paymentsPhp += paidByBooking.get(b.eventVendorId) ?? 0;
    s.owedCentavos += owedByBooking.get(b.eventVendorId) ?? 0;
    bySupplier.set(b.vendorProfileId, s);
  }

  return [...bySupplier.entries()]
    .filter(([, s]) => s.events.size >= min)
    .map(([vendorProfileId, s]) => ({
      vendorProfileId,
      events: s.events.size,
      paymentsPhp: Math.round(s.paymentsPhp * 100) / 100,
      owedCentavos: s.owedCentavos,
    }))
    .sort((a, b) => b.events - a.events || b.paymentsPhp - a.paymentsPhp);
}
