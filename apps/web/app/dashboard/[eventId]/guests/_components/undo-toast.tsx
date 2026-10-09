'use client';

/**
 * undo-toast.tsx — the "undo" toast for the Living Roster (P1), now the APPROVED
 * TOAST from the top (`app/_components/toast/peek-toast.tsx`, owner 2026-10-08/09).
 *
 * Destructive/mutating roster actions no longer pop a blocking confirm dialog;
 * they apply optimistically and drop a 6-second toast with an Undo action
 * instead (owner-approved redesign). The Undo is the toast's own action pill. The store is `undo-store.ts`; this file is the ONE host
 * each page mounts.
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
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { clearUndoToast, getUndoToast, runUndo, subscribeUndo } from './undo-store';

/**
 * The single toast host. Mount ONCE (page.tsx). Renders nothing when idle.
 * The approved toast (`PeekToast`) peeks down from the top, stays the undo
 * window (6 s) while it carries Undo, and announces itself; Undo is its action
 * pill — a real, keyboard-reachable button — and runs the SAME `runUndo`.
 * Drawn on <body>: the dashboard page sits in a transformed box, inside which
 * `position: fixed` is not the screen.
 */
export function UndoToastHost() {
  const toast = useSyncExternalStore(subscribeUndo, getUndoToast, () => null);
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
          clearUndoToast(toast.id);
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
          clearUndoToast(toast.id);
        }}
      >
        {toast.words}
      </PeekToast>
    ),
    body,
  );
}
