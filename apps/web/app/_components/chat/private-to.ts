'use client';

/**
 * 🔒 WHO THE NEXT MESSAGE IS PRIVATE TO, per thread — the one piece of state the host strip (inside the stream) and the
 * composer (`ChatSendForm`, a sibling in the `ChatBox`) share. A tiny external store, so neither the server pages nor the
 * box need a provider: the composer’s 🔒 sets it, the × inside the message box clears it. It stays on until
 * cleared (DECISION_LOG 2026-11-09 🔒: "until cleared"); a reload starts with everyone.
 *
 * 🔒 TWO DOORS, SEVERAL PEOPLE (owner, 12 Nov — DECISION_LOG "PRIVATE MESSAGES — TWO DOORS, SEVERAL PEOPLE"; it
 * reverses the 11 Nov "one icon" door): a FACE in the "who is on" strip = a private message to that one person; the
 * composer's 🔒 = a list with ticks, several people. Both land here as ONE list. The strip publishes WHO IS IN THIS
 * CHAT here (`setChatPeople`, you excluded) so the composer's 🔒 lists exactly the faces the strip draws — one list,
 * never a second read. The stream publishes who a REPLY goes to (`setPrivateReply` — the sender and the other
 * recipients of the newest private line written to you, owner 12 Nov "a reply goes back to the same people"), and the
 * 🔒 opens with them ticked.
 */
import { useSyncExternalStore } from 'react';
import type { PrivateTo } from '@/lib/chat-private';

const byThread = new Map<string, readonly PrivateTo[]>();
const replyByThread = new Map<string, readonly string[]>();
const peopleByThread = new Map<string, readonly PrivateTo[]>();
const NOBODY: readonly PrivateTo[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** One person (a face) or several (the 🔒's ticks); `null` or `[]` = back to everyone. */
export function setPrivateTo(threadId: string, to: PrivateTo | readonly PrivateTo[] | null): void {
  const list = to === null ? [] : Array.isArray(to) ? (to as readonly PrivateTo[]) : [to as PrivateTo];
  const unique = list.filter((p, i) => list.findIndex((q) => q.userId === p.userId) === i);
  if (unique.length > 0) byThread.set(threadId, unique);
  else byThread.delete(threadId);
  emit();
}

/** Who the next message is private to — a list of one or more, or `null` for everyone. */
export function readPrivateTo(threadId: string): readonly PrivateTo[] | null {
  return byThread.get(threadId) ?? null;
}

/** 🔁 The stream's answer to "who would a reply go to" (user ids), or null. Emits only when it changed. */
export function setPrivateReply(threadId: string, ids: readonly string[] | null): void {
  const was = replyByThread.get(threadId) ?? null;
  const next = ids && ids.length > 0 ? ids : null;
  if (was === next || (was && next && was.length === next.length && was.every((id, i) => id === next[i]))) return;
  if (next) replyByThread.set(threadId, next);
  else replyByThread.delete(threadId);
  emit();
}

export function readPrivateReply(threadId: string): readonly string[] | null {
  return replyByThread.get(threadId) ?? null;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePrivateReply(threadId: string): readonly string[] | null {
  return useSyncExternalStore(
    subscribe,
    () => readPrivateReply(threadId),
    () => readPrivateReply(threadId),
  );
}

export function usePrivateTo(threadId: string): readonly PrivateTo[] | null {
  return useSyncExternalStore(
    subscribe,
    () => readPrivateTo(threadId),
    () => readPrivateTo(threadId),
  );
}

/** The strip's people (you excluded), for the composer's 🔒 list. Only emits when the list actually changed. */
export function setChatPeople(threadId: string, people: readonly PrivateTo[]): void {
  const was = peopleByThread.get(threadId) ?? NOBODY;
  if (was.length === people.length && was.every((p, i) => p.userId === people[i]?.userId && p.name === people[i]?.name)) return;
  if (people.length) peopleByThread.set(threadId, people);
  else peopleByThread.delete(threadId);
  emit();
}

export function readChatPeople(threadId: string): readonly PrivateTo[] {
  return peopleByThread.get(threadId) ?? NOBODY;
}

export function useChatPeople(threadId: string): readonly PrivateTo[] {
  return useSyncExternalStore(
    subscribe,
    () => readChatPeople(threadId),
    () => readChatPeople(threadId),
  );
}
