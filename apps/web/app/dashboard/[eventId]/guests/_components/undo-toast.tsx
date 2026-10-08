'use client';

/**
 * undo-toast.tsx — the "undo" toast for the Living Roster (P1), now the APPROVED
 * TOAST from the top (`app/_components/toast/peek-toast.tsx`, owner 2026-10-08/09).
 *
 * Destructive/mutating roster actions no longer pop a blocking confirm dialog;
 * they apply optimistically and drop a 6-second toast with an Undo action
 * instead (owner-approved redesign). The Undo is the toast's own action pill. This is a tiny module-level store (mirrors
 * `guest-selection-store.ts`) so any client island can `pushUndo(…)` without
 * threading a context, plus ONE host mounted in page.tsx.
 *
 * The same host also says the guest list's plain results (`guestToast.error(…)`):
 * a result that must outlive the component that raised it — "Could not undo", a
 * refused delete — is said here, where the page stays mounted, not by a hook in
 * a sheet that has already closed. This is SEPARATE from the app-wide
 * `useToast()` primitive; it owns the Undo affordance + its 6s window.
 * Only one toast is live at a time — a new push replaces the previous
 * (its window is already spent visually), matching the prototype's single-toast
 * model.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PeekToast, type PeekToastTone } from '@/app/_components/toast/peek-toast';

const UNDO_WINDOW_MS = 6000;

type UndoToast =
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

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The toast on screen, read-only — exported so the guard can watch the window close. */
export function getUndoToast(): UndoToast | null {
  return current;
}

function getSnapshot() {
  return current;
}

/**
 * The single toast host. Mount ONCE (page.tsx). Renders nothing when idle.
 * The approved toast (`PeekToast`) peeks down from the top, stays the undo
 * window (6 s) while it carries Undo, and announces itself; Undo is its action
 * pill — a real, keyboard-reachable button — and runs the SAME `runUndo`.
 * Drawn on <body>: the dashboard page sits in a transformed box, inside which
 * `position: fixed` is not the screen.
 */
export function UndoToastHost() {
  const toast = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);
  if (!toast || !body) return null;
  return createPortal(
    toast.kind === 'undo' ? (
      <PeekToast
        key={toast.id}
        tone="ok"
        data="undo"
        action={{ label: toast.state === 'undoing' ? 'Undoing…' : 'Undo', onPress: runUndo }}
        onGone={() => {
          if (current?.kind === 'undo' && current.id === toast.id) set(null);
        }}
      >
        {toast.label}
      </PeekToast>
    ) : (
      <PeekToast
        key={toast.id}
        tone={toast.tone}
        data="say"
        onGone={() => {
          if (current?.id === toast.id) set(null);
        }}
      >
        {toast.words}
      </PeekToast>
    ),
    body,
  );
}
