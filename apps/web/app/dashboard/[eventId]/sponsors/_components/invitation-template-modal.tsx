'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Copy, Mail, Send, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { StayForm } from '@/app/_components/stay-form';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton, actionButtonClass } from '@/components/action-button';

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
  const dialogRef = useRef<HTMLDivElement>(null);
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
        className="inline-flex items-center gap-1.5 rounded-md border border-terracotta/40 bg-cream px-2.5 py-1.5 text-xs font-medium text-terracotta-700-700 transition-colors hover:bg-terracotta/10"
      >
        <Send aria-hidden className="h-3 w-3" strokeWidth={1.75} />
        {triggerLabel}
      </button>

      {open ? (
        /* 📐 DESIGN TEMPLATE (14 Nov 2026, rule 9): the house Sheet — handle, title, ✕, Esc and Back. */
        <Sheet open onClose={() => setOpen(false)} labelledById={headingId} rise>
          <div ref={dialogRef}>
            <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-4 pr-14">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Pamamanhikan-style invitation
                </p>
                <h2
                  id={headingId}
                  className="text-[17px] font-semibold text-ink"
                >
                  Invite {triggerLabel}
                </h2>
                <div className="mt-1 text-xs text-ink/70">
                  <InfoTip label="Edit freely." labelAs="span" labelClassName="text-ink/70" align="start">
                    Copy to clipboard and send via Messenger, Viber, email, or paper. Mark sent when you’ve delivered it.
                  </InfoTip>
                </div>
              </div>
            </header>

            <div className="space-y-3 px-5 py-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
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
                <ActionButton tone="info" icon={Copy} label={copied ? 'Copied' : 'Copy to clipboard'} onClick={copyToClipboard} />
                <p className="text-xs text-ink/70">
                  <Mail aria-hidden className="mr-1 inline h-3 w-3" strokeWidth={1.75} />
                  Automated email delivery ships in a future update — for now
                  you send the message yourself.
                </p>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setOpen(false)} />
              <StayForm door="sponsors.sendInvitation" action={formAction} onSaved={() => setOpen(false)}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="sponsor_id" value={sponsorId} />
                <SubmitButton
                  pendingLabel="Marking sent…"
                  className={actionButtonClass('brand', { main: true })}
                >
                  <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Mark invitation sent
                </SubmitButton>
              </StayForm>
            </footer>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
