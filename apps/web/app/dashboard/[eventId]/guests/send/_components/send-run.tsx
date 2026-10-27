'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Copy, MessageCircle, MessagesSquare, PhoneCall, Share, SkipForward, Smartphone, Undo2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { formatCount } from '@/lib/format-number';
import { buildGuestInviteMessage, type InviteEventFacts } from '@/lib/guest-invite-message';
import { runArrivals, runStanding } from '@/lib/guest-roster-view';
import {
  INVITE_APP_NAMES,
  inviteAppHint,
  inviteAppPlan,
  inviteAppSaid,
  inviteDevice,
  runInviteAppPlan,
  type InviteApp,
} from '@/lib/invite-app-links';
import { useAskOnReturn } from '@/lib/ask-on-return';
import {
  SEND_RUN_HINT_MS,
  sendRunHint,
  sendRunProgress,
  sendRunStatus,
  swipeStep,
  type RunGuestPage,
} from '@/lib/send-run-page';
import {
  InviteMessageEditor,
  shareInvite,
  ticketFileName,
  useTicketFile,
  type SendInviteGuest,
} from '../../_components/send-invite';
import { SentOrNotYet } from '../../_components/sent-or-not-yet';
import { hearAction } from '../../_components/hear-action';
import { useGuestActions } from '../../_components/guest-actions-context';

/** A guest as the run walks them: the shipped send fields + the page's details (`runGuestPage`). */
export type RunGuest = SendInviteGuest & { page?: RunGuestPage };

/** The event's ONE link and QR, when guests get in with one link for everyone (`readGuestsGetIn` = 'one_qr'). */
export type RunOneLink = { url: string; qrSvg: string | null };

/**
 * THE SEND RUN, REDRAWN SIMPLE — a full-screen, one-guest-at-a-time inviter (owner 2026-10-27/28, DECISION_LOG "THE SEND
 * RUN, REDRAWN SIMPLE" · "APPROVED — THE SIMPLE SEND RUN, PLUS SWIPE" · "CLOSING THE SEND RUN ALWAYS RETURNS TO THE GUEST
 * LIST" · "THE SEND RUN ALSO SERVES A ONE-QR EVENT" · "THE SEND RUN'S HINT LINE … FADES AFTER 10 S" · "APPROVED — ONE SEND
 * BUTTON FOR EVERY INVITE"; owner 2026-10-28 "invitation page still not the design we did"; prototype
 * `prototypes/send_run_simple_2026-10-27/`, frames guest · return · done).
 *
 *   ✕ · "12 sent · 153 more to invite" + its bar · Done for now   — both exits ALWAYS land on the Guest list
 *   the guest as a page: their QR (or the event's ONE QR) · "Invite 13 of 165" · the name · role (the neutral pill) ·
 *     side · group · their +1s · their mobile
 *   ONE Send — a phone: its own share sheet (`shareInvite`, the same sender as the card and the row); a computer (no
 *     share sheet): the shipped app rows (WhatsApp · Viber · Messenger, `inviteAppPlan`) + Copy message, in place
 *   Invite later — skips, no stamp; they stay To invite
 *   on the way back: "Did you send <name>'s invitation?" (the shipped `SentOrNotYet`) — Sent stamps
 *     `invitation_sent_at` (the ONE writer, `setGuestInvitationSent`) and moves on; Not yet stays
 *   swipe left = the next guest, right = the previous — nothing stamped; the card follows the finger and snaps;
 *     ← / → on a keyboard; no motion under reduced motion
 *   the hint line names the invitation's kind and fades after 10 s; the same words stay in the ⓘ, with Change the message
 *
 * 🔑 THE QUEUE IS SNAPSHOT ONCE (kept from the shipped run): a stamp revalidates the page and hands a fresh `guests`; a
 * queue derived from props would shift under the thumb. A later read can still take someone OUT (`runStanding` — they
 * declined) or bring someone IN at the end (`runArrivals`).
 */
