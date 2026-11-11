/**
 * /dev/event-group-chat-lab — EVENT GROUP CHATS on fixture data: no sign-in, no database (specs DECISION_LOG 2026-11-12
 * "EVENT GROUP CHATS APPROVED AS DRAWN"; drawing `Build_Group_Chats_2026-11-12/event-group-chats.html`). DEV-ONLY:
 * production builds 404 this route (`the-lab-never-ships.test.ts`). Sample people only — nobody real.
 *
 *   ?view=list           phone A · the Chats list's Groups section (General · role groups · a host-made group)
 *   (default)            phone B · "Day-of crew" (two suppliers, the coordinator) as Ana, a host
 *   ?g=general           General as Ana (hosts + guests attending, no suppliers)
 *   ?as=rosa | ?as=carlo the same group as Rosa (a supplier — no ＋, no Leave) · Carlo (a guest)
 *   ?left=1              a host who left: "Join this chat again?"
 *
 * The REAL `GroupChatView` (ChatBox · ChatThreadHead · ChatMessageStream · ChatSendForm), the REAL Groups section
 * (`GroupsList`); only the rows are fixtures and Send / Add / Leave are lab stand-ins that write nothing.
 */
import { notFound } from 'next/navigation';
import { GroupChatView } from '@/app/chat-groups/[threadId]/_components/group-chat-view';
import { GroupsList } from '@/app/dashboard/[eventId]/messages/_components/event-groups';
import type { ChatMessageRow } from '@/lib/chat';
import { groupChatHref, groupListLine, type GroupHead, type GroupListRow, type GroupMember, type GroupPersonKind } from '@/lib/chat-groups';

const EVENT = '00000000-0000-4000-8000-00000000e001';
const GENERAL = '00000000-0000-4000-8000-00000000c001';
const SPONSORS = '00000000-0000-4000-8000-00000000c002';
const ENTOURAGE = '00000000-0000-4000-8000-00000000c003';
const CREW = '00000000-0000-4000-8000-00000000c004';

const P = (n: number) => `00000000-0000-4000-8000-0000000001${n.toString().padStart(2, '0')}`;
const ANA = P(1);
const MIGUEL = P(2);
const LU = P(3);
const ROSA = P(4);
const JAKE = P(5);
const MARK = P(6);
const CARLO = P(7);
const NENA = P(8);
const PAOLO = P(9);

const member = (user_id: string, first: string, last: string, kind: GroupPersonKind, shop: string | null = null): GroupMember => ({
  user_id,
  first_name: first,
  name: `${first} ${last}`,
  role: null,
  label: null,
  kind,
  shop,
});
const PEOPLE: Record<string, GroupMember> = {
  [ANA]: member(ANA, 'Ana', 'Santos', 'host'),
  [MIGUEL]: member(MIGUEL, 'Miguel', 'Reyes', 'host'),
  [LU]: member(LU, 'Tita Lu', 'Villanueva', 'coordinator'),
  [ROSA]: member(ROSA, 'Rosa', 'Mendoza', 'supplier', 'Rosa’s Catering'),
  [JAKE]: member(JAKE, 'Jake', 'Lim', 'supplier', 'Lens & Light'),
  [MARK]: member(MARK, 'Mark', 'Dela Cruz', 'supplier', 'DJ Mark'),
  [CARLO]: member(CARLO, 'Carlo', 'Ramos', 'guest'),
  [NENA]: member(NENA, 'Lola Nena', 'Santos', 'guest'),
  [PAOLO]: member(PAOLO, 'Paolo', 'Reyes', 'guest'),
};

const GROUPS: Record<string, { head: Omit<GroupHead, 'my_kind' | 'is_member' | 'left_at' | 'left_note'>; members: string[] }> = {
  [GENERAL]: {
    head: { thread_id: GENERAL, event_id: EVENT, group_kind: 'general', group_name: 'General', made_by_name: null, member_count: 148 },
    members: [ANA, MIGUEL, CARLO, NENA, PAOLO],
  },
  [CREW]: {
    head: { thread_id: CREW, event_id: EVENT, group_kind: 'made', group_name: 'Day-of crew', made_by_name: 'Ana', member_count: 6 },
    members: [ANA, MIGUEL, LU, ROSA, JAKE, MARK],
  },
};

const at = (h: number, m: number) => new Date(Date.UTC(2026, 10, 12, h, m)).toISOString();
let seq = 0;
function line(thread: string, who: string | null, body: string, when: string, to: string[] | null = null): ChatMessageRow {
  seq += 1;
  const kind = who ? PEOPLE[who]!.kind : null;
  return {
    message_id: `00000000-0000-4000-8000-0000000a${seq.toString().padStart(4, '0')}`,
    thread_id: thread,
    event_id: EVENT,
    vendor_profile_id: null,
    sender_user_id: who,
    sender_role: who === null ? 'system' : kind === 'host' ? 'couple' : kind === 'supplier' ? 'vendor' : kind === 'coordinator' ? 'coordinator' : 'guest',
    body,
    created_at: when,
    recipient_user_id: to ? to[0]! : null,
    recipient_user_ids: to,
  } as unknown as ChatMessageRow;
}

