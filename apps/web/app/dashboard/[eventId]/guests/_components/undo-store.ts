/**
 * undo-store.ts — THE GUEST LIST'S TOAST STORE: the Undo window and the plain results (`guestToast`), as a tiny module-level
 * store (mirrors `guest-selection-store.ts`) so any client island can `pushUndo(…)` / `guestToast.error(…)` without threading
 * a context. The host that DRAWS it is `undo-toast.tsx` (`UndoToastHost`, mounted once by each page).
 *
 * ⚡ SPLIT FROM THE HOST ON PURPOSE (2026-10-09, step 4A). The guest card's autosave imports `pushUndo`, and the card is drawn
 * inside the Event Hub Maker's FIRST LOAD (`launch/page.tsx` → `GuestCardBody`), which has ~0.1 KB of room
 * (`check-maker-js-budget.mjs`). While store and host shared one file the card pulled in the host — and with 2B the host drew
 * `PeekToast` and a portal. Here there is no React, no portal and no toast drawing: only the store. A TYPE-only import of the
 * toast's tone is erased. Held by `the-guest-card-adds-no-first-load-weight.test.ts`.
 */

import type { PeekToastTone } from '@/app/_components/toast/peek-toast';

const UNDO_WINDOW_MS = 6000;

export type UndoToast =
  | {
      kind: 'undo';
      id: number;
      label: string;
      undo: () => Promise<void>;
      /* 'expired' — the window has closed: Undo does nothing, and the toast is on its way out (it leaves like any other). */
      state: 'idle' | 'undoing' | 'expired';
    }
  | { kind: 'say'; id: number; tone: PeekToastTone; words: string };

let current: UndoToast | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(next: UndoToast | null) {
  current = next;
  emit();
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * Show an undo snackbar. `undo` runs when the host clicks Undo; it should perform
 * the inverse server write (e.g. restore soft-deleted guests + their seats).
 */
export function pushUndo({
  label,
  undo,
}: {
  label: string;
  undo: () => Promise<void>;
}): void {
  clearTimer();
  seq += 1;
  const id = seq;
  set({ kind: 'undo', id, label, undo, state: 'idle' });
  timer = setTimeout(() => {
    /* The window closes HERE — but the toast is not torn down: it slides back up like every other PeekToast (its own
       6 s ends at the same moment) and the host clears it once it has gone. Until then Undo is a no-op. */
    if (current?.kind === 'undo' && current.id === id) set({ ...current, state: 'expired' });
  }, UNDO_WINDOW_MS);
}

function say(tone: PeekToastTone, words: string): void {
  clearTimer();
  seq += 1;
  set({ kind: 'say', id: seq, tone, words });
}

/** The guest list's plain results, said with the approved toast — same words as the old `useToast()` calls. */
export const guestToast = {
  success: (words: string) => say('ok', words),
  error: (words: string) => say('bad', words),
  info: (words: string) => say('note', words),
} as const;

/** Programmatically dismiss the current snackbar (no undo). */
export function dismissUndo(): void {
  clearTimer();
  set(null);
}

/** Undo's own handler — exported so the guard can press it. */
export async function runUndo() {
  const t = current;
  if (!t || t.kind !== 'undo' || t.state !== 'idle') return;
  clearTimer();
  set({ ...t, state: 'undoing' });
  try {
    await t.undo();
  } finally {
    // Only clear if this is still the toast we started undoing (a newer push
    // during the await would have replaced it).
    if (current?.id === t.id) set(null);
  }
}

/** The host's subscription — `useSyncExternalStore` wants a subscribe and a snapshot. */
export function subscribeUndo(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The toast on screen, read-only. */
export function getUndoToast(): UndoToast | null {
  return current;
}

/** The host clears a toast once it has finished leaving (and only that toast — a newer one may have replaced it). */
export function clearUndoToast(id: number): void {
  if (current?.id === id) set(null);
}
