'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Check, Copy, Mail, RotateCcw, Share2, SquareCheck, X } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { Count } from '@/components/count';
import { Sheet } from '@/app/_components/sheet';
import { FormRow, FormRows } from '@/app/_components/form-row';
import type { RsvpAskConfig } from '@/lib/rsvp-ask';
import {
  GUESTS_GET_IN_LABEL,
  guestsGetInPatch,
  guestsGetInPersonal,
  guestsGetInReplies,
  readGuestsGetIn,
} from '@/lib/who-can-reply';
import {
  FINALIZE_LOCKED_TITLE,
  FINALIZE_NOW_LABEL,
  FINALIZE_SHEET,
  FINALIZE_TIP,
  FINALIZE_TITLE,
  REOPEN_LABEL,
  headcountLockedLine,
  headcountOpenLine,
} from '@/lib/headcount-row';
import { useGuestActions } from '../../guests/_components/guest-actions-context';
import { GuestsGetIn } from './guests-get-in';
import { RsvpAsks } from './rsvp-asks';
import { ReplyBy } from './reply-by';
import type { OneLink } from './one-link.server';
import { asksFrame, getInFrame, replyByFrame } from './setup-frames';

/** 📨 The Invitations row's words (HOME_AND_GUESTS_CHECK G26). */
export const INVITATIONS_TITLE = 'Invitations';
export const ONE_LINK_TITLE = 'Your one link';
/** Behind the Invitations row's ⓘ — how the run works; the count of who is left stays on the row. */
export const INVITATIONS_ABOUT = 'One by one from your phone — Viber, Messenger, WhatsApp or SMS.';
/** Behind the one link's ⓘ. */
export const ONE_LINK_ABOUT = 'Whoever opens it is in.';
/** Two buttons on a row never take more than this share of it: the name keeps the rest (the button rule's 3b). */
const ACTS = 'flex min-w-0 max-w-[58%] items-center gap-2';

export type HeadcountView = {
  locked: boolean;
  /** Who said yes, now (null = unread). */
  attending: number | null;
  /** The count Finalize would lock / has locked (`resolveLivePax` / `final_pax`). */
  heads: number | null;
};

/**
 * ⚙ GUESTS › SETUP — the guest settings the Event Hub Maker reads, each edited
 * in place (owner 2026-10-07: *"Setup?"* · *"guests settings is here"*;
 * DECISION_LOG "GUESTS › SETUP"; prototype `home_and_guests_2026-10-07_fable.html`
 * → Guests → Setup). Rows, in order, the words left and ONE control right:
 *
 *   1. How guests get in   `GuestsGetIn` (shared with the Maker)
 *   2. Invitations         ✉ Send to N · ☑ Pick who, and the guest's Digital Pass
 *                          (personal choices only)
 *   3. Your one link       link · Copy · Share + the QR (Open · Anyone with the link only)
 *   4. RSVP asks           `RsvpAsks` (shared) — "They reply" choices only
 *   5. Reply by            `ReplyBy` (shared) — "They reply" choices only
 *   6. Finalize guest list ✓ Finalize now → one sheet, one way — every list
 *                          (owner 2026-10-07: *"finalize should be inside the
 *                          Setup. not on its current location"* — it left the
 *                          header above List · Map · Setup)
 *
 * 🚫 No message field (owner: *"your message should be on the event hub
 * maker"*), no Nudge, no per-row Invite.
 *
 * 💾 One setting, two doors: How guests get in and the asks are `events.
 * rsvp_ask_config`, saved through the SAME draft door the Maker uses
 * (`hubDraftAction` intent=save, the WHOLE object each time) — so Setup and the
 * Maker can never hold two values. Like every Maker change, guests meet it
 * after Apply; the row says so while it waits. Reply by saves live (its one
 * writer, `updatePaxSettings`). Zero new server actions.
 */
