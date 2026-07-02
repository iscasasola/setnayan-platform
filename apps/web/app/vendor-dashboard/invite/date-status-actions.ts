'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * Advisory calendar status for a single date on the vendor's OWN book — powers
 * the Locked QR date field's availability read (owner 2026-07-02: "sight if the
 * event date is available / whitelist / waitlist / blocked already").
 *
 * Composes four cheap, RLS-scoped reads that mirror the /vendor-dashboard/calendar
 * model (the 6-state taxonomy in lib/vendor-schedule.ts):
 *   • vendor_calendar_blocks        → blocked (a manual block/closed date)
 *   • vendor_calendar_day_states    → locked / whitelist (the two stored states)
 *   • vendor_schedule_pool_bookings → booked count (live, released_at IS NULL)
 *   • vendor_date_waitlist          → waitlist count (pending couples)
 *
 * Org-wide (any pool) and purely ADVISORY — the caller never hard-blocks issuing
 * (the vendor is recording a deal they already closed). Fail-soft to a
 * clean/empty status so the form never breaks on a read error.
 *
 * Return type is inferred by callers via `Awaited<ReturnType<...>>` — no type is
 * exported (a 'use server' file may only export async functions).
 */
export async function resolveVendorDateStatus(dateIso: string): Promise<{
  blocked: boolean;
  blockLabels: string[];
  locked: boolean;
  whitelist: boolean;
  bookedCount: number;
  waitlistCount: number;
}> {
  const empty = {
    blocked: false,
    blockLabels: [] as string[],
    locked: false,
    whitelist: false,
    bookedCount: 0,
    waitlistCount: 0,
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return empty;
  const vendorProfileId = (profile as { vendor_profile_id: string }).vendor_profile_id;

  const [blocksRes, dayStatesRes, bookingsRes, waitlistRes] = await Promise.all([
    supabase
      .from('vendor_calendar_blocks')
      .select('block_label')
      .eq('vendor_profile_id', vendorProfileId)
      .lte('blocked_at', `${dateIso}T23:59:59Z`)
      .gt('blocked_until', `${dateIso}T00:00:00Z`)
      .limit(5),
    supabase
      .from('vendor_calendar_day_states')
      .select('day_state')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('state_date', dateIso),
    supabase
      .from('vendor_schedule_pool_bookings')
      .select('pool_booking_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .is('released_at', null)
      .eq('booked_date', dateIso),
    supabase
      .from('vendor_date_waitlist')
      .select('requested_date', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'pending')
      .eq('requested_date', dateIso),
  ]);

  const blockLabels = ((blocksRes.data ?? []) as { block_label: string }[])
    .map((b) => b.block_label)
    .filter(Boolean);
  const dayStates = ((dayStatesRes.data ?? []) as { day_state: string }[]).map(
    (d) => d.day_state,
  );

  return {
    blocked: blockLabels.length > 0,
    blockLabels,
    locked: dayStates.includes('locked'),
    whitelist: dayStates.includes('whitelist'),
    bookedCount: bookingsRes.count ?? 0,
    waitlistCount: waitlistRes.count ?? 0,
  };
}
