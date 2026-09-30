'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Undo2 } from 'lucide-react';
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
 * INVITE · ⋯ + THE STATUS LINE — one pair, drawn the same on the guest card, a
 * desktop row and a phone row (owner 2026-09-30, the approved Fable designs:
 * `guest_card_invite_simple` · `guest_list_rows`). Before this the card had its
 * own Send invite · Copy message block and the column its own button; the pair
 * is now ONE control in three widths, so a row and the card can never send two
 * different things or say two different things about what was sent.
 *
 * 🔑 NOT A SECOND SENDER. The same message (`buildGuestInviteMessage`), the same
 * Digital ticket fetched ahead of the tap (`useTicketFile`), the same share
 * (`shareInvite`), and the same ONE writer for Sent ✓ (`setGuestInvitationSent`,
 * which revalidates this page and the Invitation page, so "to invite" falls).
 *
 *   · A PHONE — one tap opens the share sheet with the message AND their
 *     Digital ticket (owner 2026-09-30: the ticket, never the bare QR).
 *     An app taking it is the couple's send → ✓ Sent. Closing it sends nothing.
 *   · A COMPUTER — a small box with three steps in order: 1 Copy message ·
 *     2 Copy ticket · 3 Mark as sent. Each ticks green as it is done. 🔑 A COPY
 *     IS NOT A SEND, so only step 3 stamps — the computer cannot know the chat
 *     went out.
 *
 * The status line under it: "Not sent · Not linked" / "✓ Sent Sep 30 · Linked".
 * `linked` is null when the page could not measure it — then the line says
 * nothing about an account rather than "Not linked".
 *
 * 🪤 THE TICKET IS FETCHED ONLY FOR A ROW ON SCREEN, AND ONLY ON A PHONE. The
 * card is one row; a list of 180 rows asking the server to draw 180 tickets on
 * arrival is a cost nobody asked for. A row that has been seen keeps its file,
 * so a tap never waits on the network (iOS spends the tap's activation on any
 * `await` before `navigator.share`).
 */