export function GuestSetupRows({
  eventId,
  config,
  drafted,
  reply,
  toInvite,
  passSrc,
  oneLink,
  headcount,
}: {
  eventId: string;
  /** Drafted-over-live `rsvp_ask_config` (sparse — an absent ask is ON). */
  config: RsvpAskConfig;
  /** The draft holds a different config from what guests see. */
  drafted: boolean;
  /** The reply-by date's own value + pricing view; null = could not be read. */
  reply: { own: string | null; pricingMode: 'realtime' | 'final_only'; fallback: string | null } | null;
  /** Guests not yet sent an invitation (null = the list could not be read). */
  toInvite: number | null;
  /** The shipped Digital Pass picture — the first guest who is coming. */
  passSrc: string;
  oneLink: OneLink;
  headcount: HeadcountView;
}) {
  /* The shipped actions — the dev lab hands in stand-ins (`guest-actions-context.tsx`). Held under their own names. */
  const { hubDraftAction, updatePaxSettings } = useGuestActions();
  const [local, setLocal] = useState<RsvpAskConfig>(config);
  const latest = useRef<RsvpAskConfig>(config);
  const saved = useRef<RsvpAskConfig>(config);
  const newest = useRef(0);
  const [waiting, setWaiting] = useState(drafted);
  const [error, setError] = useState<string | null>(null);

  /* Re-seed when the server's value changes (another tab, Apply in the Maker). */
  const configKey = JSON.stringify(config);
  useEffect(() => {
    const next = JSON.parse(configKey) as RsvpAskConfig;
    saved.current = next;
    latest.current = next;
    setLocal(next);
    setWaiting(drafted);
  }, [configKey, drafted]);

  const save = (patch: RsvpAskConfig, what: string) => {
    const next: RsvpAskConfig = { ...latest.current, ...patch };
    latest.current = next;
    setLocal(next); // on screen at the tap
    setError(null);
    const tap = ++newest.current;
    void (async () => {
      let refused: string | null = null;
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { rsvp_ask_config: next } }));
        const r = await hubDraftAction(eventId, fd);
        if (r.ok) {
          saved.current = next;
          setWaiting(true);
        } else refused = r.error || 'Please try again.';
      } catch {
        refused = 'Please try again.';
      }
      if (refused !== null && tap === newest.current) {
        latest.current = saved.current;
        setLocal(saved.current);
        setError(`${what} did not save, so it is back as it was. ${refused}`);
      }
    })();
  };

  const getIn = readGuestsGetIn(local);
  const personal = guestsGetInPersonal(getIn);
  const replies = guestsGetInReplies(getIn);

  return (
    <div className="pb-6" data-guest-setup="" data-get-in={getIn}>
      {/* ONE list of the app's Form rows (`FormRows`): the pills share one width and one field is open at a time. The three shared
          parts are handed the SAME frames the Maker hands them (`setup-frames.tsx`) — one part, one look, in both doors. */}
      <FormRows data="guest-setup">
        <GuestsGetIn frame={getInFrame} value={getIn} onPick={(v) => save(guestsGetInPatch(v), `“${GUESTS_GET_IN_LABEL}”`)} />
        {waiting ? (
          <p className="-mt-1 pb-2.5 pl-0.5 text-[12.5px] text-ink/55" data-setup-waiting="">
            Saved — guests see it after you Apply in the Event Hub Maker.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="-mt-1 pb-2.5 pl-0.5 text-[12.5px] font-semibold text-danger-700">
            {error}
          </p>
        ) : null}

        {personal ? <InvitationsRow eventId={eventId} toInvite={toInvite} passSrc={passSrc} /> : null}
        {getIn === 'one_qr' ? <OneLinkRow link={oneLink} /> : null}
        {replies ? <RsvpAsks frame={asksFrame} config={local} onToggle={(field, v) => save({ [field]: v }, 'That question')} /> : null}
        {replies ? (
          reply ? (
            <ReplyBy
              layout="frame"
              frame={replyByFrame}
              eventId={eventId}
              own={reply.own}
              pricingMode={reply.pricingMode}
              fallback={reply.fallback}
              action={updatePaxSettings}
            />
          ) : (
            <FormRow data="reply-by" name="Reply by" attrs={{ 'data-setup-row': 'reply-by' }} problem="We couldn’t read it just now." />
          )
        ) : null}
        <FinalizeRow eventId={eventId} view={headcount} />
      </FormRows>
    </div>
  );
}