export function SendRun({
  eventId,
  guests,
  measured,
  facts,
  template: initialTemplate,
  oneLink = null,
  guestsHref,
}: {
  eventId: string;
  guests: RunGuest[];
  measured: boolean;
  facts: InviteEventFacts;
  template: string | null;
  /** Present → a one-link event: every guest is sent the event's ONE link and QR. */
  oneLink?: RunOneLink | null;
  /** Where ✕ and Done for now land — the Guest list (the lab hands its own). */
  guestsHref?: string;
}) {
  const home = guestsHref ?? `/dashboard/${eventId}/guests`;
  const { setGuestInvitationSent } = useGuestActions();
  // A one-link event sends everyone the same link — so everyone is sendable, with the event's.
  const sendable = useMemo(
    () => (oneLink ? guests.map((g) => ({ ...g, inviteUrl: oneLink.url })) : guests.filter((g) => g.inviteUrl)),
    [guests, oneLink],
  );
  const noLink = guests.length - sendable.length;
  const [queue, setQueue] = useState<RunGuest[]>(() => sendable.filter((g) => !g.sentAt));
  const [at, setAt] = useState(0);
  const [sentHere, setSentHere] = useState<Record<string, string | null>>({});
  const [later, setLater] = useState<string[]>([]);
  const [template, setTemplate] = useState(initialTemplate);
  const [editing, setEditing] = useState(false);
  const [apps, setApps] = useState(false);
  const [said, setSaid] = useState<{ kind: 'copied' | 'app' | 'manual' | 'error'; text: string } | null>(null);
  const [asked, setAsked] = useState(false);
  const [pending, startTransition] = useTransition();
  const back = useAskOnReturn();

  const known = useRef<Set<string>>(new Set(sendable.map((g) => g.guestId)));
  useEffect(() => {
    const fresh = runArrivals(known.current, sendable, 'unsent');
    for (const g of sendable) known.current.add(g.guestId);
    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  }, [sendable]);

  const sentNow = useCallback(
    (g: RunGuest): string | null => (g.guestId in sentHere ? (sentHere[g.guestId] ?? null) : g.sentAt),
    [sentHere],
  );
  const sentCount = sendable.filter((g) => sentNow(g)).length;
  const leftCount = sendable.length - sentCount;
  const { index, current, position, total } = runStanding(queue, sendable, at);
  const currentSentAt = current ? sentNow(current) : null;
  const laterIn = later.filter((id) => sendable.some((g) => g.guestId === id && !sentNow(g)));
  const first = current ? current.firstName?.trim() || current.fullName.split(/\s+/)[0] || 'them' : 'them';

  // ── FULL SCREEN: drawn on the page itself (an event page's `<main>` is a containing block for `fixed` while its view
  //    transition name is on — `globals.css` `.sn-vt-page`), over the bars, with the page under it held still.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = was;
    };
  }, []);

  // ── The hint line: shown as the run opens, gone after 10 s (the ⓘ keeps the words).
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), SEND_RUN_HINT_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Moving to another guest closes this one's app list and words.
  useEffect(() => {
    setApps(false);
    setSaid(null);
  }, [current?.guestId]);

  const file = useTicketFile(
    current?.guestId ?? '',
    ticketFileName(current?.fullName ?? ''),
    Boolean(current && !oneLink && current.inviteUrl && current.hasTicket !== false),
    current?.ticketVersion,
  );

  const message = (ticketAttached: boolean) =>
    current
      ? (buildGuestInviteMessage({
          ...facts,
          formalName: current.formalName,
          firstName: current.firstName,
          guestName: current.fullName,
          inviteUrl: current.inviteUrl ?? '',
          template,
          ticketAttached,
        }) ?? '')
      : '';

  const goNext = useCallback(
    (skip: boolean) => {
      if (!current) return;
      if (skip && !sentNow(current)) setLater((l) => (l.includes(current.guestId) ? l : [...l, current.guestId]));
      setAt(index + 1);
    },
    [current, index, sentNow],
  );
  const goPrev = useCallback(() => {
    const live = new Set(sendable.map((g) => g.guestId));
    let i = index - 1;
    while (i >= 0 && !live.has(queue[i]!.guestId)) i -= 1;
    if (i >= 0) setAt(i);
  }, [index, queue, sendable]);

  function mark(sent: boolean, advance: boolean) {
    if (!current) return;
    const id = current.guestId;
    startTransition(async () => {
      const res = await hearAction(() => setGuestInvitationSent(eventId, id, sent));
      if (res.ok) {
        setSentHere((m) => ({ ...m, [id]: res.sentAt }));
        setLater((l) => l.filter((x) => x !== id));
        setSaid(null);
        if (advance) setAt(index + 1);
      } else {
        setSaid({ kind: 'error', text: sent ? 'We couldn’t save that it was sent. Try again.' : 'We couldn’t undo that just now. Try again.' });
      }
    });
  }

  /** ONE Send: a phone's share sheet; a computer (or a sheet that refuses) — the app rows + Copy, here. */
  async function send() {
    if (!current) return;
    setSaid(null);
    const device = inviteDevice();
    if (device.touch && device.share) {
      const out = await shareInvite(oneLink ? null : (file ?? null), message);
      if (out === 'shared') return setAsked(true); // back from the app — ask (owner: "Sent / Not yet")
      if (out === 'closed') return;
    }
    setApps((o) => !o);
  }

  async function viaApp(app: InviteApp) {
    const device = inviteDevice();
    const text = message(false);
    const plan = inviteAppPlan(app, text, device);
    if (plan.kind === 'share') return send();
    if (!currentSentAt) back.arm(); // armed AT the press — the app can hide this page before the promise settles
    const out = await runInviteAppPlan(plan, text, device.touch);
    setSaid(out === 'manual' ? { kind: 'manual', text } : { kind: 'app', text: inviteAppSaid(app, plan, first) });
  }

  async function copyMessage() {
    const text = message(false);
    if (!currentSentAt) back.arm();
    try {
      await navigator.clipboard.writeText(text);
      setSaid({ kind: 'copied', text: `Copied — paste it to ${first} in Messenger or Viber.` });
    } catch {
      setSaid({ kind: 'manual', text });
    }
  }

  // ── ← / → on a keyboard (never while typing, never under an open question or sheet).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (editing || asked || back.asking || t?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      if (e.key === 'ArrowRight') goNext(true);
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, editing, asked, back.asking]);

  // ── SWIPE: the card follows the finger (not under reduced motion) and snaps; left = next, right = previous.
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number; dx: number; dy: number } | null>(null);
  const still = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const place = (dx: number, animate: boolean) => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = animate && !still() ? 'transform 200ms ease' : 'none';
    el.style.transform = dx ? `translateX(${dx}px)` : '';
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button,a,input,textarea,[role="dialog"]')) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, dx: 0, dy: 0 };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dx = e.clientX - d.x;
    d.dy = e.clientY - d.y;
    if (Math.abs(d.dx) > Math.abs(d.dy) && !still()) place(d.dx, false);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    const step = swipeStep(d.dx, d.dy);
    place(0, true);
    if (step === 'next') goNext(true);
    else if (step === 'prev') goPrev();
  };

  const status = sendRunStatus(sentCount, leftCount);
  const hintWords = sendRunHint(Boolean(oneLink));
  const before = Math.max(0, sendable.length - total); // sent before this run's queue — the eyebrow counts on from them

  const step =
    'flex min-h-[48px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[14px] font-medium text-ink transition-colors hover:bg-ink/5';
  const APP_ICON = { whatsapp: MessageCircle, viber: PhoneCall, messenger: MessagesSquare } as const;

  const body = !measured ? (
    <p role="status" className="mx-auto mt-10 max-w-sm px-6 text-center text-sm text-ink/80">
      We couldn&rsquo;t load your guest list just now, so we can&rsquo;t say who still needs their invite. Try again in a moment.
    </p>
  ) : current ? (
    <div
      ref={cardRef}
      className="relative flex min-h-0 flex-1 touch-pan-y select-none flex-col items-center overflow-y-auto px-6 pb-4 pt-6 text-center"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-live="polite"
      data-send-run-guest={current.guestId}
    >
      <div className="rounded-3xl bg-white p-3 shadow-[0_10px_30px_-14px_rgba(30,34,41,0.35)]" data-send-run-qr="">
        {oneLink?.qrSvg ? (
          <div className="qr-slot h-[168px] w-[168px] [&_svg]:h-full [&_svg]:w-full" aria-label="The event’s QR" role="img" dangerouslySetInnerHTML={{ __html: oneLink.qrSvg }} />
        ) : oneLink ? null : (
          // eslint-disable-next-line @next/next/no-img-element -- our own gated QR route, the same bytes as Download
          <img src={`/api/website/qr/guest/${current.guestId}`} alt={`${current.fullName}’s QR`} width={168} height={168} className="h-[168px] w-[168px] object-contain" draggable={false} />
        )}
      </div>
      <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50" data-send-run-position="">
        Invite {formatCount(before + position)} of {formatCount(sendable.length)}
      </p>
      <h2 className="mt-1 break-words font-display text-[30px] leading-tight text-ink" data-send-run-name="">
        {current.fullName}
      </h2>
      {current.page ? (
        <div className="mt-2 flex flex-col items-center gap-1.5 text-[14px] text-ink/65">
          <span className="rounded-full bg-ink/[0.07] px-3 py-1 text-[13px] font-medium text-ink" data-send-run-role="">
            {current.page.roleWord}
          </span>
          {current.page.place ? <span data-send-run-place="">{current.page.place}</span> : null}
          {current.page.plusOnes.map((line, i) => (
            <span key={i} className="text-ink" data-send-run-plus="">
              {line}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5" data-send-run-mobile="">
            <Smartphone aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {current.page.mobile ?? 'No number — share by link'}
          </span>
        </div>
      ) : null}
      {currentSentAt ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink" data-send-run-sent="">
          <Check aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2.25} /> Sent
          <ActionButton tone="neutral" quiet icon={Undo2} label="Undo" onClick={() => mark(false, false)} disabled={pending} />
        </p>
      ) : null}
      {/* ‹ › — the only hint that the card swipes; also the way on a computer. */}
      <span className="absolute left-1 top-1/2 -translate-y-1/2">
        <ActionButton tone="neutral" quiet iconOnly icon={ChevronLeft} label="Previous guest" onClick={goPrev} disabled={index === 0} />
      </span>
      <span className="absolute right-1 top-1/2 -translate-y-1/2">
        <ActionButton tone="neutral" quiet iconOnly icon={ChevronRight} label="Next guest" onClick={() => goNext(true)} />
      </span>
    </div>
  ) : (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center" data-send-run-done="">
      <Check aria-hidden className="h-9 w-9 text-success-600" strokeWidth={2} />
      <p className="font-display text-2xl text-ink">
        {sendable.length === 0 ? 'Nobody to send to yet.' : leftCount === 0 ? 'Everyone has their invite.' : `${formatCount(sentCount)} sent.`}
      </p>
      {laterIn.length ? (
        <ActionButton
          tone="brand"
          main
          icon={SkipForward}
          label={`Go through the ${laterIn.length} for later`}
          onClick={() => {
            setQueue(queue.filter((g) => laterIn.includes(g.guestId)));
            setAt(0);
            setLater([]);
          }}
        />
      ) : null}
      <ActionButton tone="neutral" icon={ChevronLeft} label="Back to the Guest list" href={home} data-testid="send-run-back" />
    </div>
  );

  const screen = (
    <div
      className="fixed inset-0 z-[110] flex h-[100dvh] flex-col bg-cream pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
      aria-label="Send invites"
      data-send-run=""
    >
      {/* ── ✕ · the status and its bar · Done for now ── */}
      <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-3 pt-2">
        <ActionButton tone="neutral" quiet iconOnly icon={X} label="Close — back to the Guest list" href={home} data-testid="send-run-close" />
        <div className="min-w-0 flex-1 text-center">
          {/* A refused read is unknown — never "0 more to invite". */}
          {measured ? (
          <>
          <p className="text-[14px] tabular-nums text-ink/60" data-send-run-count="">
            <b className="font-semibold text-ink">{formatCount(sentCount)}</b> sent · <b className="font-semibold text-ink">{formatCount(leftCount)}</b> more to invite
            <span className="sr-only"> ({status})</span>
          </p>
          <div className="mx-auto mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-ink/10" aria-hidden>
            <div className="h-full rounded-full bg-terracotta" style={{ width: `${Math.round(sendRunProgress(sentCount, leftCount) * 100)}%` }} />
          </div>
          </>
          ) : null}
        </div>
        <ActionButton tone="brand" quiet label="Done for now" href={home} data-testid="send-run-done-for-now" />
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col">{body}</div>

      {/* ── ONE Send · Invite later · the hint line ── */}
      <div className="mx-auto w-full max-w-xl space-y-2 px-5 pb-3">
        {measured && current ? (
          <>
            {apps ? (
              <div className="rounded-2xl bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(30,26,18,.45)] dark:bg-raised" role="group" aria-label="Send in an app" data-send-run-apps="">
                {(['whatsapp', 'viber', 'messenger'] as const).map((app) => {
                  const Icon = APP_ICON[app];
                  return (
                    <button key={app} type="button" className={step} onClick={() => viaApp(app)} data-send-run-app={app}>
                      <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block">{INVITE_APP_NAMES[app]}</span>
                        <span className="block text-[11.5px] font-normal text-ink/55">{inviteAppHint(app, inviteDevice())}</span>
                      </span>
                    </button>
                  );
                })}
                <button type="button" className={step} onClick={copyMessage} data-send-run-copy="">
                  <Copy aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="flex-1">Copy message</span>
                </button>
              </div>
            ) : null}
            <div aria-live="polite">
              {said?.kind === 'copied' || said?.kind === 'app' ? (
                <p className="flex flex-wrap items-center justify-center gap-2 text-center text-[13px] text-ink/75" data-send-run-said="">
                  <span>{said.text}</span>
                  {currentSentAt ? null : (
                    <ActionButton tone="neutral" quiet icon={Check} label="Mark as sent" onClick={() => mark(true, true)} disabled={pending} />
                  )}
                </p>
              ) : null}
              {said?.kind === 'manual' ? (
                <textarea
                  className="w-full rounded-xl border border-ink/15 bg-white p-3 text-sm leading-relaxed text-ink dark:bg-raised"
                  readOnly
                  value={said.text}
                  rows={5}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="The message — select it and copy it"
                />
              ) : null}
              {said?.kind === 'error' ? (
                <p role="alert" className="text-center text-[13px] text-danger-700">
                  {said.text}
                </p>
              ) : null}
            </div>
            <ActionButton
              tone="brand"
              main
              icon={Share}
              label={currentSentAt ? 'Send again' : 'Send'}
              name={`Send ${current.fullName}’s invitation`}
              onClick={send}
              disabled={pending || (!oneLink && file === undefined)}
              aria-expanded={apps}
              className="min-h-[52px] w-full justify-center"
              data-testid="send-run-send"
            />
            {currentSentAt ? (
              <ActionButton tone="neutral" quiet icon={ChevronRight} label="Next" onClick={() => goNext(false)} className="w-full justify-center" data-testid="send-run-next" />
            ) : (
              <ActionButton tone="neutral" quiet icon={SkipForward} label="Invite later" onClick={() => goNext(true)} className="w-full justify-center" data-testid="send-run-later" />
            )}
          </>
        ) : null}
        <div className="flex items-start gap-2 pt-1">
          <p
            className={`flex-1 text-[13px] leading-snug text-ink/55 transition-opacity duration-700 motion-reduce:transition-none ${hint ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={!hint}
            data-send-run-hint={hint ? 'on' : 'off'}
          >
            {hintWords}
          </p>
          <InfoTip label="About sending invites" labelClassName="sr-only" align="end">
            {hintWords} We send nothing for you.{noLink > 0 ? ` ${noLink} ${noLink === 1 ? 'guest has' : 'guests have'} no personal link yet and ${noLink === 1 ? 'is' : 'are'} left out — New QR on their card gives them one.` : ''}{' '}
            <button type="button" className="font-medium text-ink underline underline-offset-4" onClick={() => setEditing(true)} data-send-run-edit="">
              {template ? 'Change your message' : 'Change the message'}
            </button>
          </InfoTip>
        </div>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} labelledById="send-run-message-title">
        <div className="space-y-3 px-4 pb-6 pt-2">
          <h2 id="send-run-message-title" className="font-display text-xl text-ink">
            The message
          </h2>
          <InviteMessageEditor eventId={eventId} facts={facts} template={template} sample={current ?? sendable[0] ?? null} onSaved={setTemplate} />
        </div>
      </Sheet>

      <SentOrNotYet
        open={(asked || back.asking) && Boolean(current) && !currentSentAt}
        name={first}
        onSent={() => {
          setAsked(false);
          back.settle();
          mark(true, true);
        }}
        onNotYet={() => {
          setAsked(false);
          back.settle();
        }}
      />
    </div>
  );

  return mounted ? createPortal(screen, document.body) : screen;
}
