'use client';

/**
 * The (+) and the stream are two subtrees of one chat (the (+) sits in the composer the PAGE renders; the pins and the
 * draft card sit in the stream). One tiny external store per thread lets both read the same open card without a
 * provider threaded through a 2,000-line server page. In memory only: a draft is the opener's own until Send (the
 * prototype: "not sent yet", visible to its author only); a sent card is a server row and comes back on every load.
 */
import { useSyncExternalStore } from 'react';
import type { PlusCardKind, RunningTopic, SlashRow } from './chat-plus';

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
  /** 🗳 A poll is open in this chat (its card in the stream says so) — the (+)'s Poll row and `/poll` go grey. */
  pollOpen: boolean;
  /** ⌨ The slash list = the (+)'s own card rows, as the (+) on this chat draws them (it publishes them here). */
  slash: readonly SlashRow[];
};

const EMPTY: State = { draft: null, sent: null, talking: null, toast: null, pollOpen: false, slash: [] };
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
    next.toast === prev.toast &&
    next.pollOpen === prev.pollOpen &&
    next.slash === prev.slash
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

/** The scroll position that centres a target (`top` from the scroller's start, `height` tall) in a `view`-tall box. */
export function centredScrollTop(top: number, height: number, view: number): number {
  return Math.max(0, Math.round(top - view / 2 + Math.min(height, view) / 2));
}

/** Is a box (its top and bottom against the screen) wholly on a `view`-tall screen? */
export function inViewport(top: number, bottom: number, view: number): boolean {
  return top >= 0 && bottom <= view;
}

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
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const behavior = reduce ? 'auto' : 'smooth';
  const rect = el.getBoundingClientRect();
  if (box) {
    const top = rect.top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({ top: centredScrollTop(top, el.clientHeight, box.clientHeight), behavior });
  } else if (!inViewport(rect.top, rect.bottom, window.innerHeight)) {
    // 📍 CHAT-25 (walk 16 Nov 2026): on a chat whose PAGE is the scroller (the couple's, at 390 px) there is no
    // conversation scroller to move, and the new card sat at y≈1114 of an 844-px screen. Then the page itself scrolls.
    window.scrollTo({ top: centredScrollTop(rect.top + window.scrollY, el.clientHeight, window.innerHeight), behavior });
  }
  el.setAttribute('data-hot', '');
  window.setTimeout(() => el.removeAttribute('data-hot'), 1400);
}