export function GuestInviteCell({
  eventId,
  guest,
  facts,
  template,
  layout = 'row',
  more,
  linked = null,
}: {
  eventId: string;
  guest: SendInviteGuest;
  facts: InviteEventFacts;
  template: string | null;
  /** 'card' — the guest card's top · 'row' — a desktop row · 'phone' — a phone row (status to the right). */
  layout?: 'card' | 'row' | 'phone';
  /** The ⋯ menu, drawn right beside Invite (`GuestMoreMenu`). */
  more?: React.ReactNode;
  /** Whether an account holds this invitation; null = not measured, so not said. */
  linked?: boolean | null;
}) {
  const [sentAt, setSentAt] = useState<string | null>(guest.sentAt);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ message: boolean; ticket: boolean }>({ message: false, ticket: false });
  const [said, setSaid] = useState<
    | { kind: 'ticket-saved' }
    | { kind: 'no-ticket' }
    | { kind: 'manual'; text: string }
    | { kind: 'error'; text: string }
    | null
  >(null);
  const [pending, startTransition] = useTransition();
  const [onScreen, setOnScreen] = useState(layout === 'card');
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
  const fileName = ticketFileName(guest.fullName);
  const file = useTicketFile(guest.guestId, fileName, Boolean(guest.inviteUrl) && onScreen);

  const sentDay = sentAt
    ? new Date(sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
    : null;
  const status = (
    <p
      className={`text-xs ${layout === 'phone' ? 'ml-auto text-right' : ''} ${sentAt ? 'text-ink/70' : 'text-ink/50'}`}
      data-guest-invite-status=""
    >
      {sentAt ? (
        <>
          <span className="text-success-700">✓</span> Sent {sentDay}
        </>
      ) : (
        'Not sent'
      )}
      {linked === null ? null : ` · ${linked ? 'Linked' : 'Not linked'}`}
    </p>
  );

  if (!guest.inviteUrl) {
    return (
      <div className={layout === 'phone' ? 'flex items-center gap-2' : 'space-y-1'} data-guest-invite-cell="no-link">
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs text-ink/45"
            title={`${first} has no personal link yet — New QR in ⋯ gives them one.`}
          >
            No link yet
          </span>
          {more}
        </div>
        {status}
      </div>
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
        if (sent) setOpen(false);
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
    setDone({ message: false, ticket: false });
    // A phone: the share sheet, message + ticket together. A computer: the three
    // steps — its share sheet (Mail, AirDrop) is not where Messenger and Viber live.
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
      setDone((d) => ({ ...d, message: true }));
    } catch {
      setSaid({ kind: 'manual', text });
    }
  }

  async function copyTicket() {
    const out = await copyTicketImage(guest.guestId, fileName);
    if (out === 'copied' || out === 'saved') setDone((d) => ({ ...d, ticket: true }));
    setSaid(
      out === 'saved'
        ? { kind: 'ticket-saved' }
        : out === 'none'
          ? { kind: 'no-ticket' }
          : out === 'failed'
            ? { kind: 'error', text: 'We couldn’t get the ticket just now. Try again.' }
            : null,
    );
  }

  const step =
    'flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] font-medium text-ink transition-colors hover:bg-ink/5 disabled:opacity-60';
  const num = (n: number, ok: boolean) => (
    <span
      aria-hidden
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
        ok ? 'bg-success-600 text-cream' : 'bg-ink text-cream'
      }`}
    >
      {ok ? '✓' : n}
    </span>
  );

  return (
    <div
      className={layout === 'phone' ? 'flex w-full items-center gap-2' : 'space-y-1'}
      data-guest-invite-pair={layout}
    >
      <div className="flex items-center gap-1.5">
        <button
          ref={ref}
          type="button"
          onClick={invite}
          disabled={pending}
          aria-haspopup="dialog"
          aria-label={sentAt ? `Invite ${guest.fullName} — sent ${sentDay}` : `Invite ${guest.fullName}`}
          data-guest-invite-cell=""
          data-sent={sentAt ? 'true' : undefined}
          className={`relative z-20 inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-ink font-medium text-cream transition-colors hover:bg-ink/85 disabled:opacity-60 ${
            layout === 'card' ? 'min-w-[132px] px-6 text-sm' : 'px-4 text-[13px]'
          }`}
        >
          Invite
        </button>
        {more}
      </div>
      {status}
      {open ? (
        <Popover anchorRef={ref} onClose={() => setOpen(false)} width={296} role="dialog" labelledById={titleId}>
          <div className="space-y-1 p-1.5" data-guest-invite-panel="">
            <p id={titleId} className="px-1 pb-1 text-sm font-medium text-ink">
              Invite {first}
            </p>
            <button type="button" onClick={copyMessage} className={step} data-guest-invite-copy="">
              {num(1, done.message)}
              <span className="flex-1">Copy message</span>
              {done.message ? <span className="text-xs text-success-700">Copied</span> : null}
            </button>
            <button type="button" onClick={copyTicket} className={step} data-guest-invite-copy-ticket="">
              {num(2, done.ticket)}
              <span className="flex-1">Copy ticket</span>
              {done.ticket ? <span className="text-xs text-success-700">Copied</span> : null}
            </button>
            {sentAt ? (
              <p className="flex min-h-[44px] items-center gap-2.5 px-2.5 text-[13px] text-ink" data-guest-invite-sent="">
                {num(3, true)}
                <span className="flex-1">Sent {sentDay}</span>
                <button
                  type="button"
                  onClick={() => mark(false)}
                  disabled={pending}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 text-[13px] font-medium text-ink/70 hover:text-ink disabled:opacity-60"
                >
                  <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Undo
                </button>
              </p>
            ) : (
              <button type="button" onClick={() => mark(true)} disabled={pending} className={step} data-guest-invite-mark="">
                {num(3, false)}
                <span className="flex-1">{pending ? 'Saving…' : 'Mark as sent'}</span>
              </button>
            )}
            <p className="border-t border-ink/[0.06] px-2.5 pt-2 text-xs leading-relaxed text-ink/60">
              Paste the message, then paste the ticket in the chat.
            </p>
            <div aria-live="polite" className="space-y-1.5 px-1">
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
          </div>
        </Popover>
      ) : null}
    </div>
  );
}