/** ✉ INVITATIONS — the shipped one-by-one run (`/guests/send`), and what each guest gets. */
function InvitationsRow({ eventId, toInvite, passSrc }: { eventId: string; toInvite: number | null; passSrc: string }) {
  const { setupDoorHref } = useGuestActions();
  const acts = useRef<HTMLSpanElement>(null);
  useFitRow(acts);
  const [passFailed, setPassFailed] = useState(false);
  return (
    <FormRow
      data="invitations"
      name={INVITATIONS_TITLE}
      about={{ words: INVITATIONS_ABOUT }}
      attrs={{ 'data-setup-row': 'invitations' }}
      line={
        toInvite === null ? (
          'We couldn’t count who is left to invite just now.'
        ) : (
          <>
            <Count value={toInvite} id="setup-to-invite" /> to invite.
          </>
        )
      }
      /* 🎫 THEIR DIGITAL PASS (owner: *"and show their Digital Pass"*) — the shipped ticket
          (`/api/hub-print/pass`, the first guest who is coming, their own QR), so the couple
          sees what each guest gets. A picture that fails says so. */
      below={
        <div className="pb-3" data-setup-pass="">
          {passFailed ? (
            <p className="text-[13px] text-ink/60">We couldn&rsquo;t draw a Digital Pass just now.</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={passSrc}
              alt="A guest’s Digital Pass"
              className="mx-auto block h-auto w-full max-w-[320px] rounded-xl"
              onError={() => setPassFailed(true)}
            />
          )}
        </div>
      }
    >
      <span ref={acts} className={ACTS}>
        {toInvite === 0 ? (
          <ActionButton tone="ok" quiet icon={Check} label="Everyone invited" disabled />
        ) : (
          <ActionButton
            tone="brand"
            main
            icon={Mail}
            label={toInvite === null ? 'Send' : `Send to ${toInvite}`}
            href={setupDoorHref(eventId, 'send')}
            data-testid="setup-send"
          />
        )}
        <ActionButton
          tone="neutral"
          icon={SquareCheck}
          label="Pick who"
          href={setupDoorHref(eventId, 'pick-who')}
          data-testid="setup-pick-who"
        />
      </span>
    </FormRow>
  );
}

/** 🔗 YOUR ONE LINK — Open · Anyone with the link only (G27): link · Copy · Share + the one QR. */
function OneLinkRow({ link }: { link: OneLink }) {
  const acts = useRef<HTMLSpanElement>(null);
  useFitRow(acts);
  const [copied, setCopied] = useState(false);
  if (!link.url) {
    return <FormRow data="one-link" name={ONE_LINK_TITLE} attrs={{ 'data-setup-row': 'one-link' }} line={link.notice} />;
  }
  const url = link.url;
  const shown = url.replace(/^https?:\/\//, '');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url });
        return;
      } catch {
        return; // the couple closed the share sheet
      }
    }
    await copy();
  };
  return (
    <FormRow
      data="one-link"
      name={ONE_LINK_TITLE}
      about={{ words: ONE_LINK_ABOUT }}
      attrs={{ 'data-setup-row': 'one-link' }}
      line={<span className="break-all">{shown}</span>}
      below={
        link.qrSvg ? (
          <div className="pb-3" data-setup-one-qr="">
            <div
              className="qr-slot mx-auto h-[168px] w-[168px] rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: link.qrSvg }}
            />
          </div>
        ) : null
      }
    >
      <span ref={acts} className={ACTS}>
        <ActionButton tone="brand" main icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy'} onClick={copy} />
        <ActionButton tone="neutral" icon={Share2} label="Share" onClick={share} />
      </span>
    </FormRow>
  );
}

