'use client';

/**
 * The (+) and the stream are two subtrees of one chat (the (+) sits in the composer the PAGE renders; the pins and the
 * draft card sit in the stream). One tiny external store per thread lets both read the same open card without a
 * provider threaded through a 2,000-line server page. In memory only: a draft is the opener's own until Send (the
 * prototype: "not sent yet", visible to its author only); a sent card is a server row and comes back on every load.
 */
import { useSyncExternalStore } from 'react';
import type { PlusCardKind, RunningTopic } from './chat-plus';

export type PlusDraft = { kind: PlusCardKind; startedAt: number };

type State = {
  /** A draft card being filled by the reader. */
  draft: PlusDraft | null;
  /** A sent card awaiting its answer, as the stream derived it from server rows. */
  sent: RunningTopic | null;
  /** "Ask about it" / Return to chat from a blocker — the topic the chat is now about. */
  talking: { key: string; title: string } | null;
  /** One short line the (+) shows when it is shut ("Finish or close: Meeting"). */
  toast: { text: string; at: number } | null;
};

const EMPTY: State = { draft: null, sent: null, talking: null, toast: null };
const states = new Map<string, State>();
const listeners = new Map<string, Set<() => void>>();

function emit(threadId: string) {
  listeners.get(threadId)?.forEach((l) => l());
}

export function readPlus(threadId: string): State {
  return states.get(threadId) ?? EMPTY;
}

export function patchPlus(threadId: string, patch: Partial<State>): void {
  const prev = readPlus(threadId);
  const next = { ...prev, ...patch };
  if (
    next.draft === prev.draft &&
    next.sent?.key === prev.sent?.key &&
    next.sent?.status === prev.sent?.status &&
    next.talking?.key === prev.talking?.key &&
    next.toast === prev.toast
  ) {
    return;
  }
  states.set(threadId, next);
  emit(threadId);
}

function subscribe(threadId: string, fn: () => void): () => void {
  let set = listeners.get(threadId);
  if (!set) listeners.set(threadId, (set = new Set()));
  set.add(fn);
  return () => set!.delete(fn);
}

export function usePlus(threadId: string): State {
  return useSyncExternalStore(
    (fn) => subscribe(threadId, fn),
    () => readPlus(threadId),
    () => EMPTY,
  );
}

/** The DOM id of a draft card / the scroll target of a pin. */
export const PLUS_DRAFT_ANCHOR = 'chat-plus-draft';

/** Scroll a card into view and ring it for a moment (the prototype's `jump`). */
export function jumpTo(anchorId: string): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(anchorId);
  if (!el) return;
  // Scroll ONLY the conversation's own scroller — `scrollIntoView` would also scroll the page behind the chat frame and
  // push the head off screen (seen at 390 px).
  let box: HTMLElement | null = el.parentElement;
  while (box && !(box.scrollHeight > box.clientHeight && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) {
    box = box.parentElement;
  }
  if (box) {
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: Math.max(0, top - box.clientHeight / 2 + el.clientHeight / 2), behavior: reduce ? 'auto' : 'smooth' });
  }
  el.setAttribute('data-hot', '');
  window.setTimeout(() => el.removeAttribute('data-hot'), 1400);
}
