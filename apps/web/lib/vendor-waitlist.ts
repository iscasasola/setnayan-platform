import 'server-only';

/**
 * vendor-waitlist.ts — Booked-Out Waitlist (Wave 4 vendor benefit) data + notify.
 *
 * The couple-join server action lives in app/v/[slug]/waitlist-actions.ts (it's
 * a `'use server'` form handler). This module holds the shared read query (for
 * the vendor calendar queue) and the notify primitive (flip pending → notified +
 * email), which is called from:
 *   • the vendor's one-click "a slot opened" action (vendor-dashboard/calendar),
 *   • the auto-on-free path when a vendor removes a calendar block (removeBlock
 *     fires it via Next 15 after()).
 *
 * Notify runs through the service-role admin client: the flip is a vendor-driven
 * write on rows the couple owns, so it bypasses RLS deliberately (vendors have no
 * UPDATE policy on this table — see the migration comment). The select query, by
 * contrast, uses whatever client the caller passes so RLS still scopes reads.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWaitlistSlotOpenedEmail } from '@/lib/vendor-email-triggers';

export type WaitlistDateGroup = {
  /** ISO YYYY-MM-DD */
  requestedDate: string;
  /** How many couples are still pending for this date. */
  pendingCount: number;
};

/**
 * Pending waitlist rows for a vendor, grouped by date (soonest first). RLS on
 * vendor_date_waitlist already scopes SELECT to the vendor's own profile, so the
 * caller's host client is safe to use; we add the explicit vendor filter anyway
 * for index use + defence in depth. Fail-soft: returns [] on error.
 */
