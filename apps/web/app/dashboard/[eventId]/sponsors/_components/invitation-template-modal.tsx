'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Copy, Mail, Send, X } from 'lucide-react';

type Props = {
  /** Identifies this sponsor in the global "open modal for X" dance. */
  sponsorId: string;
  /** Display label rendered in the trigger button. */
  triggerLabel: string;
  /** Pre-filled, editable invitation text. */
  initialMessage: string;
  /** Server action's form post URL — fires when host commits to "Send / Mark sent." */
  formAction: (formData: FormData) => Promise<void>;
  /** Event ID hidden field passed through to the server action. */
  eventId: string;
};

/**
 * Editable invitation-template modal — host previews the pamamanhikan-style
 * message, edits it freely, copies to clipboard, then commits "Mark sent."
 *
 * V1 doesn't deliver the email automatically (host pastes into Messenger /
 * Viber / email). V1.x routes through Resend per 0028 template pattern.
 *
 * Brand voice — per [[feedback_setnayan_no_dev_text_post_launch]]. Cream
 * background · ink body · terracotta accents · Cormorant heading.
 */
export function InvitationTemplateModal({
  sponsorId,
  triggerLabel,
  initialMessage,
  formAction,
  eventId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const headingId = useId();

  // Reset message + copied state when opening a fresh modal.
  useEffect(() => {
    if (open) {
      setMessage(initialMessage);
      setCopied(false);
      // Focus textarea after the dialog mounts for keyboard-first edit.
      const t = window.setTimeout(() => textareaRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open, initialMessage]);

  // Close on Escape · trap focus loosely (full focus-trap is overkill for V1).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback for older browsers — select the textarea so the host can
      // hit Cmd/Ctrl+C themselves.
      textareaRef.current?.select();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-terracotta/40 bg-cream px-2.5 py-1.5 text-xs font-medium text-terracotta-700 transition-colors hover:bg-terracotta/10"
      >
        <Send aria-hidden className="h-3 w-3" strokeWidth={1.75} />
        {triggerLabel}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-ink/10 bg-cream shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-ink/10 bg-cream/80 px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                  Pamamanhikan-style invitation
                </p>
                <h2
                  id={headingId}
                  className="font-display text-2xl italic text-ink"
                >
                  Invite {triggerLabel}
                </h2>
                <p className="mt-1 text-xs text-ink/55">
                  Edit freely. Copy to clipboard and send via Messenger, Viber,
                  email, or paper. Mark sent when you&apos;ve delivered it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-ink/50 hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </header>

            <div className="space-y-3 px-5 py-4">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Message
                </span>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={14}
                  className="mt-1 w-full rounded-md border border-ink/20 bg-cream px-3 py-2 font-display text-base italic leading-relaxed text-ink placeholder-ink/40 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 rounded-md border border-ink/20 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-ink/40"
                >
                  <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {copied ? 'Copied' : 'Copy to clipboard'}
                </button>
                <p className="text-[11px] text-ink/55">
                  <Mail aria-hidden className="mr-1 inline h-3 w-3" strokeWidth={1.75} />
                  Automated email delivery ships in a future update — for now
                  you send the message yourself.
                </p>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink/10 bg-cream/60 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
              >
                Cancel
              </button>
              <form action={formAction}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="sponsor_id" value={sponsorId} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta-600"
                >
                  <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Mark invitation sent
                </button>
              </form>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
