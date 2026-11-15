/**
 * 💬 THE CHATS LIST'S "GROUPS" SECTION — on top of the shipped Suppliers list (specs DECISION_LOG 2026-11-11 "EVENT
 * CHATS — PLACE + WHO IS IN GENERAL": one list, Groups first, then Suppliers, unchanged; 2026-11-12 "EVENT GROUP CHATS
 * APPROVED AS DRAWN", phone A). General · one per role from the guest list · groups a host makes, each row its name,
 * "N inside · its line", the last line you may read and the time; unread rows bold with a dot; a group you left
 * greyed. "+ New group" for hosts only.
 *
 * SERVER-RENDERED, NO SCRIPT: plain links, so the Chats page's first load carries nothing new (🛡 guard 5).
 * 🔒 LOOKING NEVER WRITES (RW-305, 14 Nov): opening the list used to CREATE General and the role groups, so an empty
 * "General" appeared for a host who had pressed nothing. Now a group the event should have but nobody has opened is
 * drawn as the same row, and its press posts `openGroupChat` (a form — a link would be prefetched). A refused read
 * says so, never "no groups". 🛡 a-chats-list-never-writes.test.ts
 */
import Link from 'next/link';
import { Hash, Plus, Users } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatChatTimestamp } from '@/lib/chat';
import { formatCount } from '@/lib/format-number';
import { logQueryError } from '@/lib/supabase/error-detect';
import { openGroupChat } from '../actions';
import {
  groupChatHref,
  groupListLine,
  groupListPreview,
  newGroupHref,
  groupsToOpen,
  readEventGroups,
  unopenedGroups,
  type GroupToOpen,
  type GroupListRow,
  type GroupPersonKind,
} from '@/lib/chat-groups';

const GROUP_HEAD = 'pb-0.5 pt-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/70';

export async function EventGroups({
  supabase,
  eventId,
  openFailed = false,
}: {
  supabase: SupabaseClient;
  eventId: string;
  /** The last tap on an unopened group was refused (`?group=unopened`). */
  openFailed?: boolean;
}) {
  const mine = await supabase.rpc('chat_group_my_kind', { p_event_id: eventId });
  if (mine.error) logQueryError('EventGroups (chat_group_my_kind)', mine.error, { event_id: eventId }, 'graceful_degrade');
  const me = (mine.data ?? null) as GroupPersonKind | null;
  const opener = me === 'host' || me === 'coordinator';
  const [rows, wanted] = await Promise.all([readEventGroups(supabase, eventId), opener ? groupsToOpen(supabase, eventId) : null]);
  const toOpen = rows && wanted ? unopenedGroups(wanted, rows) : [];
  return (
    <GroupsList
      rows={rows}
      toOpen={toOpen}
      eventId={eventId}
      openFailed={openFailed}
      newGroup={me === 'host' ? newGroupHref(eventId) : null}
    />
  );
}

/** The section itself, data in (the dev lab draws it on fixtures). `rows` null = the read was refused. */
export function GroupsList({
  rows,
  newGroup,
  toOpen = [],
  eventId = '',
  openFailed = false,
}: {
  rows: readonly GroupListRow[] | null;
  newGroup: string | null;
  /** Groups the event should have that nobody has opened yet — each row's press opens it (a POST, never on render). */
  toOpen?: readonly GroupToOpen[];
  eventId?: string;
  openFailed?: boolean;
}) {
  return (
    <section aria-labelledby="chats-groups-head" className="mb-2" data-chats-groups="">
      <div className="flex items-center justify-between">
        <h3 id="chats-groups-head" className={GROUP_HEAD}>
          Groups
        </h3>
        {newGroup ? (
          <Link
            href={newGroup}
            className="sn-press inline-flex min-h-[44px] items-center gap-1 text-[13px] font-semibold text-sn-accent"
            data-new-group-open=""
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
            New group
          </Link>
        ) : null}
      </div>
      {openFailed ? (
        <p role="alert" className="py-2 text-[13px] text-ink/70">
          Couldn&rsquo;t open that group just now. Try again in a moment.
        </p>
      ) : null}
      {rows === null ? (
        <p role="status" className="py-2 text-[13px] text-ink/70">
          Couldn&rsquo;t load your groups just now &mdash; this does not mean you have none. Reload in a moment.
        </p>
      ) : rows.length === 0 && toOpen.length === 0 ? (
        <p className="py-2 text-[13px] text-ink/70">No group chats yet.</p>
      ) : (
        <ul>
          {rows.map((g) => {
            const left = g.left_at !== null;
            const Icon = g.group_kind === 'general' ? Users : Hash;
            const preview = left ? 'You left this chat' : groupListPreview(g);
            return (
              <li key={g.thread_id}>
                <Link
                  href={groupChatHref(g.thread_id)}
                  className={`sn-press flex min-h-[60px] items-center gap-3 py-2 ${left ? 'opacity-55' : ''}`}
                  data-chats-group-row={g.group_kind}
                  {...(g.unread ? { 'data-unread': '' } : {})}
                >
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink/[0.07] text-ink/70">
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={`min-w-0 flex-1 truncate text-[15px] text-ink ${g.unread ? 'font-bold' : 'font-semibold'}`}>{g.group_name}</span>
                      {g.last_at && !left ? <span className="shrink-0 text-[12px] text-ink/70">{formatChatTimestamp(g.last_at)}</span> : null}
                    </span>
                    <span className="block truncate text-[12px] text-ink/70">
                      {formatCount(g.member_count)} inside · {groupListLine(g)}
                    </span>
                    {preview ? (
                      <span className={`block truncate text-[13px] ${g.unread ? 'font-semibold text-ink' : 'text-ink/70'}`}>{preview}</span>
                    ) : null}
                  </span>
                  {g.unread ? <span aria-label="Unread" className="h-2.5 w-2.5 shrink-0 rounded-full bg-sn-accent" /> : null}
                </Link>
              </li>
            );
          })}
          {toOpen.map((g) => {
            const Icon = g.kind === 'general' ? Users : Hash;
            return (
              <li key={`open:${g.kind}:${g.key ?? ''}`}>
                <form action={openGroupChat}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="group_kind" value={g.kind} />
                  {g.key ? <input type="hidden" name="group_key" value={g.key} /> : null}
                  <button
                    type="submit"
                    className="sn-press flex min-h-[60px] w-full items-center gap-3 py-2 text-left"
                    data-chats-group-row={g.kind}
                    data-chats-group-unopened=""
                  >
                    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink/[0.07] text-ink/70">
                      <Icon className="h-5 w-5" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{g.name}</span>
                      <span className="block truncate text-[12px] text-ink/55">{groupListLine({ group_kind: g.kind, made_by_name: null })}</span>
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      <h3 className={GROUP_HEAD}>Suppliers</h3>
    </section>
  );
}
