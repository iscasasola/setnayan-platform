/**
 * slot-seat-reservations.ts — table reservations held by Setnayan.
 * Owner 2026-08-01: asked whether to link out to the restaurant's own booking
 * or to hold the reservation ourselves, the owner chose to HOLD it.
 *
 * Supply is the SHIPPED `vendor_service_time_slots` (named windows with times).
 * This module adds only the demand side: a party of N, on a date of its own,
 * against a window whose `seat_capacity` is NOT NULL.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE RULE: THIS MODULE NEVER DECIDES WHETHER A SEAT IS AVAILABLE.
 * ─────────────────────────────────────────────────────────────────────────────
 * Availability is decided by a single conditional UPDATE inside the
 * `reserve_service_slot_seats` RPC, under a row lock on the exact (slot x date)
 * being contended, with `CHECK (seats_taken <= seats_capacity)` behind it. Any
 * "is there room?" check written HERE would be a read-then-write and would
 * oversell under concurrency. `readSlotDayAvailability` exists to DISPLAY
 * remaining seats; it is never a precondition for booking, and the reserve call
 * is expected to come back `full` sometimes even when the display said otherwise.
 * That is correct behaviour, not a bug to paper over.
 *
 * Pure helpers here are I/O-free and unit-tested; the two DB calls are thin
 * envelope-decoders over the RPCs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Mirrors the CHECK bounds in 20271029000675. */
export const PARTY_SIZE_MIN = 1;
export const PARTY_SIZE_MAX = 2000;
export const SEAT_CAPACITY_MAX = 2000;
export const GUEST_NOTE_MAX = 500;

/** Statuses that OCCUPY capacity. `cancelled` is the only one that does not. */
export const OCCUPYING_STATUSES = ['held', 'confirmed'] as const;

export type ReservationStatus = 'held' | 'confirmed' | 'cancelled';

export type SlotSeatReservation = {
  reservation_id: string;
  slot_id: string;
  vendor_profile_id: string;
  event_id: string;
  reserved_date: string;
  party_size: number;
  status: ReservationStatus;
  guest_note: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
};

export type SlotDayAvailability = {
  slotId: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  seatsCapacity: number;
  seatsTaken: number;
  seatsRemaining: number;
};

/** Every envelope status the reserve RPC can return. */
export type ReserveStatus =
  | 'ok'
  | 'full'
  | 'already_reserved'
  | 'not_reservable'
  | 'slot_not_found'
  | 'not_authorized'
  | 'date_in_past'
  | 'invalid_party_size'
  | 'invalid_input';

export type ReserveResult =
  | {
      status: 'ok';
      reservationId: string;
      seatsTaken: number;
      seatsRemaining: number;
    }
  | { status: Exclude<ReserveStatus, 'ok'>; seatsRemaining?: number };

export type CancelStatus = 'ok' | 'already_cancelled' | 'not_found';
export type ConfirmStatus = 'ok' | 'not_held' | 'not_found';

// ───────────────────────────── pure helpers ─────────────────────────────

/** A window is reservable iff the vendor gave it seats. NULL is not "0". */
export function isReservableSlot(seatCapacity: number | null | undefined): boolean {
  return typeof seatCapacity === 'number' && Number.isFinite(seatCapacity) && seatCapacity > 0;
}

/**
 * Client-side party-size validation. Advisory ONLY — the RPC re-validates and
 * the CHECK constraint is the real bound. Returns null when acceptable.
 */
export function validatePartySize(n: unknown): string | null {
  if (typeof n !== 'number' || !Number.isInteger(n)) return 'Enter the number of people.';
  if (n < PARTY_SIZE_MIN) return 'A table needs at least one person.';
  if (n > PARTY_SIZE_MAX) return `That is more than ${PARTY_SIZE_MAX} people.`;
  return null;
}

/**
 * Seats left for display. Clamped at 0: a date whose capacity the restaurant
 * later lowered can legitimately read as over-full, and showing "-3 seats left"
 * would be worse than showing "fully booked".
 */
export function seatsRemaining(seatsCapacity: number, seatsTaken: number): number {
  return Math.max(seatsCapacity - seatsTaken, 0);
}

/** "7PM Seating · 6 of 12 seats left" — the availability line. */
export function availabilityLabel(a: SlotDayAvailability): string {
  if (a.seatsRemaining <= 0) return 'Fully booked';
  return `${a.seatsRemaining} of ${a.seatsCapacity} seats left`;
}

/**
 * The message a couple sees for each non-ok reserve outcome. Kept beside the
 * status union so a newly added envelope status cannot silently fall through to
 * a generic error — the switch is exhaustive.
 */
