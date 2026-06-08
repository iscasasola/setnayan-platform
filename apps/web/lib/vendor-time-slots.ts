import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vendor tier feature #3 — Enterprise-only TIME-BOUND booking slots.
 * Canonical: Vendor_Tier_Capability_Matrix_2026-06-07.md · owner 2026-06-07
 * (Enterprise-only) + 2026-06-09 (the couple PICKS the slot at lock).
 *
 * An Enterprise vendor plots named per-service time windows ("AM Ceremony",
 * "Grand Ballroom"), each with its own per-day capacity. When a service has
 * >=1 active slot, finalizeVendor enforces PER-SLOT same-date counts (via the
 * atomic acquire_service_time_slot RPC) and SKIPS vendor_services.daily_capacity
 * (#2). Services with zero slots keep #2 unchanged.
 *
 * Tier gate (slotsPerDay === Infinity = Enterprise) lives in vendor-tier-caps
 * (`canPlotTimeSlots`) and is re-checked server-side on every plot/edit action.
 */

export const SLOT_LABEL_MAX = 80;
export const SLOT_CAPACITY_MIN = 1;
export const SLOT_CAPACITY_MAX = 50;

/**
 * Time must be on the hour or half-hour, hours bounded 00–23 (verifier N2 — the
 * DB granularity CHECK only bounds minutes/seconds; the TIME cast rejects 25:00
 * but with an ugly message, so the app pre-validates the hour too). Optional
 * trailing :00 for the seconds a Postgres TIME may echo back.
 */
export const SLOT_TIME_RE = /^([01]\d|2[0-3]):(00|30)(:00)?$/;

export type VendorServiceTimeSlot = {
  slot_id: string;
  vendor_service_id: string;
  slot_label: string;
  start_time: string; // "HH:MM[:SS]" from Postgres TIME
  end_time: string;
  slot_capacity: number;
  display_order: number;
};

/** Trim a Postgres TIME ("13:00:00") to a display "HH:MM". */
export function formatSlotTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

/** "AM Ceremony · 08:00–11:00" — the picker/list option label. */
export function slotOptionLabel(slot: VendorServiceTimeSlot): string {
  return `${slot.slot_label} · ${formatSlotTime(slot.start_time)}–${formatSlotTime(slot.end_time)}`;
}

const SLOT_SELECT =
  'slot_id,vendor_service_id,slot_label,start_time,end_time,slot_capacity,display_order';

/**
 * Vendor side — all ACTIVE slots for a vendor's services, bucketed by
 * vendor_service_id (for the services dashboard sub-editor). Runs under the
 * caller's RLS (vsts_vendor_access). Degrades to an empty map on error or a
 * missing table (pre-migration), so the page never crashes.
 */
export async function fetchVendorTimeSlotsByService(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<Map<string, VendorServiceTimeSlot[]>> {
  const byService = new Map<string, VendorServiceTimeSlot[]>();
  const { data, error } = await supabase
    .from('vendor_service_time_slots')
    .select(SLOT_SELECT)
    .eq('vendor_profile_id', vendorProfileId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) return byService;
  for (const row of (data ?? []) as VendorServiceTimeSlot[]) {
    const list = byService.get(row.vendor_service_id) ?? [];
    list.push(row);
    byService.set(row.vendor_service_id, list);
  }
  return byService;
}

/**
 * Couple side — the ACTIVE slots a couple may pick when locking a given booked
 * vendor (event_vendors row). Resolves the booking's service_id, then reads its
 * active slots. Runs under the couple session: the vsts_couple_read policy
 * admits slots whose service is referenced by one of the couple's bookings.
 * Returns [] when the booking has no service / no slots / on error (degrade
 * open → the lock proceeds as a normal date-only booking).
 */
export async function fetchSlotsForCoupleBooking(
  supabase: SupabaseClient,
  eventId: string,
  vendorId: string,
): Promise<VendorServiceTimeSlot[]> {
  const { data: ev, error: evErr } = await supabase
    .from('event_vendors')
    .select('service_id')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (evErr) return [];
  const serviceId = (ev as { service_id?: string | null } | null)?.service_id ?? null;
  if (!serviceId) return [];

  const { data, error } = await supabase
    .from('vendor_service_time_slots')
    .select(SLOT_SELECT)
    .eq('vendor_service_id', serviceId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) return [];
  return (data ?? []) as VendorServiceTimeSlot[];
}
