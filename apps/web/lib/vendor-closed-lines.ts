/**
 * vendor-closed-lines.ts — THE TWO CLOSED LINES A CUSTOMER'S ROW CARRIES that
 * are not on the shop's own booking row: a delay the couple flagged, and a
 * meeting time they proposed that has passed unanswered.
 *
 * WHY IT EXISTS (supplier redesign S-PR2, owner answer 3 of 2026-10-10). Today
 * kept a "Nothing to answer" list for three facts shown nowhere else. That list
 * is removed in the same change that puts each fact on the customer's row in
 * Customers › People. The third fact — a booking ask whose window closed — is
 * read off the roster's own `event_vendors` rows (`lockAskPhase`); these two
 * need a read each.
 *
 * 🔑 THE SAME QUESTIONS THE DESK ASKS, NOT NEW ONES. `lib/vendor-overview.ts`
 * builds the desk's `dispute` card from `booking_handovers.status = 'disputed'`
 * and its passed `meeting` card from `event_appointments` rows the COUPLE
 * proposed (`status = 'proposed'`, `initiated_by = 'couple'`) whose time is
 * `meetingAskPhase(…) === 'passed'`. This module asks exactly those, and
 * `app/vendor-dashboard/customers/people-says-the-closed-lines.test.ts` holds
 * the two files' predicates together — one that moves without the other fails.
 *
 * 🔴 A REFUSED READ IS NOT "NOTHING FLAGGED". The desk's own readers are
 * fail-soft (`return []`), which is right for a card list and wrong here: a row
 * that silently loses "delay flagged" reads as a customer with no problem. Each
 * read reports `ok`, and People says so on screen when one failed
 * (`reads-are-honest.test.ts` is the pattern).
 *
 * Both tables carry a vendor-read policy keyed on `vendor_profile_id`, so the
 * shop's OWN session resolves them — no service role here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { meetingAskPhase } from '@/lib/answers-desk';
import { logQueryError } from '@/lib/supabase/error-detect';

export type VendorClosedLines = {
  /** Events with a handover the couple flagged as late. */
  delayFlagged: Set<string>;
  /** Events with a couple-proposed meeting whose time has passed unanswered. */
  meetingPassed: Set<string>;
  /** False when either read was refused — the rows may be missing a line. */
  complete: boolean;
};

export async function readVendorClosedLines(
  supabase: SupabaseClient,
  vendorProfileId: string,
  nowMs: number,
): Promise<VendorClosedLines> {
  const [flags, meetings] = await Promise.all([
    supabase
      .from('booking_handovers')
      .select('event_id')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'disputed'),
    supabase
      .from('event_appointments')
      .select('event_id, scheduled_at')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'proposed')
      .eq('initiated_by', 'couple'),
  ]);

  if (flags.error) {
    logQueryError('readVendorClosedLines.booking_handovers', flags.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
  }
  if (meetings.error) {
    logQueryError('readVendorClosedLines.event_appointments', meetings.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
  }

  const delayFlagged = new Set<string>();
  for (const r of (flags.data ?? []) as Array<{ event_id: string }>) delayFlagged.add(r.event_id);

  const meetingPassed = new Set<string>();
  for (const r of (meetings.data ?? []) as Array<{ event_id: string; scheduled_at: string | null }>) {
    if (meetingAskPhase(r.scheduled_at, nowMs) === 'passed') meetingPassed.add(r.event_id);
  }

  return { delayFlagged, meetingPassed, complete: !flags.error && !meetings.error };
}