export function reserveFailureMessage(status: Exclude<ReserveStatus, 'ok'>): string {
  switch (status) {
    case 'full':
      return 'That seating just filled up. Try another time or a smaller party.';
    case 'already_reserved':
      return 'You already hold a table at this seating. Change the party size instead of booking twice.';
    case 'not_reservable':
      return 'This vendor has not opened this time for table reservations.';
    case 'slot_not_found':
      return 'That seating is no longer available.';
    case 'not_authorized':
      return 'You do not have permission to book for this event.';
    case 'date_in_past':
      return 'Pick a date in the future.';
    case 'invalid_party_size':
      return 'Enter a valid number of people.';
    case 'invalid_input':
      return 'Something was missing from that request. Please try again.';
  }
}

// ───────────────────────────── DB calls ─────────────────────────────

/**
 * Remaining seats for one (slot x date), for DISPLAY.
 *
 * Returns null when the date has no ledger row yet — which means untouched, not
 * unavailable. The caller renders the slot's full seat_capacity in that case.
 *
 * ⚠ An empty read and a DENIED read are indistinguishable here (`count: 0`, no
 * error), so this deliberately reports "unknown" (null) rather than "full". A
 * UI that rendered a denied read as "fully booked" would lie; one that renders
 * it as "unknown" degrades to letting the RPC be the judge, which it is anyway.
 */
export async function readSlotDayAvailability(
  supabase: SupabaseClient,
  slotId: string,
  date: string,
): Promise<SlotDayAvailability | null> {
  const { data, error } = await supabase
    .from('service_slot_day_state')
    .select('slot_id,reserved_date,seats_capacity,seats_taken')
    .eq('slot_id', slotId)
    .eq('reserved_date', date)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { seats_capacity: number; seats_taken: number };
  return {
    slotId,
    date,
    seatsCapacity: row.seats_capacity,
    seatsTaken: row.seats_taken,
    seatsRemaining: seatsRemaining(row.seats_capacity, row.seats_taken),
  };
}

/** The couple's live tables for an event. */
export async function listEventReservations(
  supabase: SupabaseClient,
  eventId: string,
): Promise<SlotSeatReservation[]> {
  const { data, error } = await supabase
    .from('service_slot_reservations')
    .select(
      'reservation_id,slot_id,vendor_profile_id,event_id,reserved_date,party_size,status,guest_note,confirmed_at,cancelled_at',
    )
    .eq('event_id', eventId)
    .in('status', OCCUPYING_STATUSES as unknown as string[])
    .order('reserved_date', { ascending: true });

  if (error) return [];
  return (data ?? []) as SlotSeatReservation[];
}

/**
 * Hold seats. The RPC is the ONLY thing that decides availability — do not
 * gate this call on a prior availability read.
 */
export async function reserveSeats(
  supabase: SupabaseClient,
  args: {
    eventId: string;
    slotId: string;
    date: string;
    partySize: number;
    guestNote?: string | null;
  },
): Promise<ReserveResult> {
  const { data, error } = await supabase.rpc('reserve_service_slot_seats', {
    p_event_id: args.eventId,
    p_slot_id: args.slotId,
    p_reserved_date: args.date,
    p_party_size: args.partySize,
    p_guest_note: args.guestNote ?? null,
  });

  // Fail CLOSED. A transport error is not an empty result and must never be
  // reported as a successful hold.
  if (error || !data) return { status: 'invalid_input' };

  const env = data as { status: ReserveStatus; [k: string]: unknown };
  if (env.status === 'ok') {
    return {
      status: 'ok',
      reservationId: String(env.reservation_id),
      seatsTaken: Number(env.seats_taken ?? 0),
      seatsRemaining: Number(env.seats_remaining ?? 0),
    };
  }
  return {
    status: env.status,
    seatsRemaining:
      typeof env.seats_remaining === 'number' ? env.seats_remaining : undefined,
  };
}

/** Cancel a table and release its seats. Callable by the couple or the vendor. */
export async function cancelReservation(
  supabase: SupabaseClient,
  reservationId: string,
  reason?: string | null,
): Promise<CancelStatus> {
  const { data, error } = await supabase.rpc('cancel_service_slot_reservation', {
    p_reservation_id: reservationId,
    p_reason: reason ?? null,
  });
  if (error || !data) return 'not_found';
  return (data as { status: CancelStatus }).status;
}

/** Restaurant confirm-back. Does not move capacity — it was consumed at hold. */
export async function confirmReservation(
  supabase: SupabaseClient,
  reservationId: string,
): Promise<ConfirmStatus> {
  const { data, error } = await supabase.rpc('confirm_service_slot_reservation', {
    p_reservation_id: reservationId,
  });
  if (error || !data) return 'not_found';
  return (data as { status: ConfirmStatus }).status;
}
