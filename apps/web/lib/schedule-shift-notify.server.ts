import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { logQueryError } from '@/lib/supabase/error-detect';
import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/vendor-funnel';
import { isOnTheDay, scheduleShiftBody, scheduleShiftHref, scheduleShiftTitle } from '@/lib/schedule-shift-notice';

/**
 * ⏱ TELL EVERY BOOKED SUPPLIER THE DAY MOVED (owner, tracker 2026-10-23: YES).
 *
 * Called ONCE per shift — after Running late (`bulkRetimeScheduleBlocks`, when the sheet sends it) or the floor's
 * +N (`floorRetimeFrom`) landed — never once per block. One in-app notice per booked shop (`schedule_shifted`, not
 * on the email allowlist), opening the supplier's event Hub at the schedule. The person who shifted it is not told
 * their own shift.
 *
 * Best-effort by contract: the shift is already written, and a failed notice must never undo it or throw into the
 * sheet. A refused read is LOGGED, never read as "nobody to tell".
 *
 * Admin client, scoped by `event_id`: a supplier cannot read `event_vendors`, and the couple cannot read
 * `vendor_profiles.user_id` of other shops.
 */
export async function notifyScheduleShifted(input: {
  eventId: string;
  deltaMinutes: number;
  /** The first moved moment's start BEFORE the shift (stored wall clock). */
  fromStartAt: string | null;
  fromLabel: string | null;
  /** Who pressed it — never told about their own shift. */
  actorUserId: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const [bookedRes, eventRes] = await Promise.all([
      admin
        .from('event_vendors')
        .select('marketplace_vendor_id')
        .eq('event_id', input.eventId)
        .in('status', [...BOOKED_EVENT_VENDOR_STATUSES])
        .is('archived_at', null)
        .not('marketplace_vendor_id', 'is', null),
      admin.from('events').select('display_name, event_date, event_end_date').eq('event_id', input.eventId).maybeSingle(),
    ]);
    if (bookedRes.error) {
      logQueryError('notifyScheduleShifted.booked', bookedRes.error, { eventId: input.eventId }, 'graceful_degrade');
      return;
    }
    const shops = [...new Set(((bookedRes.data ?? []) as { marketplace_vendor_id: string }[]).map((b) => b.marketplace_vendor_id))];
    if (shops.length === 0) return;
    const { data: owners, error: ownersErr } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, user_id')
      .in('vendor_profile_id', shops);
    if (ownersErr) {
      logQueryError('notifyScheduleShifted.owners', ownersErr, { eventId: input.eventId }, 'graceful_degrade');
      return;
    }
    const ev = (eventRes.data ?? null) as { display_name?: string | null; event_date?: string | null; event_end_date?: string | null } | null;
    const name = ev?.display_name?.trim() || 'The couple';
    const todayManila = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const href = scheduleShiftHref(input.eventId, isOnTheDay(ev?.event_date ?? null, ev?.event_end_date ?? null, todayManila));
    const title = scheduleShiftTitle(input.deltaMinutes, input.fromStartAt);
    const body = scheduleShiftBody(name, input.fromLabel);
    const told = new Set<string>();
    for (const o of (owners ?? []) as { vendor_profile_id: string; user_id: string | null }[]) {
      // One notice per PERSON per shift: a person who owns two booked shops is told once; the actor never.
      if (!o.user_id || o.user_id === input.actorUserId || told.has(o.user_id)) continue;
      told.add(o.user_id);
      await emitNotification({
        userId: o.user_id,
        type: 'schedule_shifted',
        title,
        body,
        relatedUrl: href,
        eventId: input.eventId,
      });
    }
  } catch (e) {
    console.error('[notifyScheduleShifted] best-effort notice failed:', e);
  }
}
