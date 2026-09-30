'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Check, Copy, Download, QrCode, Send, Undo2 } from 'lucide-react';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { saveImageToDevice } from '@/lib/save-to-device';
import { Popover } from './overlay-primitives';
import {
  buildGuestInviteMessage,
  defaultInviteTemplate,
  INVITE_PLACEHOLDERS,
  INVITE_TEMPLATE_MAX,
  inviteSendPath,
  type InviteEventFacts,
} from '@/lib/guest-invite-message';
import { setGuestInvitationSent } from '../../invitation/actions';
import { saveInviteMessage } from '../send/actions';

/**
 * SEND INVITE · COPY MESSAGE — one guest, their own link, from the couple's
 * own phone (owner 2026-09-29: *"maybe we can create a copy text"* → *"Here is
 * the link: / Here is your QR Code for the event … Save it"* → *"something we
 * can copy and send to them via third party apps like messenger"*).
 *
 * ── WHAT EACH BUTTON DOES, AND WHY IT IS THIS ─────────────────────────────
 *   · SEND INVITE — the phone's share sheet (Messenger · Viber · Messages):
 *       ⓵ the message AND the guest's QR as an image, where the sheet takes a
 *         file (`navigator.canShare({ files })`);
 *       ⓶ the message alone where it does not — the link's page shows their QR;
 *       ⓷ no share sheet at all (most desktops): the message is COPIED, and
 *         Download QR + Mark as sent are offered beside it.
 *     A share the phone completed stamps Sent ✓ (`invitation_sent_at`, through
 *     the ONE writer in `invitation/actions.ts`). Closing the sheet is not a
 *     failure and stamps nothing.
 *   · COPY MESSAGE — the full filled-in text, "Copied ✓", for couples who
 *     paste into Messenger/Viber themselves. 🔑 A COPY IS NOT A SEND, so it
 *     never stamps by itself; it OFFERS "Mark as sent".
 *
 * 🪤 THE QR FILE IS FETCHED BEFORE THE TAP. iOS Safari refuses a share that is
 * not inside the tap's user activation, and an `await fetch()` between the tap
 * and `navigator.share` can spend it. So the PNG (the same route Download uses,
 * `/api/website/qr/guest/<id>`) is fetched on mount, and the tap shares what
 * is already in hand. If it is not ready, the text-only share still works.
 *
 * ⛔ WE SEND NOTHING. No SMS (V1), no email, no delivery on the couple's
 * behalf — every message leaves from the couple's own phone.
 */

export type SendInviteGuest = {
  guestId: string;
  /**
   * The message's `{name}` — the guest's name exactly as the couple entered it
   * (`guestFullName`: their Display name, else the five parts composed; owner
   * 2026-09-30 *"the name as given. to them"*). REQUIRED so no caller can build
   * a message that shortens it to a first name by leaving it out.
   */
  formalName: string | null;
  firstName: string | null;
  fullName: string;
  /** The guest's OWN invitation link, or null when they have no QR token yet. */
  inviteUrl: string | null;
  sentAt: string | null;
};

type ShareNav = Navigator & {
  canShare?: (data: { files?: File[]; text?: string }) => boolean;
};

function qrFileName(name: string): string {
  return `qr-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'guest'}.png`;
}

