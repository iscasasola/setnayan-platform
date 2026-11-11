/**
 * 💬 EVENT GROUP CHATS — the words and the shapes (specs DECISION_LOG 2026-11-12 "EVENT GROUP CHATS APPROVED AS DRAWN";
 * drawing `Build_Group_Chats_2026-11-12/event-group-chats.html`; schema: migration 20271340374819).
 *
 *   · General = the hosts + every guest whose reply is attending, no suppliers (11 Nov).
 *   · One group per role from the guest list (the shipped role → group map, `lib/role-groups.ts`).
 *   · Groups a host makes ("Day-of crew") — hosts, the coordinator, guests and the event's suppliers may be in them.
 *   · Quotes, payments and forms never go inside a group: a group's (+) and "/" carry Decision · Poll · Meeting ·
 *     Photos & files only and point money to the supplier's own chat (`groupPlusRows`, lib/chat-plus.ts).
 *   · Hosts + the coordinator add; hosts leave (their own face); a supplier never adds and never leaves.
 *
 * WHO is in a group is the database's answer (`chat_group_member_ids`); this file never re-decides it. PURE apart from
 * the typed reads at the bottom, which go through the caller's own session and the members-only functions.
 * 🔒 lib/event-group-chats.test.ts · tests/db/event-group-chats-and-a-private-line-to-several.db.test.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ROLE_LABELS, type GuestRole } from './guests';
import { ROLE_GROUP_LABELS, roleGroupOf, type RoleGroup } from './role-groups';
import { logQueryError } from './supabase/error-detect';

export type GroupKind = 'general' | 'role' | 'made';
/** Who a person is on the event (`chat_group_person_kind`). */
export type GroupPersonKind = 'host' | 'coordinator' | 'supplier' | 'guest';

/** One row of the Chats list's Groups section (`chat_group_list`). */
export type GroupListRow = {
  thread_id: string;
  group_kind: GroupKind;
  group_name: string;
  group_key: string | null;
  made_by_name: string | null;
  member_count: number;
  /** Set = you left it: the row stays, greyed, and its words are not read. */
  left_at: string | null;
  last_body: string | null;
  last_at: string | null;
  last_sender_name: string | null;
  last_is_private: boolean | null;
  unread: boolean;
};

/** One group's head (`chat_group_head`). */
export type GroupHead = {
  thread_id: string;
  event_id: string;
  group_kind: GroupKind;
  group_name: string;
  made_by_name: string | null;
  member_count: number;
  my_kind: GroupPersonKind | null;
  is_member: boolean;
  left_at: string | null;
  left_note: string | null;
};

/** One person in a group (`chat_group_members`). */
export type GroupMember = {
  user_id: string;
  first_name: string | null;
  name: string | null;
  role: string | null;
  label: string | null;
  kind: GroupPersonKind;
  shop: string | null;
};

/** The one refusal a file gets in a group for now (the (+) row says "Not open in group chats yet"). */
export const GROUP_FILES_NOT_YET = 'Photos and files are not open in group chats yet — send words, or send it in a supplier’s chat.';

/** Where every group chat opens, for every person in it (a host, a guest, a supplier, the coordinator). */
export function groupChatHref(threadId: string): string {
  return `/chat-groups/${threadId}`;
}

/** The "+ New group" page for one event (hosts only — the page itself re-checks). */
export function newGroupHref(eventId: string): string {
  return `/chat-groups/new?event=${eventId}`;
}

/**
 * ‹ — where a group chat goes back to, per visit (lib/page-home.ts: `computed`, by this function): a host or the
 * coordinator → the event's Chats (where the Groups section is); a supplier → their Chats; a guest → their events.
 */
export function groupChatBack(me: GroupPersonKind | null, eventId: string): { href: string; label: string } {
  if (me === 'host' || me === 'coordinator') return { href: `/dashboard/${eventId}/messages`, label: 'Chats' };
  if (me === 'supplier') return { href: '/vendor-dashboard/messages', label: 'Chats' };
  return { href: '/dashboard', label: 'Home' };
}

/** The row's second line in the Chats list — the drawing's words. */
export function groupListLine(row: Pick<GroupListRow, 'group_kind' | 'made_by_name'>): string {
  if (row.group_kind === 'general') return 'Hosts + everyone attending';
  if (row.group_kind === 'role') return 'From the guest list';
  return row.made_by_name ? `Made by ${row.made_by_name}` : 'A group a host made';
}

/** The head's line under the name: "148 inside · made by Ana" · "12 inside · from the guest list". */
export function groupHeadLine(head: Pick<GroupHead, 'group_kind' | 'member_count' | 'made_by_name'>): string {
  const inside = `${head.member_count} inside`;
  if (head.group_kind === 'general') return `${inside} · hosts + everyone attending`;
  if (head.group_kind === 'role') return `${inside} · from the guest list`;
  return head.made_by_name ? `${inside} · made by ${head.made_by_name}` : inside;
}

/** The last line, as the list shows it: "Carlo: See you all Saturday!" · "You: …" (the database says "You") · a private
 *  line wears 🔒 (the database only ever returns a line this reader may read). */
export function groupListPreview(row: Pick<GroupListRow, 'last_body' | 'last_sender_name' | 'last_is_private'>): string {
  if (!row.last_body) return '';
  const body = row.last_is_private ? `🔒 ${row.last_body}` : row.last_body;
  return row.last_sender_name ? `${row.last_sender_name}: ${body}` : body;
}