export async function fetchVendorWaitlist(
  supabase: SupabaseClient,
  vendorProfileId: string,
  fromDate: string,
): Promise<WaitlistDateGroup[]> {
  const { data, error } = await supabase
    .from('vendor_date_waitlist')
    .select('requested_date')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'pending')
    .gte('requested_date', fromDate)
    .order('requested_date', { ascending: true });

  if (error || !data) {
    if (error) console.error('[waitlist] fetchVendorWaitlist failed:', error.message);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data as { requested_date: string }[]) {
    counts.set(row.requested_date, (counts.get(row.requested_date) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([requestedDate, pendingCount]) => ({ requestedDate, pendingCount }))
    .sort((a, b) => a.requestedDate.localeCompare(b.requestedDate));
}

/**
 * Notify every pending waitlister for a (vendor, date): flip pending → notified,
 * stamp notified_at, and email each couple. Service-role; idempotent (already-
 * notified rows are skipped by the status filter). Returns the number of couples
 * notified. Best-effort emails — a failed send is logged, never thrown, so the
 * status flip + the calling action always complete.
 */
export async function notifyWaitlistForDate(
  vendorProfileId: string,
  requestedDate: string,
): Promise<number> {
  const admin = createAdminClient();

  // Resolve the vendor's public label + slug once for the email body.
  const { data: vendorRow } = await admin
    .from('vendor_profiles')
    .select('business_name, screen_name, business_slug')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const v = vendorRow as
    | { business_name: string | null; screen_name: string | null; business_slug: string | null }
    | null;
  const vendorLabel = v?.business_name?.trim() || v?.screen_name?.trim() || 'a vendor on Setnayan';
  const vendorSlug = v?.business_slug ?? null;

  // Flip pending → notified and get back the affected rows (RETURNING via select).
  const { data: flipped, error } = await admin
    .from('vendor_date_waitlist')
    .update({ status: 'notified', notified_at: new Date().toISOString() })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('requested_date', requestedDate)
    .eq('status', 'pending')
    .select('user_id');

  if (error || !flipped) {
    if (error) console.error('[waitlist] notifyWaitlistForDate flip failed:', error.message);
    return 0;
  }

  const rows = flipped as { user_id: string }[];
  // De-dup user_ids (one couple shouldn't get two emails for the same date).
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  await Promise.allSettled(
    userIds.map((userId) =>
      sendWaitlistSlotOpenedEmail(userId, vendorLabel, requestedDate, vendorSlug).catch((e) => {
        console.error('[waitlist] slot-opened email failed:', String(e), { userId, requestedDate });
      }),
    ),
  );

  return userIds.length;
}

/**
 * Auto-notify when a BOOKING is released — the couple backed out, the vendor
 * cancelled, or the status was downgraded off deposit_paid.
 *
 * This is the third notify entry point, and the one the waitlist was actually
 * built for ("in case the person who purchased for that date backs out").
 * Before migration 20271121865976 it could not exist: the auto-block written at
 * deposit_paid had no inverse, so a released date stayed shut forever and no
 * couple could take it even after being emailed. That migration's trigger
 * reopens the date; this function is what tells the people waiting.
 *
 * 🔑 FAILS TOWARD SILENCE, ON PURPOSE. It re-reads the calendar and emails only
 * when the day is genuinely open — ANY covering block (the vendor's own manual
 * closure, an external client, a still-live booking the reopen guard kept)
 * means the date is not really free, and a "your date opened up!" email that
 * lands on a page still reading "unavailable" is worse than no email. This also
 * makes it order-independent: callers schedule it from after(), so it never
 * races the trigger regardless of whether the release ran before or after the
 * status write.
 *
 * Returns the number of couples notified (0 when the date is still closed).
 */
export async function notifyWaitlistIfBookingReleased(
  eventVendorId: string,
): Promise<number> {
  const admin = createAdminClient();

  const { data: bookingRow, error: bookingErr } = await admin
    .from('event_vendors')
    .select('marketplace_vendor_id, event_id')
    .eq('vendor_id', eventVendorId)
    .maybeSingle();
  // A hard-deleted row is the host-cancel path: the booking is gone, so there
  // is nothing left to resolve the vendor + date from here. That path passes
  // them explicitly via notifyWaitlistForFreedDate below.
  if (bookingErr || !bookingRow) return 0;

  const booking = bookingRow as {
    marketplace_vendor_id: string | null;
    event_id: string | null;
  };
  if (!booking.marketplace_vendor_id || !booking.event_id) return 0;

  const { data: eventRow } = await admin
    .from('events')
    .select('event_date')
    .eq('event_id', booking.event_id)
    .maybeSingle();
  const eventDate = (eventRow as { event_date: string | null } | null)?.event_date;
  if (!eventDate) return 0;

  return notifyWaitlistForFreedDate(booking.marketplace_vendor_id, eventDate);
}

/**
 * Notify a (vendor, date) ONLY IF the day is genuinely open — no calendar block
 * of any source still covers it. The open-check is the whole point: see the
 * fail-toward-silence note on notifyWaitlistIfBookingReleased.
 *
 * Day grain matches vendor_block_booked_date's convention (PH midnight →
 * 23:30 +08), so a block written for that day always overlaps this window.
 */
export async function notifyWaitlistForFreedDate(
  vendorProfileId: string,
  requestedDate: string,
): Promise<number> {
  const admin = createAdminClient();

  const dayStart = `${requestedDate}T00:00:00+08:00`;
  const dayEnd = `${requestedDate}T23:59:59+08:00`;

  const { data: covering, error: coveringErr } = await admin
    .from('vendor_calendar_blocks')
    .select('block_id')
    .eq('vendor_profile_id', vendorProfileId)
    .lte('blocked_at', dayEnd)
    .gte('blocked_until', dayStart)
    .limit(1);

  // A failed read is NOT an open date. Staying silent costs the vendor a
  // notification; emailing on a bad read sends couples to a date they cannot
  // book. The vendor's one-click "a slot opened" button remains the manual
  // path, so nothing is unrecoverable.
  if (coveringErr) {
    console.error(
      '[waitlist] notifyWaitlistForFreedDate open-check failed:',
      coveringErr.message,
    );
    return 0;
  }
  if (Array.isArray(covering) && covering.length > 0) return 0;

  return notifyWaitlistForDate(vendorProfileId, requestedDate);
}

/**
 * Auto-notify on a freed slot: given a removed calendar block's vendor + date
 * RANGE, notify every pending waitlist date that falls inside the freed range.
 * Called from removeBlock via after() — cron-free. Caps the scan at a generous
 * range to avoid a runaway on a huge block; dates with no waiters are no-ops.
 */
export async function notifyWaitlistForFreedRange(
  vendorProfileId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('vendor_date_waitlist')
    .select('requested_date')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'pending')
    .gte('requested_date', startDate)
    .lte('requested_date', endDate);

  if (error || !data) {
    if (error) console.error('[waitlist] notifyWaitlistForFreedRange scan failed:', error.message);
    return 0;
  }

  const dates = [...new Set((data as { requested_date: string }[]).map((r) => r.requested_date))];
  let total = 0;
  for (const date of dates) {
    total += await notifyWaitlistForDate(vendorProfileId, date);
  }
  return total;
}
