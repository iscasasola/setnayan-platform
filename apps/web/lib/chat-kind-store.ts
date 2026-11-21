'use client';

/**
 * 💬 THE CHAT'S KIND FILTER, SHARED — the chips sit in the text box (the composer the PAGE renders), the filtered cards
 * and their counts in the stream, and the strip's Decisions box above both. Three subtrees of one chat, so — like the
 * (+) (`chat-plus-store.ts`) — one tiny store per thread instead of a provider threaded through a 2,600-line server page.
 *
 *   · `view`       the picked chip (`?view=`); `all` = no filter. Written by the chips, read by the stream.
 *   · `counts`     how many rows of each kind the chat holds — published by the stream; null until it has counted.
 *   · `waiting`    decisions waiting on the reader — the strip's Decisions box. `undefined` = not counted yet;
 *                  `null` = some cards could not be loaded, so the count is not known (never drawn as 0).
 *   · `deal`       a tick: the strip's Deal box asks the chat to raise Every version.
 *   · `talk`       how many typed messages (Chat) and private lines (Private) the reader sees — the two chips that are
 *                  not a kind of card (20 Nov 2026). null until the stream has counted.
 */
import { useSyncExternalStore } from 'react';
import type { KindCounts, TalkCounts } from './chat-kinds';
import { withThreadView, type ThreadView } from './thread-view';

export type KindState = {
  view: ThreadView;
  counts: KindCounts | null;
  waiting: number | null | undefined;
  deal: number;
  talk: TalkCounts | null;
};

const EMPTY: KindState = { view: 'all', counts: null, waiting: undefined, deal: 0, talk: null };
const states = new Map<string, KindState>();
const listeners = new Map<string, Set<() => void>>();

export function readKinds(threadId: string): KindState {
  return states.get(threadId) ?? EMPTY;
}

function sameCounts(a: KindCounts | null, b: KindCounts | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.decisions === b.decisions && a.forms === b.forms && a.money === b.money && a.dates === b.dates && a.files === b.files;
}

export function patchKinds(threadId: string, patch: Partial<KindState>): void {
  const prev = readKinds(threadId);
  const next = { ...prev, ...patch };
  const sameTalk = next.talk === prev.talk || (!!next.talk && !!prev.talk && next.talk.chat === prev.talk.chat && next.talk.private === prev.talk.private);
  if (next.view === prev.view && sameCounts(next.counts, prev.counts) && next.waiting === prev.waiting && next.deal === prev.deal && sameTalk) return;
  states.set(threadId, next);
  listeners.get(threadId)?.forEach((l) => l());
}

/** Pick a chip: the stream filters, and the address says so (`?view=`, written in place — no request, no history entry). */
export function pickKind(threadId: string, view: ThreadView): void {
  patchKinds(threadId, { view });
  try {
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', withThreadView(here, view));
  } catch {
    // A blocked history API costs the address, never the filter itself.
  }
}

/** The strip's Deal box: ask the chat to raise Every version. */
export function raiseDeal(threadId: string): void {
  patchKinds(threadId, { deal: readKinds(threadId).deal + 1 });
}

function subscribe(threadId: string, fn: () => void): () => void {
  let set = listeners.get(threadId);
  if (!set) listeners.set(threadId, (set = new Set()));
  set.add(fn);
  return () => set!.delete(fn);
}

export function useKinds(threadId: string): KindState {
  return useSyncExternalStore(
    (fn) => subscribe(threadId, fn),
    () => readKinds(threadId),
    () => EMPTY,
  );
}
