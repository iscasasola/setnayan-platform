'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal confirmation dialog backed by the HTML5 `<dialog>` element so the
 * browser handles focus trap, ESC key, ARIA `role="dialog"` semantics, and
 * inert-background scrolling natively. Replaces 18 native `window.confirm()`
 * + `window.alert()` callsites flagged by the pre-pilot audit 2026-05-30
 * which violated brand voice + blocked UI on the synchronous OS dialog.
 *
 * Two surfaces:
 *
 *   1. `<ConfirmDialog>` — presentational component. Caller owns the `open`
 *      flag + onConfirm / onCancel handlers. Use when the caller already has
 *      a state machine that knows when the dialog should be visible.
 *
 *   2. `useConfirm()` — hook that returns `{ confirm, dialog }` where
 *      `confirm()` returns a `Promise<boolean>` so callsites can write
 *      `if (!(await confirm({ title, body }))) return;` and the dialog
 *      element renders inline via `{dialog}`. Use when the caller wants
 *      window.confirm() ergonomics without the OS modal.
 *
 * Brand voice locks per [[feedback_setnayan_no_dev_text_post_launch]]:
 *   • `title` reads as a polite question or statement (e.g., "Retire this
 *      asset?", "Delete entirely?", "Remove this row?"). Avoid uppercase
 *      "DELETE" / "CONFIRM" labels.
 *   • `body` carries the consequence + reversibility info in 1-2 sentences.
 *   • `destructive` adds a `terracotta-700` button tint so a delete looks
 *      visually different from a save · matches Clean Editorial palette
 *      per CLAUDE.md 2026-05-29 row.
 */

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Native `<dialog>` fires a `close` event on ESC. Route it through onCancel
  // so callers always observe dismissal regardless of how the user closed it.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    function handleClose() {
      if (open) onCancel();
    }
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, [open, onCancel]);

  // Portal to document.body so the <dialog> element doesn't become an
  // invalid HTML child of whatever React tree node holds it (e.g., a `<ul>`
  // that only allows `<li>` children, or a `<table>` body). The dialog's
  // top-layer rendering via `showModal()` is unaffected by DOM position,
  // but the element-in-tree IS a violation if mounted as a sibling of a
  // restricted parent's only-allowed child type.
  const node = (
    <dialog
      ref={dialogRef}
      className="m-auto max-w-sm rounded-xl border border-ink/10 bg-cream p-0 text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-sm"
      onClick={(e) => {
        // Backdrop click closes — the dialog element itself has the click
        // target equal to the currentTarget only when the user clicked
        // outside the inner content area (the backdrop).
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="p-6">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {title}
        </h3>
        <div className="mt-3 text-sm text-ink/80">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/70 transition hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] rounded-md px-4 py-2 text-sm font-medium text-cream transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
              destructive
                ? 'bg-terracotta-700 hover:bg-ink focus-visible:outline-terracotta-700'
                : 'bg-mulberry hover:bg-mulberry-600 focus-visible:outline-mulberry'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );

  // Only render the portal client-side · the SSR pass returns null so the
  // server output stays clean.
  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}

type ConfirmOptions = {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
  resolve?: (ok: boolean) => void;
};

const CLOSED: ConfirmState = { open: false, title: '', body: '' };

/**
 * React hook returning `{ confirm, dialog }`.
 *
 *   const { confirm, dialog } = useConfirm();
 *
 *   async function handleDelete() {
 *     if (!(await confirm({
 *       title: 'Delete entirely?',
 *       body: 'This removes the row and its history.',
 *       destructive: true,
 *       confirmLabel: 'Delete',
 *     }))) return;
 *     await deleteIt();
 *   }
 *
 *   return (
 *     <>
 *       {dialog}
 *       <button onClick={handleDelete}>Delete</button>
 *     </>
 *   );
 *
 * The dialog must be rendered somewhere in the tree (typically just before
 * the trigger button) for the modal to appear when `confirm()` is called.
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(CLOSED);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, open: true, resolve });
    });
  }, []);

  const onConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(CLOSED);
  }, [state]);

  const onCancel = useCallback(() => {
    state.resolve?.(false);
    setState(CLOSED);
  }, [state]);

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      body={state.body}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      destructive={state.destructive}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );

  return { confirm, dialog };
}
