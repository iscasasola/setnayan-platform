import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { ModeratorPermissions } from '@/lib/delegate-areas';
// The window is applied inside `scheduleRequestRecipients` (delegate-access-window),
// so an expired coordinator is never told about a request they can no longer answer.
import {
  scheduleRequestRecipients,
  scheduleRequestTitle,
  type ScheduleRequestKind,
  type ScheduleRequestSeat,
} from '@/lib/schedule-request-recipients';

/**
 * Tell the people who can APPROVE a supplier's schedule request that it is
 * waiting: the couple, and every delegate holding The Day = Edit (owner
 * 2026-10-03). One notification each, through the one mechanism
 * (`emitNotification`), as `schedule_change_requested` — which is on the email
 * allowlist, so it reaches somebody who is not at a console.
 *
 * Best-effort by contract: the request row is already written, and a failed
 * notice must never undo it. A refused read is LOGGED (logQueryError), never
 * read as "nobody to tell".
 *
 * Admin client, scoped by `event_id`: `event_members` and `event_moderators`
 * are not readable by the supplier who triggered this.
 */
export async function notifyScheduleRequest(input: {
  eventId: string;
  supplierName: string;
  kind: ScheduleRequestKind;
  itemLabel: string | null;
  proposesChange: boolean;
  note: string;
}): Promise<void> {
  const admin = createAdminClient();
  const [membersRes, seatsRes, eventRes] = await Promise.all([
    admin.from('event_members').select('user_id').eq('event_id', input.eventId).eq('member_type', 'couple'),
    admin
      .from('event_moderators')
      .select('user_id, accepted_at, removed_at, permissions_json')
      .eq('event_id', input.eventId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null),
    admin
      .from('events')
      .select('event_date, event_end_date, event_date_precision')
      .eq('event_id', input.eventId)
      .maybeSingle(),
  ]);
  if (membersRes.error) logQueryError('notifyScheduleRequest.members', membersRes.error, { eventId: input.eventId }, 'graceful_degrade');
  if (seatsRes.error) logQueryError('notifyScheduleRequest.seats', seatsRes.error, { eventId: input.eventId }, 'graceful_degrade');
  if (eventRes.error) logQueryError('notifyScheduleRequest.event', eventRes.error, { eventId: input.eventId }, 'graceful_degrade');

  const ev = (eventRes.data ?? null) as {
    event_date: string | null;
    event_end_date: string | null;
    event_date_precision: string | null;
  } | null;
  const recipients = scheduleRequestRecipients({
    coupleUserIds: ((membersRes.data ?? []) as { user_id: string | null }[]).map((m) => m.user_id),
    seats: ((seatsRes.data ?? []) as (Omit<ScheduleRequestSeat, 'permissions_json'> & {
      permissions_json: ModeratorPermissions | null;
    })[]),
    window: {
      eventDate: ev?.event_date ?? null,
      eventEndDate: ev?.event_end_date ?? null,
      precision: ev?.event_date_precision ?? null,
    },
    now: new Date(),
  });

  const title = scheduleRequestTitle({
    supplierName: input.supplierName,
    kind: input.kind,
    itemLabel: input.itemLabel,
    proposesChange: input.proposesChange,
  });
  for (const userId of recipients) {
    await emitNotification({
      userId,
      type: 'schedule_change_requested',
      title,
      body: input.note.trim().slice(0, 200),
      relatedUrl: `/dashboard/${input.eventId}/schedule`,
    });
  }
}
