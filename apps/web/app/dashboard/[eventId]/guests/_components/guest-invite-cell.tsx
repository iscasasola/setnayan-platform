'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Check, Copy, Send, Ticket, Undo2 } from 'lucide-react';
import { buildGuestInviteMessage, type InviteEventFacts } from '@/lib/guest-invite-message';
import { saveImageToDevice } from '@/lib/save-to-device';
import { setGuestInvitationSent } from '../../invitation/actions';
import { Popover } from './overlay-primitives';
import {
  shareInvite,
  ticketFileName,
  ticketUrl,
  useTicketFile,
  type SendInviteGuest,
} from './send-invite';

/*
 * ⚖ ITS OWN FILE, NOT `send-invite.tsx` — BECAUSE OF THE MAKER'S BUDGET.
 * `send-invite.tsx` is in the Event Hub Maker's first load (launch/page.tsx →
 * guests/claims/page.tsx → SendInviteActions), and the Maker has a measured
 * JS ceiling (`scripts/check-maker-js-budget.mjs`). The Guest list's column
 * and its panel are only ever drawn on the Guest list, so they live here and
 * cost the Maker nothing. Everything that DECIDES what is sent — the share,
 * the ticket file, its name and route — stays in `send-invite.tsx` and is
 * imported, so the card and the column still cannot drift apart.
 */

/**
 * COPY TICKET — the guest's Digital ticket onto the clipboard as an IMAGE, so it
 * pastes straight into Messenger or Viber on a computer (owner 2026-09-30:
 * *"we do not copy the QR Code, we copy the Digital Ticket"*).
 *
 * 🪤 THE BLOB IS HANDED OVER AS A PROMISE. Safari refuses `clipboard.write`
 * once the click's activation is spent, and an `await fetch()` before it
 * spends it; `ClipboardItem` accepts the pending blob, which keeps the write
 * inside the click.
 *
 * A browser that refuses an image on the clipboard (older Firefox, some
 * in-app browsers) gets the PNG as a file instead (`saveImageToDevice`, so it
 * never opens a new page). A guest with NO ticket — the route's one 404, for a
 * guest who replied they can't come — is said as that, not as a failure.
 */
export async function copyTicketImage(
  guestId: string,
  fileName: string,
): Promise<'copied' | 'saved' | 'none' | 'failed'> {
  const url = ticketUrl(guestId);
  try {
    if (typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function') {
      const png = fetch(url, { credentials: 'same-origin' })
        .then((r) => {
          if (!r.ok) throw new Error(`ticket ${r.status}`);
          return r.blob();
        })
        .then((b) => (b.type === 'image/png' ? b : new Blob([b], { type: 'image/png' })));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return 'copied';
    }
  } catch {
    /* Refused, or no ticket — find out which below. */
  }
  const probe = await fetch(url, { credentials: 'same-origin' }).catch(() => null);
  if (probe?.status === 404) return 'none';
  const saved = await saveImageToDevice(url, fileName);
  return saved === 'failed' ? 'failed' : 'saved';
}

/** A phone or tablet — a finger, not a mouse. SSR-safe: false on the server. */
function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

/**
 * THE GUEST LIST'S INVITE COLUMN — one compact control per guest row (owner
 * 2026-09-30: *"the personal QR is found on the guest list. and we would want
 * the table to have that column to copy a message with the link and the photo
 * with it. and instructions on how to use it"*).
 *
 * 🔑 NOT A SECOND SENDER. It is the card's Send invite in a row's width: the
 * same message (`buildGuestInviteMessage`), the same Digital ticket fetched ahead of
 * the tap (`useTicketFile`), the same share (`shareInvite`), and the same ONE
 * writer for Sent ✓ (`setGuestInvitationSent`, which revalidates this page and
 * the Invitation page, so "Not sent yet (N)" falls).
 *
 *   · A PHONE — one tap opens the share sheet with the message AND their
 *     Digital ticket (owner 2026-09-30: the ticket, never the bare QR).
 *     An app taking it is the couple's send → Sent ✓. Closing it sends nothing.
 *   · A COMPUTER — Copy message, then Copy ticket, and paste both. 🔑 A COPY IS
 *     NOT A SEND (the card's rule), so it offers "Mark as sent", never stamps.
 *
 * 🪤 THE TICKET IS FETCHED ONLY FOR A ROW ON SCREEN, AND ONLY ON A PHONE. The
 * card fetches on mount because there is one card; a list of 180 rows asking
 * the server to draw 180 tickets on arrival is a cost nobody asked for. A row that has been seen keeps
 * its file, so a tap never waits on the network (iOS spends the tap's
 * activation on any `await` before `navigator.share`).
 */
