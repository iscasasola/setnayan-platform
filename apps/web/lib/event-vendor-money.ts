/**
 * event-vendor-money.ts — the ONE way app code reads a booking's five amounts.
 *
 * 🔒 #5936 · migration 20271342818285 (migration A — readers only). `event_vendors.total_cost_php · deposit_paid_php ·
 * transport_php · food_allowance_php · pax_surcharge_php` are still SELECT-able today: a Suppliers delegate without
 * Budget & payments reads the same row as the host, and RLS cannot hide a column. The per-column close (a REVOKE, so
 * a direct select or a `select('*')` on a user session is refused with "permission denied") lands in migration B, a
 * later PR, once prod serves code that reads only through here.
 *
 * Until then this module is the ONE app path to the amounts: read them through
 * `public.event_vendor_money_read(event_id)` — this module. It returns every booking row
 * the caller may read, with the amounts filled only for a host or a delegate whose Budget area is not Off;
 * `money_shown: false` means HIDDEN, never ₱0. On the service role (the admin client) every amount is filled, so
 * a lib function called with either client reads the same way.
 *
 * Held by `lib/booking-money-reads-through-the-reader.test.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const BOOKING_MONEY_COLUMNS = [
  'total_cost_php',
  'deposit_paid_php',
  'transport_php',
  'food_allowance_php',
  'pax_surcharge_php',
] as const;
export type BookingMoneyColumn = (typeof BOOKING_MONEY_COLUMNS)[number];

export type BookingMoney = {
  total_cost_php: number | null;
  deposit_paid_php: number | null;
  transport_php: number | null;
  food_allowance_php: number | null;
  pax_surcharge_php: number | null;
  /** FALSE = the caller may not read this booking's amounts (Suppliers delegate without Budget). Never draw ₱0. */
  money_shown: boolean;
};

const HIDDEN: BookingMoney = {
  total_cost_php: null,
  deposit_paid_php: null,
  transport_php: null,
  food_allowance_php: null,
  pax_surcharge_php: null,
  money_shown: false,
};

type ReaderRow = {
  vendor_id: string;
  total_cost_php: number | string | null;
  deposit_paid_php: number | string | null;
  transport_php: number | string | null;
  food_allowance_php: number | string | null;
  pax_surcharge_php: number | string | null;
  money_shown: boolean | null;
};

// PostgREST hands NUMERIC back as a JSON number; keep a string-safe parse so a precise NUMERIC never becomes NaN.
const num = (v: number | string | null): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * The amounts of every booking on `eventId` the caller may read, keyed by `event_vendors.vendor_id`.
 * Throws on a refused read — an unread amount must never render as ₱0.
 */
export async function readBookingMoney(
  supabase: SupabaseClient,
  eventId: string,
): Promise<Map<string, BookingMoney>> {
  const { data, error } = await supabase.rpc('event_vendor_money_read', { p_event_id: eventId });
  if (error) throw new Error(`event_vendor_money_read failed: ${error.message}`);
  const out = new Map<string, BookingMoney>();
  for (const r of (data ?? []) as ReaderRow[]) {
    out.set(r.vendor_id, {
      total_cost_php: num(r.total_cost_php),
      deposit_paid_php: num(r.deposit_paid_php),
      transport_php: num(r.transport_php),
      food_allowance_php: num(r.food_allowance_php),
      pax_surcharge_php: num(r.pax_surcharge_php),
      money_shown: r.money_shown === true,
    });
  }
  return out;
}

/** The amounts of ONE booking (HIDDEN when the caller may not read it). */
export async function readOneBookingMoney(
  supabase: SupabaseClient,
  eventId: string,
  vendorId: string,
): Promise<BookingMoney> {
  return (await readBookingMoney(supabase, eventId)).get(vendorId) ?? HIDDEN;
}

/** `rows` (read WITHOUT the five columns) with the amounts merged back in by `vendor_id`. */
export function mergeBookingMoney<T extends { vendor_id: string }>(
  rows: readonly T[],
  money: ReadonlyMap<string, BookingMoney>,
): Array<T & BookingMoney> {
  return rows.map((r) => ({ ...r, ...(money.get(r.vendor_id) ?? HIDDEN) }));
}

/** Read the amounts for `eventId` and merge them into `rows`. */
export async function withBookingMoney<T extends { vendor_id: string }>(
  supabase: SupabaseClient,
  eventId: string,
  rows: readonly T[],
): Promise<Array<T & BookingMoney>> {
  if (rows.length === 0) return [];
  return mergeBookingMoney(rows, await readBookingMoney(supabase, eventId));
}
