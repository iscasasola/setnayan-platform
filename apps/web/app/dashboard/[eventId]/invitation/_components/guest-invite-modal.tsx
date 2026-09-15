'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Copy, Send, Check, X, Undo2 } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { useModalA11y } from '@/lib/use-modal-a11y';

type Props = {
  guestId: string;
  guestName: string;
  /** Built server-side. NULL → this guest has no link, so no message exists. */
  message: string | null;
  /** ISO timestamp, or null when the couple has not marked this one yet. */
  sentAt: string | null;
  markSent: (formData: FormData) => Promise<void>;
};

/**
 * ONE GUEST, ONE MESSAGE, ONE RECORD OF HAVING SENT IT.
 *
 * The couple opens this, copies the text — which carries THIS guest's own
 * invitation link — pastes it into Viber or Messenger, and marks it sent.
 * Setnayan does not deliver the message; V1 has no SMS and no Viber
 * integration, and this modal does not pretend otherwise.
 *
 * ⚠ NO MESSAGE, NO COPY BUTTON. When `message` is null the guest has no
 * invitation link yet, and a cheerful "you're invited!" with no way in is worse
 * than nothing — the couple only learns it was empty after they have pressed
 * send. The modal says what is wrong and what to do instead.
 *
 * 🔑 MARK SENT IS A TOGGLE. It records a claim about the physical world, and
 * people mis-tap; a mark that cannot be undone teaches couples not to use it.
 */
export function GuestInviteModal({ guestId, guestName, message, sentAt, markSent }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState(message ?? '');
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const headingId = useId();

  useModalA11y({ open, onClose: () => setOpen(false), containerRef: dialogRef });

  useEffect(() => {
    if (!open) return;
    setText(message ?? '');
    setCopied(false);
    const t = window.setTimeout(() => textareaRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, message]);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked (restricted PWA contexts) — select it so ⌘C works.
      textareaRef.current?.select();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-sm text-ink/70 underline-offset-4 hover:text-ink hover:underline"
      >
        {sentAt ? (
          <Check aria-hidden className="h-3.5 w-3.5 text-mulberry" strokeWidth={2.25} />
        ) : (
          <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {sentAt ? 'Sent' : 'Send'}
      </button>

      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 focus:outline-none sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-ink/10 bg-cream shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-ink/10 bg-cream/80 px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                  Their own invitation
                </p>
                <h2 id={headingId} className="font-display text-2xl italic text-ink">
                  Send to {guestName}
                </h2>
                <p className="mt-1 text-xs text-ink/55">
                  Edit freely, copy, then paste into Viber, Messenger or email.
                  Setnayan doesn&rsquo;t send it for you &mdash; you press send.
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

            <div className="px-5 py-4">
              {message === null ? (
                /* ⚠ The honest empty state. This guest has no invitation link,
                   so there is no message to send — saying so here is the whole
                   point, because the alternative is a message that arrives
                   looking complete and opens nothing. */
                <p className="rounded-xl border border-dashed border-ink/25 bg-white/60 px-4 py-6 text-sm text-ink/70">
                  This guest doesn&rsquo;t have an invitation link yet, so there
                  is nothing to send. Re-issue their QR on this page first, then
                  come back.
                </p>
              ) : (
                <>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={14}
                    className="w-full rounded-xl border border-ink/15 bg-white/70 p-3 font-sans text-sm leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mulberry"
                  />
                  <p className="mt-2 text-xs text-ink/45">
                    The link in this message is {guestName}&rsquo;s alone &mdash; it opens
                    their invitation and carries their QR for the day. Don&rsquo;t paste
                    the same one to everybody.
                  </p>
                </>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink/10 px-5 py-4">
              {message === null ? null : (
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/75 hover:border-terracotta hover:text-terracotta-700"
                >
                  <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {copied ? 'Copied' : 'Copy to clipboard'}
                </button>
              )}
              <form action={markSent}>
                <input type="hidden" name="guest_id" value={guestId} />
                {/* The form posts the state it wants to END UP at, so the
                    button's label and the outcome cannot drift apart. */}
                <input type="hidden" name="sent" value={sentAt ? '0' : '1'} />
                <SubmitButton
                  pendingLabel={sentAt ? 'Undoing…' : 'Marking sent…'}
                  className={
                    sentAt
                      ? 'inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-ink/30'
                      : 'inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600'
                  }
                >
                  {sentAt ? (
                    <>
                      <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Not sent yet
                    </>
                  ) : (
                    <>
                      <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Mark sent
                    </>
                  )}
                </SubmitButton>
              </form>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
