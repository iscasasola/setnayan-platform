'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchVendorBlocksDetailed,
  fetchVendorMonthDayStates,
  fetchVendorPoolBookings,
  fetchVendorPools,
  type SchedulePool,
  type VendorCalendarDayState,
} from '@/lib/vendor-schedule';
import type { DatesBlock, DatesBooking } from '@/lib/vendor-dates';
import { datesBlocksForWire, datesBookingsForWire } from './dates-wire';
import { fetchVendorWaitlist, type WaitlistDateGroup } from '@/lib/vendor-waitlist';
import { fetchVendorThreadsDetailed } from '@/lib/chat';
import { asksByDate } from '@/lib/vendor-dates';
import { readOpenAsks } from './open-asks';

/**
 * The ONLY two datasets that change when the "My Customers" calendar pages to a
 * different month: the vendor's explicit day states (locked / whitelist) and
 * the couple waitlist queue for the visible month. Everything else the page
 * renders — pools, bookings, blocks, payments, messages, services, the
 * customer list — is month-independent and is shipped to the client once on
 * first paint, so the arrow buttons never re-fetch it.
 *
 * 📅 `{ whole: true }` — THE PICKED CLIENT'S SCHEDULE CALENDAR (v113 `calC`, controller 2026-11-08: "the Clients
 * calendar component — one part, not a second calendar"). The picked client reads none of the month's inputs at load
 * (its page switch is 0 requests), so its Schedule page asks ONCE, on first view, for the month-independent part too —
 * pools · bookings · blocks, the same reads and the same wire trim as Clients › Dates — in this one round trip. It is
 * THIS action with one option, not a second export (lint-server-action-budget: reuse before adding).
 *
 * 🟠 ASKING MARKS, IN THE SAME ROUND TRIP (Build 2 row #43g): the shop's threads ride the same `Promise.all`, then ONE
 * events read for the asked-about dates (`readOpenAsks`, the reader the Clients month uses) — still ONE request from the
 * browser. A refused threads or events read sends `inquiries: null` and the month draws no asking mark and no "Asking"
 * in its legend — never a month that looks un-asked because the question could not be read.
 *
 * Returns null when the caller isn't a signed-in vendor (the client falls back
 * to a full server navigation in that case), or — for `whole` — when the read
 * failed: the Schedule calendar SAYS so, never an empty month. The vendor is
 * resolved from the session — the client never passes a vendor id.
 */
export async function fetchCustomerCalendarMonth(month: string, opts?: { whole?: boolean }): Promise<{
  dayStates: VendorCalendarDayState[];
  /** False ⇒ the held / approve-first days were refused — the month SAYS so, never draws those days as free (G7). */
  dayStatesRead: boolean;
  waitlist: WaitlistDateGroup[];
  whole?: {
    pools: SchedulePool[];
    bookings: DatesBooking[];
    blocks: DatesBlock[];
    closuresComplete: boolean;
    /** The asked-about dates, counted; null = not read (no marks drawn, none claimed). */
    inquiries: { requestedDate: string; count: number }[] | null;
  };
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
  if (!opts?.whole) {
    const [dayStates, waitlist] = await Promise.all([
      fetchVendorMonthDayStates(supabase, vendorProfileId, month),
      fetchVendorWaitlist(supabase, vendorProfileId, `${month}-01`),
    ]);
    return { dayStates: dayStates ?? [], dayStatesRead: dayStates !== null, waitlist };
  }
  try {
    const [pools, bookings, blocksRead, dayStates, waitlist, threadsRead] = await Promise.all([
      fetchVendorPools(supabase, vendorProfileId),
      fetchVendorPoolBookings(supabase, vendorProfileId),
      fetchVendorBlocksDetailed(supabase, vendorProfileId),
      fetchVendorMonthDayStates(supabase, vendorProfileId, month),
      fetchVendorWaitlist(supabase, vendorProfileId, `${month}-01`),
      // A refused threads read is not "nobody asked" — it becomes `inquiries: null` below.
      fetchVendorThreadsDetailed(supabase, vendorProfileId).catch(() => null),
    ]);
    // The Schedule page's month has no partial state: refused held days ⇒ the whole read is refused, and it SAYS so.
    if (dayStates === null) return null;
    const asks =
      threadsRead && threadsRead.complete
        ? await readOpenAsks(threadsRead.threads, new Set(bookings.map((b) => b.eventId))).catch(() => null)
        : null;
    return {
      dayStates,
      dayStatesRead: true,
      waitlist,
      whole: {
        pools,
        bookings: datesBookingsForWire(bookings),
        blocks: datesBlocksForWire(blocksRead.blocks),
        closuresComplete: blocksRead.complete,
        inquiries: asks && asks.measured ? asksByDate(asks.asks) : null,
      },
    };
  } catch {
    return null;
  }
}