/** May this person add people to a group? Hosts and the coordinator, and only from inside it. */
export function canAddToGroup(me: GroupPersonKind | null, isMember: boolean): boolean {
  return isMember && (me === 'host' || me === 'coordinator');
}

/** May this person leave? Hosts only (a supplier, the coordinator and a guest stay — as in the supplier chat). */
export function canLeaveGroup(me: GroupPersonKind | null): boolean {
  return me === 'host';
}

/** Who may be put in a group: General never takes a supplier (11 Nov); a made group takes anyone on the event. */
export function mayJoinGroup(kind: GroupKind, person: GroupPersonKind): boolean {
  return !(kind === 'general' && person === 'supplier');
}

/** The role groups that are not chats of their own: the couple and the honoree are the hosts. */
const NOT_A_CHAT_GROUP: ReadonlySet<RoleGroup | 'guest'> = new Set(['guest', 'couple', 'honoree', 'wedding_party']);

export type RoleGroupChat = { key: RoleGroup; name: string; roles: GuestRole[] };

/**
 * One group chat per role group that someone on the guest list holds (role or extra role), named by the shipped
 * `ROLE_GROUP_LABELS`, carrying EVERY guest role of that group so a guest who takes the role later is in it at once.
 */
export function roleGroupChats(held: ReadonlyArray<GuestRole | null | undefined>): RoleGroupChat[] {
  const present = new Set<RoleGroup>();
  for (const r of held) {
    if (!r) continue;
    const g = roleGroupOf(r);
    if (!NOT_A_CHAT_GROUP.has(g)) present.add(g as RoleGroup);
  }
  const all = Object.keys(ROLE_LABELS) as GuestRole[];
  return (Object.keys(ROLE_GROUP_LABELS) as RoleGroup[])
    .filter((g) => present.has(g))
    .map((g) => ({ key: g, name: ROLE_GROUP_LABELS[g], roles: all.filter((r) => roleGroupOf(r) === g) }));
}

// ── reads (the caller's own session; every function answers members only) ──

/** `null` = the read failed — said as such, never as "no groups". */
export async function readEventGroups(supabase: SupabaseClient, eventId: string): Promise<GroupListRow[] | null> {
  const { data, error } = await supabase.rpc('chat_group_list', { p_event_id: eventId });
  if (error) {
    logQueryError('readEventGroups (chat_group_list)', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  return (data ?? []) as GroupListRow[];
}

export async function readGroupHead(supabase: SupabaseClient, threadId: string): Promise<GroupHead | null | 'unread'> {
  const { data, error } = await supabase.rpc('chat_group_head', { p_thread_id: threadId });
  if (error) {
    logQueryError('readGroupHead (chat_group_head)', error, { thread_id: threadId }, 'graceful_degrade');
    return 'unread';
  }
  const rows = (data ?? []) as GroupHead[];
  return rows[0] ?? null;
}

/** `null` = refused (said so on the strip); `[]` = nobody (only ever for a non-member). */
export async function readGroupMembers(supabase: SupabaseClient, threadId: string): Promise<GroupMember[] | null> {
  const { data, error } = await supabase.rpc('chat_group_members', { p_thread_id: threadId });
  if (error) {
    logQueryError('readGroupMembers (chat_group_members)', error, { thread_id: threadId }, 'graceful_degrade');
    return null;
  }
  return (Array.isArray(data) ? data : []) as GroupMember[];
}

/** A person on the event a host or the coordinator may put in a group (`chat_group_people`). */
export type GroupPerson = { user_id: string; first_name: string | null; name: string | null; kind: GroupPersonKind };

/** `null` = refused (the ＋ is not drawn rather than drawn empty). Hosts and the coordinator only. */
export async function readGroupPeople(supabase: SupabaseClient, eventId: string): Promise<GroupPerson[] | null> {
  const { data, error } = await supabase.rpc('chat_group_people', { p_event_id: eventId });
  if (error) {
    logQueryError('readGroupPeople (chat_group_people)', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  return (Array.isArray(data) ? data : []) as GroupPerson[];
}

/**
 * Opens General and the event's role groups (hosts and the coordinator; every call is idempotent in the database).
 * Reads the guest list's roles through the caller's own session. Never throws: a refusal is logged and the list shows
 * what exists.
 */
export async function openEventGroups(supabase: SupabaseClient, eventId: string): Promise<void> {
  const general = await supabase.rpc('chat_group_open', { p_event_id: eventId });
  if (general.error) {
    logQueryError('openEventGroups (chat_group_open)', general.error, { event_id: eventId }, 'graceful_degrade');
    return;
  }
  const guests = await supabase.from('guests').select('role, extra_roles').eq('event_id', eventId).is('deleted_at', null);
  if (guests.error) {
    logQueryError('openEventGroups (guests roles)', guests.error, { event_id: eventId }, 'graceful_degrade');
    return;
  }
  const held: GuestRole[] = [];
  for (const g of (guests.data ?? []) as Array<{ role: GuestRole | null; extra_roles: GuestRole[] | null }>) {
    if (g.role) held.push(g.role);
    for (const x of g.extra_roles ?? []) held.push(x);
  }
  for (const r of roleGroupChats(held)) {
    const { error } = await supabase.rpc('chat_group_open_role', {
      p_event_id: eventId,
      p_key: r.key,
      p_name: r.name,
      p_roles: r.roles,
    });
    if (error) logQueryError('openEventGroups (chat_group_open_role)', error, { event_id: eventId, key: r.key }, 'graceful_degrade');
  }
}
