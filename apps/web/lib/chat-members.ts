/**
 * 👥 WHO IS IN A SUPPLIER CHAT — the rules the host strip's ＋ and Leave read (DECISION_LOG 2026-11-09 👥, Supplier Build 3).
 *
 * Owner: a supplier chat starts small; a host adds the event's other hosts with the strip's ＋ (one, several, or "Add
 * all"); a HOST leaves by tapping their own face. Coordinators and planners are in every supplier chat and can never
 * leave — so they never get "Leave chat" and never appear in the ＋ list (they are always in). The supplier never sees
 * the ＋ at all. The system lines say what happened, in the shared chat's system-line look.
 *
 * ⚠ WHO IS IN THIS THREAD is Lane B's thread-scoped hosts read (its migration). These rules take that list as input; they
 * read nothing themselves. TODO(Build 3 · Lane B): feed `inChatIds` / `leftIds` from that read, and post these lines
 * from its add/leave writes.
 *
 * PURE — no React, no I/O. 🔒 lib/a-supplier-chat-starts-small.test.ts
 */
import type { ChatHost } from './chat-hosts';

/** A planner / coordinator seat (`event_moderators.role_subtype`) — always in every supplier chat, never leaves. */
export const ALWAYS_IN_CHAT_ROLES: ReadonlySet<string> = new Set(['wedding_planner_external']);

export function isAlwaysInChat(role: string | null | undefined): boolean {
  return role != null && ALWAYS_IN_CHAT_ROLES.has(role);
}

/** Only a host on the event's side may leave a supplier chat — never the supplier, never a coordinator or planner. */
export function canLeaveChat(viewer: { side: 'couple' | 'vendor'; role: string | null }): boolean {
  return viewer.side === 'couple' && !isAlwaysInChat(viewer.role);
}

/** Only the event's side opens the ＋ (hosts and the coordinator) — the supplier never does. */
export function canAddToChat(viewer: { side: 'couple' | 'vendor' }): boolean {
  return viewer.side === 'couple';
}

/**
 * The ＋ list: every event host NOT in this chat now — hosts who left included (marked, so adding them reads "back") —
 * and never a coordinator or planner (always in).
 */
export function addableHosts(
  eventHosts: readonly ChatHost[],
  inChatIds: ReadonlySet<string>,
  leftIds: ReadonlySet<string>,
): (ChatHost & { left: boolean })[] {
  return eventHosts
    .filter((h) => !inChatIds.has(h.userId) && !isAlwaysInChat(h.role))
    .map((h) => ({ ...h, left: leftIds.has(h.userId) }));
}

/** "Add all" sits on top of the list only when more than one host is missing. */
export function showsAddAll(candidates: readonly unknown[]): boolean {
  return candidates.length > 1;
}

export function memberAddedLine(by: string, who: string, back: boolean): string {
  return back ? `${by} added ${who} back` : `${by} added ${who}`;
}

/** ONE line for "Add all", however many it added. */
export function everyoneAddedLine(by: string): string {
  return `${by} added everyone`;
}

/** "Marco left" — the note is NEVER in it (owner, 9 Nov: the leaving note is shown to nobody else). */
export function memberLeftLine(who: string): string {
  return `${who} left`;
}

/** "Marco joined" — a host who left and joined again from their greyed-out Chats row (owner, 9 Nov). */
export function memberJoinedLine(who: string): string {
  return `${who} joined`;
}

/**
 * 🚪 LEAVING AND JOINING AGAIN (owner, 9 Nov). Leaving takes an optional note (≤ 200) that only the leaver ever sees
 * again; the chat stays in their Chats list, greyed, never removed, and tapping it asks "Join this chat again?" with
 * "You left on Nov 9 — “note”". The date and note are Lane B's thread-member `left_at` / `left_note`.
 * `'unread'` = that read was refused: the pop-up says it could not load, never an invented date.
 */
export const LEAVE_NOTE_MAX = 200;
export type ChatLeft = { at: string; note: string | null };
export type ChatLeftRead = ChatLeft | 'unread';

const LEFT_DAY = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

/** The leave note as stored: trimmed, at most 200 characters, blank → null. */
export function leaveNoteFrom(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().slice(0, LEAVE_NOTE_MAX);
  return v ? v : null;
}

/** "You left on Nov 9, 2026 — “Too many messages”" — the note part only when there is one. */
export function leftOnLine(left: ChatLeft): string {
  const d = new Date(left.at);
  const day = Number.isNaN(d.getTime()) ? null : LEFT_DAY.format(d);
  const head = day ? `You left on ${day}` : 'You left this chat';
  return left.note ? `${head} — “${left.note}”` : head;
}

/** The supplier's own entry in a strip (the host side adds the shop under the label the page shows for it). */
export const SUPPLIER_STRIP_ROLE = 'supplier';

export type StripPerson = { userId: string; host: ChatHost | null; isYou: boolean };

/**
 * 👥 THE STRIP'S ORDER (owner, 9 Nov): the Supplier first, then the coordinator / planner(s), then You, then the other
 * hosts in the chat. A viewer who IS the supplier or a coordinator reads "You" in THAT slot — never twice. The supplier
 * viewer is not in the hosts list (the list is the event's side), so their "You" goes first. Stable within each group.
 */
export function stripOrder(hosts: readonly ChatHost[], youId: string, viewerSide: 'vendor' | 'couple'): StripPerson[] {
  const rank = (h: ChatHost): number => (h.role === SUPPLIER_STRIP_ROLE ? 0 : isAlwaysInChat(h.role) ? 1 : 3);
  const rows: { p: StripPerson; r: number; i: number }[] = hosts.map((h, i) => {
    const isYou = h.userId === youId;
    const r = rank(h);
    return { p: { userId: h.userId, host: h, isYou }, r: isYou && r === 3 ? 2 : r, i };
  });
  if (!hosts.some((h) => h.userId === youId)) {
    rows.push({ p: { userId: youId, host: null, isYou: true }, r: viewerSide === 'vendor' ? 0 : 2, i: -1 });
  }
  return rows.sort((a, b) => a.r - b.r || (a.r === 0 && a.p.isYou ? -1 : b.r === 0 && b.p.isYou ? 1 : a.i - b.i)).map((x) => x.p);
}
