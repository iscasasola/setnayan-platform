'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorDayStates, type VendorCalendarDayState } from '@/lib/vendor-schedule';
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
