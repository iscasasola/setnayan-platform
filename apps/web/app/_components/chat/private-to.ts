'use client';

/**
 * 🔒 WHO THE NEXT MESSAGE IS PRIVATE TO, per thread — the one piece of state the host strip (inside the stream) and the
 * composer (`ChatSendForm`, a sibling in the `ChatBox`) share. A tiny external store, so neither the server pages nor the
 * box need a provider: a face in the strip (or the composer’s 🔒, or Reply privately) sets it, the × inside the message box clears it. It stays on until
 * cleared (DECISION_LOG 2026-11-09 🔒: "until cleared"); a reload starts with everyone.
 *
 * 🔒 THREE DOORS, ONE CHIP (owner, 9 Nov: "they can also send private message anytime"): a face in the strip · the
 * composer's 🔒 (a list of the people in this chat) · "Reply privately" in a message's press-and-hold menu. The strip
 * publishes WHO IS IN THIS CHAT here (`setChatPeople`, you excluded) so the composer's 🔒 lists exactly the faces the
 * strip draws — one list, never a second read.
 */
import { useSyncExternalStore } from 'react';
import type { PrivateTo } from '@/lib/chat-private';

const byThread = new Map<string, PrivateTo>();
const peopleByThread = new Map<string, readonly PrivateTo[]>();
const NOBODY: readonly PrivateTo[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setPrivateTo(threadId: string, to: PrivateTo | null): void {
  if (to) byThread.set(threadId, to);
  else byThread.delete(threadId);
  emit();
}

export function readPrivateTo(threadId: string): PrivateTo | null {
  return byThread.get(threadId) ?? null;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePrivateTo(threadId: string): PrivateTo | null {
  return useSyncExternalStore(
    subscribe,
    () => readPrivateTo(threadId),
    () => readPrivateTo(threadId),
  );
}

/** The strip's people (you excluded), for the composer's 🔒 list. Only emits when the list actually changed. */
export function setChatPeople(threadId: string, people: readonly PrivateTo[]): void {
  const was = peopleByThread.get(threadId) ?? NOBODY;
  if (was.length === people.length && was.every((p, i) => p.userId === people[i].userId && p.name === people[i].name)) return;
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
