/**
 * 💬 ONE EVENT GROUP CHAT — the same chat as the supplier's (specs DECISION_LOG 2026-11-12 "EVENT GROUP CHATS APPROVED
 * AS DRAWN"; drawing `Build_Group_Chats_2026-11-12/event-group-chats.html`, phone B). Nothing here is a second chat:
 *
 *   · the ONE `ChatBox` and `ChatThreadHead` (the head's name is a ▾ that opens your groups — a sheet of choices);
 *   · the ONE `ChatMessageStream` (hearts · double-tap files it · decisions · polls · the private look), with the group's
 *     people as its "who is on" strip — a face is a private message to that person, your own face is Leave (hosts),
 *     the ＋ adds people (hosts and the coordinator);
 *   · the ONE `ChatSendForm` — its 🔒 ticks several people; its (+) is the group's (`GroupThreadToolsSheet`: Decision ·
 *     Poll · Meeting · Photos & files, and the line that sends money to each supplier's own chat).
 *
 * Server-safe and data-in: the real page (`../page.tsx`) and the dev lab (`/dev/group-chat-lab`) both draw it. The two
 * group-only pieces (the ▾ sheet and the (+) rows) are split out with `next/dynamic`, so no other page carries them
 * (🛡 guard 5 — every new chat feature loads only when opened).
 */
import dynamic from 'next/dynamic';
import { ChatBox } from '@/app/_components/chat/chat-box';
import { ChatThreadHead } from '@/app/_components/chat/chat-thread-head';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { BackButton } from '@/app/_components/back-button';
import { CHAT_ATTACH_INPUT_ID } from '@/lib/chat-attach-input-id';
import type { ChatHost } from '@/lib/chat-hosts';
import type { ChatMessageRow } from '@/lib/chat';
import type { DealEntry } from '@/lib/deal-entry';
import type { AddableHost } from '@/app/_components/chat/chat-host-strip';
import { groupHeadLine, type GroupHead, type GroupMember, type GroupPersonKind } from '@/lib/chat-groups';
import type { SwitcherGroup } from './group-switcher';

const GroupSwitcher = dynamic(() => import('./group-switcher'));
const GroupThreadToolsSheet = dynamic(() => import('./group-plus-sheet'));

/** A group has no deal: nothing to amend, no 🧾 (quotes never go in a group). */
export const GROUP_DEAL_ENTRY: DealEntry = {
  offerDeal: false,
  composer: { reveal: [], label: 'Deal', icon: 'deal' },
  menuQuote: null,
  menuNote: null,
};

/** The strip's role word per kind — the shipped `ChatHost` shape (`stripOrder` reads `supplier` as a shop's face). */
const STRIP_ROLE: Record<GroupPersonKind, string> = {
  host: 'host',
  coordinator: 'wedding_planner_external',
  supplier: 'supplier',
  guest: 'guest',
};

/** The group's people as the shipped strip draws them — by their own first name (a private line says "only you, Rosa
 *  and Tita Lu"); a supplier's shop rides as the label and on their runs. */
export function groupStripPeople(members: readonly GroupMember[]): ChatHost[] {
  return members.map((m) => ({
    userId: m.user_id,
    firstName: m.first_name,
    name: m.name,
    role: m.kind === 'host' ? (m.role ?? STRIP_ROLE.host) : STRIP_ROLE[m.kind],
    label: m.kind === 'coordinator' ? 'Coordinator' : m.label,
  }));
}

/** Every member's first name (a supplier: their shop), so each run in the stream says who wrote it. */
export function groupSenderNames(members: readonly GroupMember[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of members) {
    const name = m.kind === 'supplier' && m.shop ? `${m.first_name ?? m.shop} · ${m.shop}` : (m.first_name ?? m.name);
    if (name) out[m.user_id] = name;
  }
  return out;
}

export function GroupChatView({
  head,
  members,
  messages,
  youId,
  backHref,
  backLabel,
  switcher,
  sendAction,
  add,
  leave,
}: {
  head: GroupHead;
  /** NULL = the members read was refused: the strip says so, never "nobody". */
  members: readonly GroupMember[] | null;
  messages: ChatMessageRow[];
  youId: string;
  backHref: string;
  backLabel: string;
  switcher: readonly SwitcherGroup[];
  sendAction: (formData: FormData) => Promise<void>;
  /** Hosts and the coordinator only — the people on the event not in this group yet, and the server action. */
  add: { candidates: readonly AddableHost[]; add: (userIds: string[], how: 'all' | 'picked') => Promise<void> } | null;
  /** Hosts only. */
  leave: ((note: string | null) => Promise<void>) | null;
}) {
  const threadId = head.thread_id;
  return (
    <ChatBox
      header={
        <ChatThreadHead
          back={<BackButton href={backHref} label={backLabel} variant="chat" />}
          name={<GroupSwitcher name={head.group_name} currentId={threadId} groups={switcher} />}
          initials={head.group_kind === 'general' ? 'All' : head.group_name.slice(0, 2).toUpperCase()}
          line={<span data-group-head-line="">{groupHeadLine(head)}</span>}
          actions={null}
        />
      }
      composer={
        <ChatSendForm
          threadId={threadId}
          sendAction={sendAction}
          lead={<GroupThreadToolsSheet threadId={threadId} />}
          attachInputId={CHAT_ATTACH_INPUT_ID}
          userId={youId}
        />
      }
    >
      <ChatMessageStream
        flush
        // A group books nothing. Kept FIRST: the handshake guard reads the tag only up to the first "/>".
        lockHandshake={null}
        dealEntry={GROUP_DEAL_ENTRY}
        threadId={threadId}
        initialMessages={messages}
        currentUserId={youId}
        // 💬 Everyone reads a group from the people's side: whose bubble it is goes by WHO wrote it
        // (`ownsBubble` — a group line has no supplier), and every other run carries its writer's name.
        viewerRole="couple"
        hosts={members === null ? null : groupStripPeople(members)}
        stripWord="Group chat"
        {...(add ? { memberAdd: add } : {})}
        {...(leave ? { memberLeave: leave } : {})}
        counterpartyLabel={head.group_name}
        senderNames={members === null ? {} : groupSenderNames(members)}
      />
    </ChatBox>
  );
}
