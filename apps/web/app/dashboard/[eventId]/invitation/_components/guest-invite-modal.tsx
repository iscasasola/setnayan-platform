'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Copy, Send, Check, Undo2 } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';

type Props = {
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
 * PERSONAL invitation link yet, and a cheerful "you're invited!" with no way in
 * is worse than nothing — the couple only learns it was empty after they have
 * pressed send.
 *
 * ⚠ THE COPY DELIBERATELY DOES NOT MENTION THE EVENT'S GENERAL QR, and that is
 * a decision rather than an omission. Owner, 2026-09-16, in two parts:
 *
 *   ⓵ a guest can use the master code at `setnayan.com/{slug}` instead of a
 *      personal one — it carries no token; and then
 *   ⓶ **"if no guest list, anybody with QR can access. if with guest list
 *      custom QR, then only QR codes for that event can access Papic."**
 *
 * 🔑 THE SECOND HALF IS A CONDITION ON THE FIRST, and it is the half that
 * applies here: an event with a guest list is exactly the event this modal
 * belongs to. Telling such a couple "just send them the general QR" would be
 * advice that fails on their own event, which is worse than saying nothing.
 *
 * ⚠ NOT YET VERIFIED IN CODE — this session traced the capture gate as far as
 * `readGuestSession` (guest_id + event_id cookie) in `api/papic/guest-capture`
 * and did not locate the guest-list-presence rule itself. Until somebody reads
 * that rule and can state it exactly, the copy says only what is certainly
 * true: re-issue the QR. Do not add the general-QR sentence on the strength of
 * this docblock.
 *
 * 🔑 MARK SENT IS A TOGGLE. It records a claim about the physical world, and
 * people mis-tap; a mark that cannot be undone teaches couples not to use it.
 */
export function GuestInviteModal({ guestName, message, sentAt, markSent }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState(message ?? '');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const headingId = useId();

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
        className="inline-flex min-h-11 items-center gap-1 text-sm text-ink/75 underline-offset-4 hover:text-ink hover:underline"
      >
        {sentAt ? (
          <Check aria-hidden className="h-3.5 w-3.5 text-mulberry" strokeWidth={2.25} />
        ) : (
          <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {sentAt ? 'Sent' : 'Send'}
      </button>

      {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 3 · 6 · 9 · 13): the house Sheet (✕, Esc, the phone's Back) instead of a
          hand-drawn overlay; grey capitals over a bold title; the empty state is one plain line; the presses are the
          shared pills (grey Copy, the one terracotta Mark sent). */}
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
        <div className="space-y-3 px-4 pb-4 pt-3.5">
          <div className="pr-12">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">Their own invitation</p>
            <h2 id={headingId} className="text-xl font-bold tracking-tight text-ink">
              Send to {guestName}
            </h2>
            <p className="mt-1 text-[13px] text-ink/75">
              Edit freely, copy, then paste into Viber, Messenger or email.
              Setnayan doesn&rsquo;t send it for you &mdash; you press send.
            </p>
          </div>

          {message === null ? (
            /* ⚠ The honest empty state. This guest has no invitation link,
               so there is no message to send — saying so here is the whole
               point, because the alternative is a message that arrives
               looking complete and opens nothing. */
            <p className="py-2 text-sm text-ink/75">
              This guest doesn&rsquo;t have their <em>own</em> invitation link yet,
              so there&rsquo;s no personal message to copy. Re-issue their QR on
              this page to give them one, then come back.
            </p>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                className="input-field w-full p-3 font-sans text-sm leading-relaxed"
              />
              <p className="text-[13px] text-ink/75">
                The link in this message is {guestName}&rsquo;s alone &mdash; it opens
                their invitation and carries their QR for the day. Don&rsquo;t paste
                the same one to everybody.
              </p>
            </>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink/10 pt-3">
            {message === null ? null : (
              <ActionButton
                tone="neutral"
                icon={Copy}
                label={copied ? 'Copied' : 'Copy to clipboard'}
                onClick={copyToClipboard}
              />
            )}
            {/* The guest is bound into `markSent` on the server
                (markGuestInvitationSent.bind(null, eventId, guestId)), so no
                guest id is posted — the bound one is the only one. */}
            <form action={markSent}>
              {/* The form posts the state it wants to END UP at, so the
                  button's label and the outcome cannot drift apart. */}
              <input type="hidden" name="sent" value={sentAt ? '0' : '1'} />
              <SubmitButton
                pendingLabel={sentAt ? 'Undoing…' : 'Marking sent…'}
                className={sentAt ? 'ab ab-neutral' : 'ab ab-brand ab-main'}
              >
                {sentAt ? (
                  <>
                    <Undo2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    Not sent yet
                  </>
                ) : (
                  <>
                    <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    Mark sent
                  </>
                )}
              </SubmitButton>
            </form>
          </div>
        </div>
      </Sheet>
    </>
  );
}
