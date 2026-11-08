'use client';

/**
 * 🔒 WHO THE NEXT MESSAGE IS PRIVATE TO, per thread — the one piece of state the host strip (inside the stream) and the
 * composer (`ChatSendForm`, a sibling in the `ChatBox`) share. A tiny external store, so neither the server pages nor the
 * box need a provider: the strip's **Message privately** sets it, the composer's chip × clears it. It stays on until
 * cleared (DECISION_LOG 2026-11-09 🔒: "until cleared"); a reload starts with everyone.
 */
import { useSyncExternalStore } from 'react';
import type { PrivateTo } from '@/lib/chat-private';

const byThread = new Map<string, PrivateTo>();
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
