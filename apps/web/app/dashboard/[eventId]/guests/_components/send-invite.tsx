'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Check, Copy, Download, Send, Undo2 } from 'lucide-react';
import { SaveFileLink } from '@/app/_components/save-file-link';
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
    const nav = typeof navigator !== 'undefined' ? (navigator as ShareNav) : null;
    const path = inviteSendPath({
      share: typeof nav?.share === 'function',
      filesOk: Boolean(file && nav?.canShare?.({ files: [file] })),
    });
    if (nav && path !== 'copy') {
      try {
        await nav.share(
          path === 'files' && file ? { files: [file], text: message(true) } : { text: message(false) },
        );
        // The phone handed it to an app — that is the couple's send.
        mark(true);
        return;
      } catch (err) {
        // They closed the sheet — not a failure, and nothing was sent.
        if ((err as { name?: string })?.name === 'AbortError') return;
        // Any other refusal (a webview without file sharing, a spent
        // activation) falls through to the copy, which always works.
      }
    }
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
              {new Date(sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
