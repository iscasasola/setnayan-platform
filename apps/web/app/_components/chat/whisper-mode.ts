'use client';

/**
 * 🤫 IS THE BOX ON WHISPER, per thread — the one piece of state the composer (`ChatSendForm`) and the stream
 * (`ChatMessageStream`, a sibling in the `ChatBox`) share, the same way they share who a private line is to
 * (`private-to.ts`). The composer's drag sets it; the stream reads it to keep a whisperer's typing OFF the chat's own
 * presence channel (the supplier is on that one) and to give the faded "Sending…" bubble its whisper strip.
 *
 * It stays on until the box is dragged again (DECISION_LOG 2026-11-19 "MESSAGE ⇄ WHISPER APPROVED"); a reload starts on
 * Message.
 *
 * ⌨ TYPING, WHISPERED: `sendWhisperTyping` hands "I am typing a whisper" to whoever holds the event TEAM's private
 * channel (`event-team-presence-join.ts` registers itself here) — hosts and their moderators only, by the database's
 * own predicate (`event_team_presence_can_access`). With nobody registered it goes nowhere. It is never sent on
 * `chat-presence-<thread>`.
 */
import { useSyncExternalStore } from 'react';
import type { WhisperTyping } from '@/lib/chat-whisper';

const on = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setWhisper(threadId: string, whisper: boolean): void {
  if (on.has(threadId) === whisper) return;
  if (whisper) on.add(threadId);
  else on.delete(threadId);
  emit();
}

export function readWhisper(threadId: string): boolean {
  return on.has(threadId);
}

export function subscribeWhisper(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useWhisper(threadId: string): boolean {
  return useSyncExternalStore(
    subscribeWhisper,
    () => readWhisper(threadId),
    () => readWhisper(threadId),
  );
}

type TypingSender = (payload: WhisperTyping) => void;
let typingSender: TypingSender | null = null;

/** The team channel's own door — registered while it is joined, cleared when it lets go. */
export function registerWhisperTypingSender(fn: TypingSender): () => void {
  typingSender = fn;
  return () => {
    if (typingSender === fn) typingSender = null;
  };
}

/** Tell the co-hosts (and only them) that this host is / is no longer typing a whisper in this thread. */
export function sendWhisperTyping(payload: WhisperTyping): void {
  typingSender?.(payload);
}
