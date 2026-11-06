'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PEEK_TOAST_ACTION_MS, PeekToast } from '@/app/_components/toast/peek-toast';

/** The answer as it is said while it can still be taken back — the press's own words ("Agree", "Post reply"). */
export function undoWords(pressed: string | null): string {
  const w = (pressed ?? '').replace(/\s+/g, ' ').trim();
  return w ? `${w} — done` : 'Done';
}

/**
 * ↩ EACH TASK FINISHES IN ITS ROW, WITH UNDO (owner 2026-10-28, DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING
 * IN PLACE": "each task finishes in its row (date change Agree / Can't, cancel request, review reply, Pay fee) with
 * Undo"; prototype `finish()` + the toast's Undo).
 *
 * HOW, WITHOUT A SECOND WAY TO WRITE ANYTHING: an answer pressed inside this list is HELD, not sent. Its row leaves
 * the list at once (finished, in place) and the shared top toast says it with **Undo** for the toast's own action
 * window (`PEEK_TOAST_ACTION_MS`). Undo puts the row back exactly as it was — nothing was written. When the window
 * closes (or the page is being left), the held form is submitted for real through its own shipped server action,
 * unchanged — `vendorAnswerDateChange`, `vendorAgreeToDeletion`, `postVendorReply`, … — and its outcome is said the
 * way it always was. So an Undo never needs an "un-answer" action, and the server never sees a press that was taken
 * back.
 *
 *   · Only a FORM is held (every answer here is a server action's form); a link (Pay the booking fee → its pay page)
 *     is a door, not an answer, and goes at once.
 *   · A form marked `data-no-undo` is sent at once.
 *   · One held answer at a time: pressing a second sends the first.
 *
 * 🔒 app/vendor-dashboard/_components/tasks-finish-in-the-row.test.ts
 */
export function UndoableAnswers({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const held = useRef<{ form: HTMLFormElement; submitter: HTMLElement | null; row: HTMLElement | null; timer: number } | null>(null);
  const passing = useRef<HTMLFormElement | null>(null);
  const [toast, setToast] = useState<{ n: number; words: string } | null>(null);

  const send = useCallback(() => {
    const h = held.current;
    if (!h) return;
    held.current = null;
    window.clearTimeout(h.timer);
    passing.current = h.form;
    // The form's own submit, with its own button — the shipped action, the shipped fields.
    if (h.submitter && (h.submitter as HTMLButtonElement).form === h.form) h.form.requestSubmit(h.submitter as HTMLButtonElement);
    else h.form.requestSubmit();
    passing.current = null;
  }, []);

  const undo = useCallback(() => {
    const h = held.current;
    if (!h) return;
    held.current = null;
    window.clearTimeout(h.timer);
    if (h.row) h.row.hidden = false;
    setToast(null);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (passing.current === form) return; // the held answer, now sent for real
      if (form.closest('[data-no-undo]')) return;
      // Capture phase, before React's own handler: hold it.
      e.preventDefault();
      e.stopPropagation();
      if (held.current) send();
      const row = (form.closest('[data-today-ask],[data-today-row-item]') as HTMLElement | null) ?? null;
      if (row) row.hidden = true;
      const submitter = (e.submitter as HTMLElement | null) ?? null;
      held.current = { form, submitter, row, timer: window.setTimeout(send, PEEK_TOAST_ACTION_MS) };
      setToast((t) => ({ n: (t?.n ?? 0) + 1, words: undoWords(submitter?.textContent ?? null) }));
    };
    el.addEventListener('submit', onSubmit, true);
    // Leaving the page sends what is held — an answer is never lost to a closed tab.
    const flush = () => send();
    const onHidden = () => document.visibilityState === 'hidden' && send();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      el.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [send]);

  return (
    <div ref={box} data-undoable-answers="">
      {children}
      {toast ? (
        <PeekToast key={toast.n} tone="ok" data="today-undo" action={{ label: 'Undo', onPress: undo }} onGone={() => setToast(null)}>
          {toast.words}
        </PeekToast>
      ) : null}
    </div>
  );
}
