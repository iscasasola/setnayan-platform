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

export function memberLeftLine(who: string): string {
  return `${who} left`;
}
