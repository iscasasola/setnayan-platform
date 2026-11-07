import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { chaptersFromBlocks, TASK_COLUMNS, type TaskRow } from '@/lib/schedule-chapters';
import { yourSchedule, type YourMoment, type YourSchedule } from '@/lib/guest-your-schedule';
import { websiteProActiveFor } from './hub-look';

/**
 * 📅 YOUR SCHEDULE — THE READ (Event Hub › Me; plan §3, §3b, §11b). The pure half, and every rule about whose lines a
 * guest sees, is `guest-your-schedule.ts`; this only asks the database and hands the answers in.
 *
 * Five small reads, together, on the SERVICE-ROLE client the guest page already uses (a guest holds no session the
 * database knows), so the filters below and the pure function ARE the fence:
 *   · the event's blocks, minus a coordinator's staged prep — chapters and moments. The same question for every guest
 *     of the event at one rev, so the guest page's shared-read cache answers it once (`lib/event-shared-reads.ts`);
 *   · whether the schedule is released (`events.schedule_released_at`, 20271302139506);
 *   · the tasks that may be this guest's — their seat, and every role or group task (`isMine` keeps only theirs);
 *   · the groups this guest is in;
 *   · the chapters the hosts took this guest off (`guest_chapter_not_invited`, owner 2026-11-02 "Invited to").
 * 💎 Release is Pro (§3b): `released` is true only when the event holds Pro, so a Free event stays at the
 * before-Release view for good whatever the column says. A Pro read that fails answers Free — at worst the guest sees
 * the before view, never a full schedule the event has not paid for.
 *
 * 📵 NO LIVE CONNECTION (owner 2026-10-28, "No Event Hub may crash"): nothing here subscribes or polls. It runs inside
 * the guest page's render, which the cached Event Hub copy serves (`app/[slug]/cached/[key]/page.tsx`); Release writes
 * `events`, which moves the event's stamp, so every copy is drawn afresh on its next open.
 *
 * 🛑 `unread` = a read was refused. Me then SAYS so — never a card with no chapters, never "no call time".
 */
export type YourScheduleRead = { kind: 'ok'; schedule: YourSchedule } | { kind: 'unread' };

/**
 * The block columns the card reads: a chapter's and a moment's fence and place. 🎭 NEVER a chapter's setup or pack-up
 * (`ingress_minutes_before` · `egress_minutes_after`) — backstage never reaches a guest (2026-11-04,
 * lib/a-guest-never-sees-backstage.test.ts).
 */
export const YOUR_SCHEDULE_BLOCK_FIELDS =
  'block_id, parent_block_id, label, start_at, end_at, location, spot, notes, call_lead_minutes, on_invitation, photo_who, photo_when, is_public, sort_order, time_tba, audience, visibility, travel_from, travel_to, follows_block_id, time_shape, time_or_minutes';

type BlockRow = {
  block_id: string;
  parent_block_id: string | null;
  label: string;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  spot: string | null;
  is_public: boolean | null;
  audience: string | null;
  visibility: string | null;
  time_tba: boolean | null;
  travel_from: string | null;
  travel_to: string | null;
  follows_block_id?: string | null;
  time_shape?: string | null;
  time_or_minutes?: number | null;
} & Record<string, unknown>;

export async function readYourSchedule(
  admin: SupabaseClient,
  input: { eventId: string; guestId: string; roles: readonly string[]; guestsArriveBy: string | null },
): Promise<YourScheduleRead> {
  const { eventId, guestId } = input;
  const [blocksRes, eventRes, tasksRes, groupsRes, notInvitedRes, pro] = await Promise.all([
    admin
      .from('event_schedule_blocks')
      .select(YOUR_SCHEDULE_BLOCK_FIELDS)
      .eq('event_id', eventId)
      .neq('visibility', 'coordinator_only'),
    admin.from('events').select('schedule_released_at').eq('event_id', eventId).maybeSingle(),
    admin
      .from('event_schedule_tasks')
      .select(TASK_COLUMNS)
      .eq('event_id', eventId)
      .or(`guest_id.eq.${guestId},role.not.is.null,group_id.not.is.null`),
    admin.from('guest_group_memberships').select('group_id').eq('guest_id', guestId),
    // ✉ The chapters the hosts took THIS guest off (owner 2026-11-02, "Invited to") — never drawn as theirs.
    admin.from('guest_chapter_not_invited').select('block_id').eq('guest_id', guestId),
    websiteProActiveFor(eventId).catch(() => false),
  ]);
  /* 📇 Task contacts (4 additions (3), migration 20271303218631). The service role reads them, so the fence is HERE:
     `yourSchedule` shows a contact only on a moment this guest has a task on (they are its crew). A refused read
     shows none — a phone number is never worth failing the whole card for. */
  const contactsRes = await admin.from('event_schedule_task_contacts').select('block_id, name, phone').eq('event_id', eventId);
  if (contactsRes.error) logQueryError('readYourSchedule.contacts', contactsRes.error, { event_id: eventId }, 'graceful_degrade');
  const failed = blocksRes.error ?? eventRes.error ?? tasksRes.error ?? groupsRes.error ?? notInvitedRes.error;
  if (failed) {
    logQueryError('readYourSchedule', failed, { event_id: eventId }, 'graceful_degrade');
    return { kind: 'unread' };
  }
  const rows = (blocksRes.data ?? []) as unknown as BlockRow[];
  const chapters = chaptersFromBlocks(rows);
  if (chapters.length === 0) return { kind: 'ok', schedule: { kind: 'none' } };
  const moments: YourMoment[] = rows.flatMap((r) =>
    r.parent_block_id && r.start_at
      ? [
          {
            block_id: r.block_id,
            parent_block_id: r.parent_block_id,
            label: String(r.label ?? ''),
            start_at: r.start_at,
            end_at: r.end_at,
            location: r.location,
            spot: r.spot,
            is_public: r.is_public === true,
            audience: r.audience ?? null,
            staged: r.visibility === 'coordinator_only',
            travel_from: r.travel_from,
            travel_to: r.travel_to,
            // ⏭ "Right after the one above" (migration 20271302727358): its start is only an order key.
            time_tba: r.time_tba === true,
            follows_block_id: r.follows_block_id ?? null,
            sort_order: typeof r.sort_order === 'number' ? r.sort_order : 0,
            // 🕑 "About 3:15 PM" · "2:15/2:30 PM" (migration 20271303051692).
            time_shape: r.time_shape ?? 'at',
            time_or_minutes: r.time_or_minutes ?? null,
          },
        ]
      : [],
  );
  const releasedAt = (eventRes.data as { schedule_released_at?: string | null } | null)?.schedule_released_at ?? null;
  return {
    kind: 'ok',
    schedule: yourSchedule({
      chapters,
      moments,
      tasks: (tasksRes.data ?? []) as unknown as TaskRow[],
      viewer: {
        guestId,
        roles: input.roles,
        groupIds: ((groupsRes.data ?? []) as Array<{ group_id: string }>).map((g) => g.group_id),
        notInvited: ((notInvitedRes.data ?? []) as Array<{ block_id: string }>).map((r) => r.block_id),
      },
      released: pro && releasedAt !== null,
      pro,
      guestsArriveBy: input.guestsArriveBy,
      contacts: contactsRes.error ? [] : ((contactsRes.data ?? []) as { block_id: string; name: string; phone: string }[]),
    }),
  };
}