/**
 * 🔒 FINALIZE GUEST LIST — closes replies; the hosts can reopen (owner
 * 2026-10-07: *"finalize means the guestlist is finalized and guests cannot
 * answer anymore. but the host of the event … always have the power to
 * unfinalize it"*). Open → `✓ Finalize now` → ONE sheet ("Guests can't reply
 * after this. You can reopen it any time.", `✓ Finalize` · `✕ Not now`).
 * Locked → the locked count and `↻ Reopen guest list`. A refused press is said
 * under the row.
 */
function FinalizeRow({ eventId, view }: { eventId: string; view: HeadcountView }) {
  const router = useRouter();
  const { setGuestListFinalized } = useGuestActions();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const heads = view.heads ?? view.attending ?? 0;
  const finalize = () =>
    start(async () => {
      setError(null);
      const res = await setGuestListFinalized(eventId, true);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  /* ↻ The hosts' way back (owner 2026-10-07). This panel renders for the couple only
     (`invite-panel.tsx`), and `reopenGuestList` refuses anyone else on the server. */
  const reopen = () =>
    start(async () => {
      setError(null);
      const res = await setGuestListFinalized(eventId, false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });

  return (
    <>
      <FormRow
        data="finalize"
        name={view.locked ? FINALIZE_LOCKED_TITLE : FINALIZE_TITLE}
        about={view.locked ? null : { words: FINALIZE_TIP }}
        attrs={{ 'data-setup-row': 'finalize', 'data-guest-list-finalize': view.locked ? 'finalized' : 'open' }}
        line={
          view.locked
            ? headcountLockedLine(view.heads)
            : view.attending === null
              ? 'We couldn’t count who is coming just now.'
              : headcountOpenLine(view.attending)
        }
        problem={error}
      >
        <span className={ACTS}>
          {!view.locked ? (
            <ActionButton
              tone="ok"
              main
              icon={Check}
              label={FINALIZE_NOW_LABEL}
              aria-haspopup="dialog"
              onClick={() => setOpen(true)}
              data-testid="setup-finalize-now"
            />
          ) : (
            <ActionButton
              tone="neutral"
              icon={RotateCcw}
              label={pending ? 'Reopening…' : REOPEN_LABEL}
              disabled={pending}
              onClick={reopen}
              data-testid="setup-reopen"
            />
          )}
        </span>
      </FormRow>
      {/* Portalled to <body>: the Guests screen is its own stacking context, and a sheet left
          inside it drew UNDER the bottom nav — its Finalize · Not now hidden (measured in the lab). */}
      {open && typeof document !== 'undefined'
        ? createPortal(
      <Sheet open={open} onClose={() => (pending ? undefined : setOpen(false))} labelledById="setup-finalize-title" rise>
        <div className="flex flex-col gap-2 p-5" data-finalize-sheet="">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">{FINALIZE_SHEET.eyebrow}</p>
          <p id="setup-finalize-title" className="font-serif text-xl text-ink">
            {FINALIZE_SHEET.title(heads)}
          </p>
          <p className="text-[14px] text-ink/75">{FINALIZE_SHEET.body()}</p>
          <div className="mt-3 flex items-center gap-2">
            <ActionButton
              tone="ok"
              main
              icon={Check}
              label={pending ? 'Finalizing…' : FINALIZE_SHEET.confirm}
              disabled={pending}
              onClick={finalize}
              data-testid="setup-finalize-go"
            />
            <ActionButton tone="danger" icon={X} label={FINALIZE_SHEET.cancel} disabled={pending} onClick={() => setOpen(false)} />
          </div>
          {error ? (
            <p role="alert" className="text-[13px] text-terracotta-700">
              {error}
            </p>
          ) : null}
        </div>
      </Sheet>,
            document.body,
          )
        : null}
    </>
  );
}
