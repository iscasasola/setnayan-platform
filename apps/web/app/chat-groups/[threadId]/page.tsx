/**
 * 💬 /chat-groups/[threadId] — ONE EVENT GROUP CHAT, for everyone in it (specs DECISION_LOG 2026-11-12 "EVENT GROUP
 * CHATS APPROVED AS DRAWN"). A host, the coordinator, a guest and a supplier all open the same address (the group's
 * tray notices link here, migration 20271340374819), because a guest and a supplier cannot open a host's dashboard.
 *
 * WHO may read it is the database's answer only: `chat_group_head` returns nothing to a stranger (→ 404), and the
 * stream reads the messages through the reader's own session, so a private line between other people never arrives.
 * A host who LEFT sees "Join this chat again?" with their note — never the words written since.
 *
 * ‹ goes where this person came from: a host or the coordinator → the event's Chats; a supplier → their Chats; a guest
 * → their events (`groupChatBack`, lib/chat-groups.ts — computed per visit, lib/page-home.ts).
 */
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchMessages } from '@/lib/chat';
import { markThreadRead } from '@/lib/chat-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { BackButton } from '@/app/_components/back-button';
import { formatLongDate } from '@/lib/format-date';
import {
  canAddToGroup,
  canLeaveGroup,
  groupChatBack,
  groupChatHref,
  groupListLine,
  mayJoinGroup,
  readEventGroups,
  readGroupHead,
  readGroupMembers,
  readGroupPeople,
} from '@/lib/chat-groups';
import { GroupChatView } from './_components/group-chat-view';
import { addToGroup, leaveGroup, rejoinGroup, sendGroupMessage } from '../actions';

export const metadata = { title: 'Group chat', robots: { index: false, follow: false } };

export default async function GroupChatPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(groupChatHref(threadId))}`);
  const supabase = await createClient();

  const head = await readGroupHead(supabase, threadId);
  if (head === 'unread') throw new Error('The group could not be read just now.');
  if (!head) notFound();
  const back = groupChatBack(head.my_kind, head.event_id);

  // 🚪 You left: the row stays, greyed; a tap asks "Join this chat again?" with your own note (9 Nov 🚪).
  if (!head.is_member) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6" data-group-left="">
        <BackButton href={back.href} label={back.label} />
        <h1 className="mt-4 text-[20px] font-semibold text-ink">{head.group_name}</h1>
        <p className="mt-2 text-[15px] text-ink/75">
          Join this chat again? You left{head.left_at ? ` on ${formatLongDate(head.left_at.slice(0, 10))}` : ''}
          {head.left_note ? ` — ${head.left_note}` : ''}.
        </p>
        {canLeaveGroup(head.my_kind) ? (
          <form action={rejoinGroup} className="mt-4">
            <input type="hidden" name="thread_id" value={threadId} />
            <SubmitButton className="button-primary" pendingLabel="Joining…">
              Join chat
            </SubmitButton>
          </form>
        ) : null}
      </main>
    );
  }

  const [members, messages, groups, people] = await Promise.all([
    readGroupMembers(supabase, threadId),
    fetchMessages(supabase, threadId),
    readEventGroups(supabase, head.event_id),
    canAddToGroup(head.my_kind, head.is_member) ? readGroupPeople(supabase, head.event_id) : Promise.resolve(null),
  ]);
  await markThreadRead(threadId);

  const inGroup = new Set((members ?? []).map((m) => m.user_id));
  const candidates = (people ?? [])
    .filter((p) => !inGroup.has(p.user_id) && mayJoinGroup(head.group_kind, p.kind))
    .map((p) => ({ userId: p.user_id, firstName: p.first_name, name: p.name, role: p.kind, label: null, left: false }));

  return (
    <main className="flex min-h-[100dvh] flex-col" data-chat-takeover="" data-group-chat={head.group_kind}>
      <GroupChatView
        head={head}
        members={members}
        messages={messages}
        youId={user.id}
        backHref={back.href}
        backLabel={back.label}
        switcher={(groups ?? []).map((g) => ({
          threadId: g.thread_id,
          name: g.group_name,
          line: `${g.member_count} inside · ${groupListLine(g)}`,
          href: groupChatHref(g.thread_id),
          left: g.left_at !== null,
        }))}
        sendAction={sendGroupMessage}
        add={
          canAddToGroup(head.my_kind, head.is_member) && people !== null
            ? { candidates, add: addToGroup.bind(null, threadId) }
            : null
        }
        leave={canLeaveGroup(head.my_kind) ? leaveGroup.bind(null, threadId) : null}
      />
    </main>
  );
}
