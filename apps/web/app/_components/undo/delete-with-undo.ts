/**
 * delete-with-undo.ts — EVERY ROW'S DELETE KEEPS AN UNDO (owner 2026-11-03, "SWIPE LEFT TO DELETE ON EVERY LIST ROW").
 *
 * Most rows outside the guest list delete for good (a DELETE, no soft-delete column, no restore action). Rather than a
 * migration and a restore action per area, the delete WAITS for the Undo window:
 *
 *   1. the row hides at once (`hide`) and the approved toast says "<label> · Undo";
 *   2. Undo inside the window → the row comes back (`restore`) and nothing was ever written;
 *   3. the window closes → the delete is written (`commit`); a refusal brings the row back AND says why;
 *   4. the page is left before the window closes → the delete is written then (`pagehide`), never dropped.
 *
 * An area that already HAS a restore (guests: `restoreDeletedGuests`) keeps writing at once and undoing with it —
 * `pushUndo` straight from the store. This is for the rest.
 *
 * The toast is the guest list's shipped one (store `undo-store.ts`, host `UndoToastHost`) — one Undo toast, not two:
 * a page that uses this mounts `<UndoToastHost />` (guests/_components/undo-toast.tsx) once.
 */

import { guestToast, pushUndo, UNDO_WINDOW_MS } from '@/app/dashboard/[eventId]/guests/_components/undo-store';

/** What a commit may answer: nothing / `{ ok: true }` is done; `{ ok: false, error }` or a throw is a refusal. */
export type CommitResult = void | { ok: true } | { ok: false; error?: string | null } | { error: string };

type Pending = { commit: () => Promise<void> };
const pending = new Set<Pending>();
let listening = false;

function flushAll() {
  for (const p of [...pending]) void p.commit();
}

function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pagehide', flushAll);
}

function refusalOf(r: CommitResult): string | null {
  if (!r || typeof r !== 'object') return null;
  if ('ok' in r) return r.ok ? null : r.error || 'refused';
  if ('error' in r && r.error) return r.error;
  return null;
}

/**
 * Hide now, write after the Undo window. Returns a `flush` that writes at once (tests; a caller about to navigate).
 *
 * @param label  what the toast says — "Lights deleted", "2 lines removed".
 * @param failed what is said if the write is refused — plain words, never the database's.
 */
export function deleteWithUndo({
  label,
  hide,
  restore,
  commit,
  failed = 'Couldn’t delete that. It’s back — try again.',
  windowMs = UNDO_WINDOW_MS,
}: {
  label: string;
  hide: () => void;
  restore: () => void;
  commit: () => Promise<CommitResult> | CommitResult;
  failed?: string;
  windowMs?: number;
}): { flush: () => Promise<void> } {
  listen();
  hide();
  let done = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const entry: Pending = {
    commit: async () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      pending.delete(entry);
      try {
        const r = await commit();
        if (refusalOf(r)) {
          restore();
          guestToast.error(failed);
        }
      } catch {
        restore();
        guestToast.error(failed);
      }
    },
  };
  pending.add(entry);
  // A hair past the toast's own window, so Undo is never pressed into a write already sent.
  timer = setTimeout(() => void entry.commit(), windowMs + 250);

  pushUndo({
    label,
    undo: async () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      pending.delete(entry);
      restore();
    },
  });

  return { flush: entry.commit };
}

/** Deletes still waiting for their window (tests). */
export function pendingDeleteCount(): number {
  return pending.size;
}
