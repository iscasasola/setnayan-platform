'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchVendorBlocksDetailed,
  fetchVendorDayStates,
  fetchVendorPoolBookings,
  fetchVendorPools,
  type SchedulePool,
  type VendorCalendarDayState,
} from '@/lib/vendor-schedule';
import type { DatesBlock, DatesBooking } from '@/lib/vendor-dates';
import { datesBlocksForWire, datesBookingsForWire } from './dates-wire';
import { fetchVendorWaitlist, type WaitlistDateGroup } from '@/lib/vendor-waitlist';

/**
 * The ONLY two datasets that change when the "My Customers" calendar pages to a
 * different month: the vendor's explicit day states (locked / whitelist) and
 * the couple waitlist queue for the visible month. Everything else the page
 * renders — pools, bookings, blocks, payments, messages, services, the
 * customer list — is month-independent and is shipped to the client once on
 * first paint, so the arrow buttons never re-fetch it.
 *
 * Returns null when the caller isn't a signed-in vendor (the client falls back
 * to a full server navigation in that case). The vendor is resolved from the
 * session — the client never passes a vendor id.
 */
export async function fetchCustomerCalendarMonth(month: string): Promise<{
  dayStates: VendorCalendarDayState[];
  waitlist: WaitlistDateGroup[];
} | null> {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;

  const vendorProfileId = profile.vendor_profile_id;
  const [dayStates, waitlist] = await Promise.all([
    fetchVendorDayStates(supabase, vendorProfileId, `${month}-01`, `${month}-31`),
    fetchVendorWaitlist(supabase, vendorProfileId, `${month}-01`),
  ]);

  return { dayStates, waitlist };
}

/**
 * 📅 THE PICKED CLIENT'S SCHEDULE CALENDAR (v113 `calC`, controller 2026-11-08: "the Clients calendar component — one
 * part, not a second calendar"). The picked client reads none of the month's inputs at load (its page switch is 0
 * requests); the Schedule page asks for them ONCE, on first view, in this one round trip — the same five reads
 * Clients › Dates makes for its month, through the same wire trim. A later ‹ › month is `fetchCustomerCalendarMonth`.
 *
 * Not here (said in the build notes): the "asking" marks — they need the shop's threads, a heavier read; the Schedule
 * month draws booked · outside · not available · full only, and its legend says only those.
 *
 * Null = not a signed-in supplier, or the month could not be read — the calendar says so, never an empty month.
 */
export async function fetchScheduleCalendar(month: string): Promise<{
  pools: SchedulePool[];
  bookings: DatesBooking[];
  blocks: DatesBlock[];
  dayStates: VendorCalendarDayState[];
  waitlist: WaitlistDateGroup[];
  closuresComplete: boolean;
} | null> {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;
  const vendorProfileId = profile.vendor_profile_id;
  try {
    const [pools, bookings, blocksRead, dayStates, waitlist] = await Promise.all([
      fetchVendorPools(supabase, vendorProfileId),
      fetchVendorPoolBookings(supabase, vendorProfileId),
      fetchVendorBlocksDetailed(supabase, vendorProfileId),
      fetchVendorDayStates(supabase, vendorProfileId, `${month}-01`, `${month}-31`),
      fetchVendorWaitlist(supabase, vendorProfileId, `${month}-01`),
    ]);
    return {
      pools,
      bookings: datesBookingsForWire(bookings),
      blocks: datesBlocksForWire(blocksRead.blocks),
      dayStates,
      waitlist,
      closuresComplete: blocksRead.complete,
    };
  } catch {
    return null;
  }
}
