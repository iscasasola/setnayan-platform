'use client';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ConfirmDialog } from './confirm-dialog';

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  /**
   * Dialog body. A plain string is the common case; pass a `ReactNode` when the
   * confirmation needs structure — a before/after diff, a post preview, the
   * channels a publish will hit. Rendered into `<ConfirmDialog body>`.
   */
  message: ReactNode;
  /**
   * Optional dialog title. Defaults to "Confirm action". Pass a more specific
   * verb-phrase ("Retire this asset?", "Delete entirely?") so the dialog
   * reads as a polite question per [[feedback_setnayan_no_dev_text_post_launch]].
   */
  title?: string;
  /** Custom confirm-button label. Defaults to "Confirm". */
  confirmLabel?: string;
  /** When true (default), the confirm button uses the destructive tint. */
  destructive?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Tiny client wrapper that opens an in-app confirm dialog before letting the
 * form submit reach the server action. Cancel = preventDefault, no submit.
 * Use for destructive actions that should never fire on accidental click.
 *
 * Upgraded 2026-05-30 (pre-pilot audit cleanup) from the prior `window.confirm()`
 * implementation. The native OS dialog blocked UI synchronously, didn't match
 * Setnayan brand voice, and was flagged 18× across the audit. The shared
 * `<ConfirmDialog>` honors focus trap + ESC + brand voice + Clean Editorial
 * palette via the HTML5 `<dialog>` primitive.
 *
 * Confirmation flow: the first submit is intercepted + opens the dialog. On
 * confirm we set a `hasConfirmed` ref and call `requestSubmit()` which
 * re-fires submit — this time the handler observes the ref + lets the form
 * pass through to React's server-action pipeline so `useFormStatus()`,
 * pending state, and revalidation all behave as if the user clicked Submit
 * directly.
 */
export function ConfirmForm({
  action,
  message,
  title,
  confirmLabel,
  destructive,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // A ref (not state) so the second submit fires SYNCHRONOUSLY in the same
  // tick as the requestSubmit() call — a state update wouldn't have flushed
  // yet by the time the onSubmit handler re-runs.
  const hasConfirmedRef = useRef(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (hasConfirmedRef.current) {
      // Second submit triggered by requestSubmit() after dialog confirm.
      // Let the form go through React's server-action pipeline as normal.
      hasConfirmedRef.current = false;
      return;
    }
    event.preventDefault();
    setOpen(true);
  }

  function handleConfirm() {
    setOpen(false);
    hasConfirmedRef.current = true;
    // Defer to next tick so React processes the setOpen(false) state update
    // + the dialog close before we re-fire the form submit.
    queueMicrotask(() => {
      formRef.current?.requestSubmit();
    });
  }

  function handleCancel() {
    setOpen(false);
  }

  return (
    <>
      <form ref={formRef} action={action} onSubmit={handleSubmit} className={className}>
        {children}
      </form>
      <ConfirmDialog
        open={open}
        title={title ?? 'Confirm action'}
        body={message}
        confirmLabel={confirmLabel ?? 'Confirm'}
        destructive={destructive ?? true}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