const MESSAGES: Record<string, ChatMessageRow[]> = {
  [CREW]: [
    line(CREW, null, 'Ana made the group · Miguel, Tita Lu, Rosa, Jake and Mark', at(1, 50)),
    line(CREW, LU, 'Run sheet v2 is up. Load-in for everyone is 2 PM.', at(1, 52)),
    line(CREW, ROSA, 'Load-in at 2 PM works for us', at(2, 5)),
    line(CREW, JAKE, 'Same here — we’ll start with the details shots.', at(2, 7)),
    line(CREW, ANA, 'Can Mark and Tita Lu agree the first-dance cue?', at(2, 10), [MARK, LU]),
    line(CREW, MARK, 'Yes — I’ll fade in when the MC says their names.', at(2, 11), [ANA, LU]),
  ],
  [GENERAL]: [
    line(GENERAL, ANA, 'Welcome everyone! Saturday is close 🎉', at(1, 20)),
    line(GENERAL, PAOLO, 'Can I bring my lola?', at(1, 30), [ANA, MIGUEL]),
    line(GENERAL, CARLO, 'See you all Saturday!', at(1, 41)),
  ],
};

const LIST: GroupListRow[] = [
  { thread_id: GENERAL, group_kind: 'general', group_name: 'General', group_key: null, made_by_name: null, member_count: 148, left_at: null, last_body: 'See you all Saturday!', last_at: at(1, 41), last_sender_name: 'Carlo', last_is_private: false, unread: true },
  { thread_id: SPONSORS, group_kind: 'role', group_name: 'Principal Sponsors', group_key: 'principal_sponsors', made_by_name: null, member_count: 12, left_at: null, last_body: 'Thank you po for saying yes', last_at: at(0, 10), last_sender_name: 'You', last_is_private: false, unread: false },
  { thread_id: ENTOURAGE, group_kind: 'role', group_name: 'Groomsmen', group_key: 'groomsmen', made_by_name: null, member_count: 18, left_at: null, last_body: 'Barong fitting on the 20th?', last_at: at(0, 5), last_sender_name: 'Dan', last_is_private: false, unread: false },
  { thread_id: CREW, group_kind: 'made', group_name: 'Day-of crew', group_key: null, made_by_name: 'Ana', member_count: 6, left_at: null, last_body: 'Load-in at 2 PM works for us', last_at: at(2, 5), last_sender_name: 'Rosa', last_is_private: false, unread: false },
];

async function labSend(formData: FormData): Promise<void> {
  'use server';
  void formData;
  if (process.env.NODE_ENV === 'production') throw new Error('lab: not in production');
}
async function labAdd(userIds: string[]): Promise<void> {
  'use server';
  void userIds;
  if (process.env.NODE_ENV === 'production') throw new Error('lab: not in production');
}
async function labLeave(note: string | null): Promise<void> {
  'use server';
  void note;
  if (process.env.NODE_ENV === 'production') throw new Error('lab: not in production');
}

export default async function EventGroupChatLab({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  if (q.view === 'list') {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pt-4" data-lab="event-group-chats-list">
        <h2 className="font-display text-[30px] font-semibold leading-tight text-ink">Chats</h2>
        <GroupsList rows={LIST} newGroup="/chat-groups/new?event=lab" />
        <p className="py-3 text-[13px] text-ink/55">(lab) the shipped Suppliers rows continue here, unchanged.</p>
      </main>
    );
  }
  const threadId = q.g === 'general' ? GENERAL : CREW;
  const g = GROUPS[threadId]!;
  const you = q.as === 'rosa' ? ROSA : q.as === 'carlo' ? CARLO : ANA;
  const me = PEOPLE[you]!.kind;
  const isMember = q.left !== '1' && g.members.includes(you);
  const head: GroupHead = { ...g.head, my_kind: me, is_member: isMember, left_at: q.left === '1' ? at(0, 30) : null, left_note: q.left === '1' ? 'Too many pings' : null };
  if (!isMember) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6" data-group-left="">
        <h1 className="text-[20px] font-semibold text-ink">{head.group_name}</h1>
        <p className="mt-2 text-[15px] text-ink/75">Join this chat again? You left on November 12, 2026 — Too many pings.</p>
        <button type="button" className="button-primary mt-4">Join chat</button>
      </main>
    );
  }
  const members = g.members.map((id) => PEOPLE[id]!);
  const canAdd = me === 'host' || me === 'coordinator';
  const candidates = Object.values(PEOPLE)
    .filter((p) => !g.members.includes(p.user_id) && !(g.head.group_kind === 'general' && p.kind === 'supplier'))
    .map((p) => ({ userId: p.user_id, firstName: p.first_name, name: p.name, role: p.kind, label: null, left: false }));
  return (
    <main className="flex min-h-[100dvh] flex-col" data-chat-takeover="" data-lab="event-group-chat">
      <GroupChatView
        head={head}
        members={members}
        messages={MESSAGES[threadId] ?? []}
        youId={you}
        backHref="/dev/event-group-chat-lab?view=list"
        backLabel="Chats"
        switcher={LIST.map((r) => ({
          threadId: r.thread_id,
          name: r.group_name,
          line: `${r.member_count} inside · ${groupListLine(r)}`,
          href: r.thread_id === GENERAL ? '/dev/event-group-chat-lab?g=general' : r.thread_id === CREW ? '/dev/event-group-chat-lab' : groupChatHref(r.thread_id),
          left: false,
        }))}
        sendAction={labSend}
        add={canAdd ? { candidates, add: labAdd } : null}
        leave={me === 'host' ? labLeave : null}
      />
    </main>
  );
}