/** The guest's QR as a File, fetched ahead of the tap (see the 🪤 above). */
function useQrFile(guestId: string, name: string, enabled: boolean): File | null {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    setFile(null);
    if (!enabled) return;
    const nav = typeof navigator !== 'undefined' ? (navigator as ShareNav) : null;
    // Only a device that can share files needs the bytes.
    if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return;
    let alive = true;
    fetch(`/api/website/qr/guest/${guestId}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!alive || !blob) return;
        setFile(new File([blob], qrFileName(name), { type: blob.type || 'image/png' }));
      })
      .catch(() => {
        /* No file → the text-only share, which still carries the link. */
      });
    return () => {
      alive = false;
    };
  }, [guestId, name, enabled]);
  return file;
}

/**
 * THE ONE SHARE — the phone's sheet with the message and, where the sheet takes
 * a file, the guest's QR. Shared by `SendInviteActions` (the guest card and the
 * one-by-one run) and `GuestInviteCell` (the Guest list's Invite column), so a
 * row and a card can never send two different things.
 *
 *   'shared' — an app took it: the couple's send, stamp Sent ✓.
 *   'closed' — they closed the sheet: not a failure, nothing was sent.
 *   'copy'   — no sheet, or it refused (a webview without file sharing, a
 *              spent activation): fall back to copying, which always works.
 */
export async function shareInvite(
  file: File | null,
  message: (qrAttached: boolean) => string,
): Promise<'shared' | 'closed' | 'copy'> {
  const nav = typeof navigator !== 'undefined' ? (navigator as ShareNav) : null;
  const path = inviteSendPath({
    share: typeof nav?.share === 'function',
    filesOk: Boolean(file && nav?.canShare?.({ files: [file] })),
  });
  if (!nav || path === 'copy') return 'copy';
  try {
    await nav.share(
      path === 'files' && file ? { files: [file], text: message(true) } : { text: message(false) },
    );
    return 'shared';
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return 'closed';
    return 'copy';
  }
}

/**
 * COPY QR — the guest's QR PNG onto the clipboard as an IMAGE, so it pastes
 * straight into Messenger or Viber on a computer (owner 2026-09-30: *"copy a
 * message with the link and the photo with it"*).
 *
 * 🪤 THE BLOB IS HANDED OVER AS A PROMISE. Safari refuses `clipboard.write`
 * once the click's activation is spent, and an `await fetch()` before it
 * spends it; `ClipboardItem` accepts the pending blob, which keeps the write
 * inside the click.
 *
 * A browser that refuses an image on the clipboard (older Firefox, some
 * in-app browsers) gets the PNG as a file instead — the same save the card's
 * Download QR uses (`saveImageToDevice`), so it never opens a new page.
 */
export async function copyQrImage(
  guestId: string,
  name: string,
): Promise<'copied' | 'saved' | 'failed'> {
  const url = `/api/website/qr/guest/${guestId}`;
  try {
    if (typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function') {
      const png = fetch(url, { credentials: 'same-origin' })
        .then((r) => {
          if (!r.ok) throw new Error(`qr ${r.status}`);
          return r.blob();
        })
        .then((b) => (b.type === 'image/png' ? b : new Blob([b], { type: 'image/png' })));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return 'copied';
    }
  } catch {
    /* Refused — save the file instead, below. */
  }
  const saved = await saveImageToDevice(url, qrFileName(name));
  return saved === 'failed' ? 'failed' : 'saved';
}

/** A phone or tablet — a finger, not a mouse. SSR-safe: false on the server. */
function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

type Said =
  | { kind: 'copied' } // Copy message — offers Mark as sent
  | { kind: 'copied-desktop' } // Send invite with no share sheet — copy + Download QR + Mark as sent
  | { kind: 'manual'; text: string } // clipboard blocked — the text, selectable
  | { kind: 'error'; text: string };

export function SendInviteActions({
  eventId,
  guest,
  facts,
  template,
  onSentChange,
  size = 'card',
  extra,
}: {
  eventId: string;
  guest: SendInviteGuest;
  facts: InviteEventFacts;
  template: string | null;
  onSentChange?: (sentAt: string | null) => void;
  /** 'run' draws the full-width phone buttons of the one-by-one run. */
  size?: 'card' | 'run';
  /** Drawn beside Copy message (the run's Skip). */
  extra?: React.ReactNode;
}) {
  const [sentAt, setSentAt] = useState<string | null>(guest.sentAt);
  const [said, setSaid] = useState<Said | null>(null);
  const [pending, startTransition] = useTransition();
  const manualRef = useRef<HTMLTextAreaElement>(null);
  const first = guest.firstName?.trim() || guest.fullName.split(/\s+/)[0] || 'them';
  const file = useQrFile(guest.guestId, guest.fullName, Boolean(guest.inviteUrl));

  useEffect(() => {
    setSentAt(guest.sentAt);
    setSaid(null);
  }, [guest.guestId, guest.sentAt]);

  useEffect(() => {
    if (said?.kind === 'manual') manualRef.current?.select();
  }, [said]);

  if (!guest.inviteUrl) {
    return (
      <p role="status" className="text-[13px] text-ink/55">
        {first} has no personal link yet, so there is nothing to send. Re-issue their QR on the
        Invitation page to give them one.
      </p>
    );
  }

  const message = (qrAttached: boolean) =>
    buildGuestInviteMessage({
      ...facts,
      formalName: guest.formalName,
      firstName: guest.firstName,
      guestName: guest.fullName,
      inviteUrl: guest.inviteUrl ?? '',
      template,
      qrAttached,
    }) ?? '';

  function mark(sent: boolean) {
    startTransition(async () => {
      const res = await setGuestInvitationSent(eventId, guest.guestId, sent);
      if (res.ok) {
        setSentAt(res.sentAt);
        setSaid(null);
        onSentChange?.(res.sentAt);
      } else {
        setSaid({
          kind: 'error',
          text: sent
            ? 'We couldn’t save that it was sent. Try “Mark as sent” again.'
            : 'We couldn’t undo that just now. Try again.',
        });
      }
    });
  }

  async function copyText(kind: 'copied' | 'copied-desktop') {
    const text = message(false);
    try {
      await navigator.clipboard.writeText(text);
      setSaid({ kind });
    } catch {
      // Clipboard blocked (some in-app browsers) — hand them the text, selected.
      setSaid({ kind: 'manual', text });
    }
  }

  async function send() {
    const out = await shareInvite(file, message);
    // The phone handed it to an app — that is the couple's send.
    if (out === 'shared') return mark(true);
    // They closed the sheet — not a failure, and nothing was sent.
    if (out === 'closed') return;
    await copyText('copied-desktop');
  }

  const big = size === 'run';
  const primary = big
    ? 'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-base font-medium text-cream disabled:opacity-60'
    : 'inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-cream disabled:opacity-60';
  const secondary = big
    ? 'inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full border border-ink/20 bg-cream px-4 text-sm font-medium text-ink disabled:opacity-60'
    : 'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ink/20 bg-cream px-4 text-sm font-medium text-ink disabled:opacity-60';
  const quiet =
    'inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline disabled:opacity-60';

  return (
    <div data-send-invite="" className="space-y-2">
      <div className={big ? 'flex flex-col gap-2' : 'flex flex-wrap items-center gap-2'}>
        <button type="button" onClick={send} disabled={pending} className={primary} data-send-invite-share="">
          <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {big ? `Send to ${first}` : sentAt ? 'Send again' : 'Send invite'}
        </button>
        <div className={big ? 'flex gap-2' : 'contents'}>
          <button
            type="button"
            onClick={() => copyText('copied')}
            disabled={pending}
            className={secondary}
            data-send-invite-copy=""
          >
            {said?.kind === 'copied' ? (
              <Check aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2.25} />
            ) : (
              <Copy aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            )}
            {said?.kind === 'copied' ? 'Copied ✓' : 'Copy message'}
          </button>
          {extra}
        </div>
      </div>

      {/* What just happened, in one line — and the one next thing. */}
      <div aria-live="polite" className="space-y-2">
        {sentAt ? (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink" data-send-invite-sent="">
            <Check aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2.25} />
            <span className="font-medium">Sent ✓</span>
            <span className="text-ink/55">
              {/* A fixed zone: the server (UTC) and the phone must draw the same day, or the card fails to hydrate. */}
              {new Date(sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
            </span>
            <button type="button" onClick={() => mark(false)} disabled={pending} className={quiet}>
              <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Undo
            </button>
          </p>
        ) : null}

        {said?.kind === 'copied' || said?.kind === 'copied-desktop' ? (
          <div className="space-y-1.5 text-[13px] text-ink/75">
            <p>
              {said.kind === 'copied-desktop'
                ? `Message copied — paste it to ${first} in Messenger or Viber, and add their QR.`
                : `Copied — paste it to ${first} in Messenger or Viber.`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {said.kind === 'copied-desktop' ? (
                <SaveFileLink
                  href={`/api/website/qr/guest/${guest.guestId}`}
                  filename={qrFileName(guest.fullName)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 text-sm font-medium text-ink/80"
                >
                  {(state) => (
                    <>
                      <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      {state === 'saving' ? 'Saving…' : 'Download QR'}
                    </>
                  )}
                </SaveFileLink>
              ) : null}
              {sentAt ? null : (
                <button
                  type="button"
                  onClick={() => mark(true)}
                  disabled={pending}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-mulberry px-4 text-sm font-medium text-cream disabled:opacity-60"
                  data-send-invite-mark=""
                >
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                  {pending ? 'Saving…' : 'Mark as sent'}
                </button>
              )}
            </div>
          </div>
        ) : null}

        {said?.kind === 'manual' ? (
          <div className="space-y-1.5">
            <p className="text-[13px] text-ink/75">
              Your phone blocked the copy — select the message below and copy it.
            </p>
            <textarea
              className="w-full rounded-xl border border-ink/15 bg-white p-3 text-sm leading-relaxed text-ink"
              ref={manualRef}
              readOnly
              value={said.text}
              rows={8}
            />
            {sentAt ? null : (
              <button type="button" onClick={() => mark(true)} disabled={pending} className={quiet}>
                <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                Mark as sent
              </button>
            )}
          </div>
        ) : null}

        {said?.kind === 'error' ? (
          <p role="alert" className="text-[13px] text-danger-700">
            {said.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * REWORD IT ONCE, FOR EVERYBODY — a plain box, and the message it makes for a
 * real guest right under it. Placeholders fill themselves; "Use our wording"
 * goes back (stored as null, so our improvements reach them).
 */
export function InviteMessageEditor({
  eventId,
  facts,
  template,
  sample,
  onSaved,
}: {
  eventId: string;
  facts: InviteEventFacts;
  template: string | null;
  /** A real guest to preview on. */
  sample: SendInviteGuest | null;
  onSaved: (template: string | null) => void;
}) {
  const ours = defaultInviteTemplate({ solemn: facts.solemn });
  const [text, setText] = useState(template ?? ours);
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [pending, startTransition] = useTransition();
  const boxId = useId();

  useEffect(() => {
    setText(template ?? ours);
  }, [template, ours]);

  const preview = buildGuestInviteMessage({
    ...facts,
    formalName: sample ? sample.formalName : 'Ms. Maria Santos',
    firstName: sample?.firstName ?? 'Maria',
    guestName: sample?.fullName ?? 'Maria',
    inviteUrl: sample?.inviteUrl ?? 'https://www.setnayan.com/…',
    template: text,
  });

  function save(next: string) {
    startTransition(async () => {
      const res = await saveInviteMessage(eventId, next);
      if (res.ok) {
        setState('saved');
        setText(res.template ?? ours);
        onSaved(res.template);
      } else {
        setState('error');
      }
    });
  }

  return (
    <div data-invite-message-editor="" className="space-y-3">
      <label htmlFor={boxId} className="block text-sm font-medium text-ink">
        Your message — for every guest
      </label>
      <textarea
        className="w-full rounded-xl border border-ink/15 bg-white p-3 text-[15px] leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mulberry"
        id={boxId}
        value={text}
        maxLength={INVITE_TEMPLATE_MAX}
        onChange={(e) => {
          setText(e.target.value);
          setState('idle');
        }}
        rows={9}
      />
      <p className="text-xs leading-relaxed text-ink/55">
        These fill themselves for each guest:{' '}
        {INVITE_PLACEHOLDERS.map((p, i) => (
          <span key={p.token}>
            {i > 0 ? ' · ' : ''}
            <code className="rounded bg-ink/5 px-1 font-mono text-[11px] text-ink/80">{p.token}</code> {p.says}
          </span>
        ))}
        . Their link is always included.
      </p>
      <div className="rounded-xl bg-ink/[0.04] p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
          {sample ? `What ${sample.firstName?.trim() || sample.fullName} gets` : 'What a guest gets'}
        </p>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/85">{preview}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => save(text)}
          disabled={pending}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-cream disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save for every guest'}
        </button>
        <button
          type="button"
          onClick={() => save('')}
          disabled={pending || (template === null && text === ours)}
          className="inline-flex min-h-[44px] items-center rounded-full px-3 text-sm font-medium text-ink/70 underline-offset-4 hover:underline disabled:opacity-40"
        >
          Use our wording
        </button>
        <span aria-live="polite" className="text-sm">
          {state === 'saved' ? <span className="text-success-700">Saved ✓</span> : null}
          {state === 'error' ? <span className="text-danger-700">We couldn’t save it — try again.</span> : null}
        </span>
      </div>
    </div>
  );
}

/**
 * The guest card's block: Send invite · Copy message, and — in place, never a
 * link elsewhere (owner 2026-09-28) — the message's wording, folded.
 */
export function GuestSendInvite({
  eventId,
  guest,
  facts,
  template: initialTemplate,
}: {
  eventId: string;
  guest: SendInviteGuest;
  facts: InviteEventFacts;
  template: string | null;
}) {
  const [template, setTemplate] = useState(initialTemplate);
  useEffect(() => setTemplate(initialTemplate), [initialTemplate]);
  return (
    <div className="mt-3 space-y-3 border-t border-ink/[0.06] pt-3" data-guest-send-invite="">
      <SendInviteActions eventId={eventId} guest={guest} facts={facts} template={template} />
      {guest.inviteUrl ? (
        <details className="group">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-[13px] font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline">
            Change the message
          </summary>
          <div className="pt-2">
            <InviteMessageEditor
              eventId={eventId}
              facts={facts}
              template={template}
              sample={guest}
              onSaved={setTemplate}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

/**
 * THE GUEST LIST'S INVITE COLUMN — one compact control per guest row (owner
 * 2026-09-30: *"the personal QR is found on the guest list. and we would want
 * the table to have that column to copy a message with the link and the photo
 * with it. and instructions on how to use it"*).
 *
 * 🔑 NOT A SECOND SENDER. It is the card's Send invite in a row's width: the
 * same message (`buildGuestInviteMessage`), the same QR file fetched ahead of
 * the tap (`useQrFile`), the same share (`shareInvite`), and the same ONE
 * writer for Sent ✓ (`setGuestInvitationSent`, which revalidates this page and
 * the Invitation page, so "Not sent yet (N)" falls).
 *
 *   · A PHONE — one tap opens the share sheet with the message AND the QR.
 *     An app taking it is the couple's send → Sent ✓. Closing it sends nothing.
 *   · A COMPUTER — Copy message, then Copy QR, and paste both. 🔑 A COPY IS
 *     NOT A SEND (the card's rule), so it offers "Mark as sent", never stamps.
 *
 * 🪤 THE QR IS FETCHED ONLY FOR A ROW ON SCREEN, AND ONLY ON A PHONE. The card
 * fetches on mount because there is one card; a list of 180 rows fetching 180
 * PNGs on arrival is a cost nobody asked for. A row that has been seen keeps
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
    | { kind: 'qr' }
    | { kind: 'qr-saved' }
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
  const file = useQrFile(guest.guestId, guest.fullName, Boolean(guest.inviteUrl) && onScreen);

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

  const message = (qrAttached: boolean) =>
    buildGuestInviteMessage({
      ...facts,
      formalName: guest.formalName,
      firstName: guest.firstName,
      guestName: guest.fullName,
      inviteUrl: guest.inviteUrl ?? '',
      template,
      qrAttached,
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
    // A phone: the share sheet, message + QR together. A computer: the panel —
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

  async function copyQr() {
    const out = await copyQrImage(guest.guestId, guest.fullName);
    setSaid(
      out === 'copied'
        ? { kind: 'qr' }
        : out === 'saved'
          ? { kind: 'qr-saved' }
          : { kind: 'error', text: 'We couldn’t get the QR just now. Try again.' },
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
              <button type="button" onClick={copyQr} className={small} data-guest-invite-copy-qr="">
                {said?.kind === 'qr' ? (
                  <Check aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2.25} />
                ) : (
                  <QrCode aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                )}
                {said?.kind === 'qr' ? 'Copied ✓' : 'Copy QR'}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-ink/60">Paste the message, then paste the QR.</p>
            <div aria-live="polite" className="space-y-1.5">
              {said?.kind === 'qr-saved' ? (
                <p className="text-xs text-ink/75">Your browser saved the QR as a file instead — attach it to the message.</p>
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