export function GuestInviteCell({
  eventId,
  guest,
  facts,
  template,
  size = 'row',
}: {
  eventId: string;
  guest: SendInviteGuest;
  facts: InviteEventFacts;
  template: string | null;
  /** 'phone' draws the icon-led pill the phone's list row has room for. */
  size?: 'row' | 'phone';
}) {
  const [sentAt, setSentAt] = useState<string | null>(guest.sentAt);
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<
    | { kind: 'message' }
    | { kind: 'ticket' }
    | { kind: 'ticket-saved' }
    | { kind: 'no-ticket' }
    | { kind: 'manual'; text: string }
    | { kind: 'error'; text: string }
    | null
  >(null);
  const [pending, startTransition] = useTransition();
  const [onScreen, setOnScreen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const first = guest.firstName?.trim() || guest.fullName.split(/\s+/)[0] || 'them';

  useEffect(() => setSentAt(guest.sentAt), [guest.sentAt]);

  // Seen once → fetch once. Only a touch device will share the file.
  useEffect(() => {
    const el = ref.current;
    if (!el || onScreen || !isTouchDevice() || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setOnScreen(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onScreen]);
  const fileName = ticketFileName(guest.fullName, facts);
  const file = useTicketFile(guest.guestId, fileName, Boolean(guest.inviteUrl) && onScreen);

  if (!guest.inviteUrl) {
    return (
      <span
        className="text-xs text-ink/40"
        title={`${first} has no personal link yet. Re-issue their QR on the Invitation page.`}
        data-guest-invite-cell="no-link"
      >
        —
      </span>
    );
  }

  const message = (ticketAttached: boolean) =>
    buildGuestInviteMessage({
      ...facts,
      formalName: guest.formalName,
      firstName: guest.firstName,
      guestName: guest.fullName,
      inviteUrl: guest.inviteUrl ?? '',
      template,
      ticketAttached,
    }) ?? '';

  function mark(sent: boolean) {
    startTransition(async () => {
      const res = await setGuestInvitationSent(eventId, guest.guestId, sent);
      if (res.ok) {
        setSentAt(res.sentAt);
        setSaid(null);
      } else {
        setSaid({
          kind: 'error',
          text: sent ? 'We couldn’t save that it was sent. Try again.' : 'We couldn’t undo that just now. Try again.',
        });
      }
    });
  }

  async function invite() {
    setSaid(null);
    // A phone: the share sheet, message + ticket together. A computer: the panel —
    // its share sheet (Mail, AirDrop) is not where Messenger and Viber live.
    if (isTouchDevice()) {
      const out = await shareInvite(file, message);
      if (out === 'shared') return mark(true);
      if (out === 'closed') return;
    }
    setOpen(true);
  }

  async function copyMessage() {
    const text = message(false);
    try {
      await navigator.clipboard.writeText(text);
      setSaid({ kind: 'message' });
    } catch {
      setSaid({ kind: 'manual', text });
    }
  }

  async function copyTicket() {
    const out = await copyTicketImage(guest.guestId, fileName);
    setSaid(
      out === 'copied'
        ? { kind: 'ticket' }
        : out === 'saved'
          ? { kind: 'ticket-saved' }
          : out === 'none'
            ? { kind: 'no-ticket' }
            : { kind: 'error', text: 'We couldn’t get the ticket just now. Try again.' },
    );
  }

  const small =
    'inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-ink/20 bg-cream px-2.5 text-[13px] font-medium text-ink disabled:opacity-60';
  const sentDay = sentAt
    ? new Date(sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
    : null;

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={invite}
        disabled={pending}
        aria-haspopup="dialog"
        aria-label={sentAt ? `Invite ${guest.fullName} — sent ${sentDay}` : `Invite ${guest.fullName}`}
        title={sentAt ? `Sent ${sentDay}` : undefined}
        data-guest-invite-cell=""
        data-sent={sentAt ? 'true' : undefined}
        className={`relative z-20 inline-flex min-h-[44px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-medium transition-colors disabled:opacity-60 ${
          size === 'phone' ? 'px-2 text-xs' : 'px-2.5 text-[13px]'
        } ${
          sentAt
            ? 'text-ink/60 hover:bg-ink/5 hover:text-ink'
            : 'text-terracotta-700 hover:bg-terracotta/[0.06]'
        }`}
      >
        {sentAt ? (
          <Check aria-hidden className="h-3.5 w-3.5 text-success-600" strokeWidth={2.25} />
        ) : (
          <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
        )}
        Invite
      </button>
      {open ? (
        <Popover anchorRef={ref} onClose={() => setOpen(false)} width={296} role="dialog" labelledById={titleId}>
          <div className="space-y-2 p-1.5" data-guest-invite-panel="">
            <p id={titleId} className="text-sm font-medium text-ink">
              Invite {first}
            </p>
            <div className="flex gap-1.5">
              <button type="button" onClick={copyMessage} className={small} data-guest-invite-copy="">
                {said?.kind === 'message' ? (
                  <Check aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2.25} />
                ) : (
                  <Copy aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                )}
                {said?.kind === 'message' ? 'Copied ✓' : 'Copy message'}
              </button>
              <button type="button" onClick={copyTicket} className={small} data-guest-invite-copy-ticket="">
                {said?.kind === 'ticket' ? (
                  <Check aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2.25} />
                ) : (
                  <Ticket aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                )}
                {said?.kind === 'ticket' ? 'Copied ✓' : 'Copy ticket'}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-ink/60">Paste the message, then paste the ticket.</p>
            <div aria-live="polite" className="space-y-1.5">
              {said?.kind === 'ticket-saved' ? (
                <p className="text-xs text-ink/75">Your browser saved the ticket as a file instead — attach it to the message.</p>
              ) : null}
              {said?.kind === 'no-ticket' ? (
                <p className="text-xs text-ink/75">
                  {first} has no ticket — they replied they can’t come. The message still carries their link.
                </p>
              ) : null}
              {said?.kind === 'manual' ? (
                <>
                  <p className="text-xs text-ink/75">The copy was blocked — select the message and copy it.</p>
                  <textarea
                    className="w-full rounded-lg border border-ink/15 bg-white p-2 text-xs leading-relaxed text-ink"
                    readOnly
                    value={said.text}
                    rows={5}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </>
              ) : null}
              {said?.kind === 'error' ? (
                <p role="alert" className="text-xs text-danger-700">
                  {said.text}
                </p>
              ) : null}
            </div>
            <div className="border-t border-ink/[0.06] pt-1.5">
              {sentAt ? (
                <p className="flex items-center gap-1.5 text-[13px] text-ink" data-guest-invite-sent="">
                  <Check aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2.25} />
                  <span className="font-medium">Sent ✓</span>
                  <span className="text-ink/55">{sentDay}</span>
                  <button
                    type="button"
                    onClick={() => mark(false)}
                    disabled={pending}
                    className="ml-auto inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 text-[13px] font-medium text-ink/70 hover:text-ink disabled:opacity-60"
                  >
                    <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Undo
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => mark(true)}
                  disabled={pending}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-mulberry px-4 text-[13px] font-medium text-cream disabled:opacity-60"
                  data-guest-invite-mark=""
                >
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                  {pending ? 'Saving…' : 'Mark as sent'}
                </button>
              )}
            </div>
          </div>
        </Popover>
      ) : null}
    </>
  );
}
