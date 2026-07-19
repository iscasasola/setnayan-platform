'use client';

/**
 * undo-toast.tsx — the bottom "undo" snackbar for the Living Roster (P1).
 *
 * Destructive/mutating roster actions no longer pop a blocking confirm dialog;
 * they apply optimistically and drop a 6-second snackbar with an Undo action
 * instead (owner-approved redesign). This is a tiny module-level store (mirrors
 * `guest-selection-store.ts`) so any client island can `pushUndo(…)` without
 * threading a context, plus ONE host mounted in page.tsx.
 *
 * This is SEPARATE from the app-wide `useToast()` success/error primitive: that
 * one has no action button; this one owns the Undo affordance + its 6s window.
 * Only one undo snackbar is live at a time — a new push replaces the previous
 * (its window is already spent visually), matching the prototype's single-toast
 * model.
 */

import { useSyncExternalStore } from 'react';
import { Undo2, X } from 'lucide-react';

const UNDO_WINDOW_MS = 6000;

type UndoToast = {
  id: number;
  label: string;
  undo: () => Promise<void>;
  state: 'idle' | 'undoing';
};

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
  set({ id, label, undo, state: 'idle' });
  timer = setTimeout(() => {
    if (current?.id === id) set(null);
  }, UNDO_WINDOW_MS);
}

/** Programmatically dismiss the current snackbar (no undo). */
export function dismissUndo(): void {
  clearTimer();
  set(null);
}

async function runUndo() {
  const t = current;
  if (!t || t.state === 'undoing') return;
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

function getSnapshot() {
  return current;
}

/**
 * The single snackbar host. Mount ONCE (page.tsx). Renders nothing when idle.
 * `aria-live="polite"` announces the label; the Undo button is a real,
 * keyboard-reachable control.
 */
export function UndoToastHost() {
  const toast = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1.5rem)] z-[95] flex justify-center px-4"
    >
      <div className="gl-toast pointer-events-auto flex items-center gap-3 rounded-xl border border-ink/10 bg-paper px-4 py-2.5 text-sm text-ink shadow-lg">
        <span className="leading-snug">{toast.label}</span>
        <button
          type="button"
          onClick={runUndo}
          disabled={toast.state === 'undoing'}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-terracotta hover:bg-terracotta/10 disabled:opacity-60"
        >
          <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {toast.state === 'undoing' ? 'Undoing…' : 'Undo'}
        </button>
        <button
          type="button"
          onClick={dismissUndo}
          aria-label="Dismiss"
          className="-mr-1 rounded-md p-1 text-ink/40 hover:bg-ink/5 hover:text-ink/70"
        >
          <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
