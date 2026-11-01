'use client';

import { useEffect, useRef, useState, useTransition, type MouseEvent } from 'react';
import { Check, ChevronRight, Copy, RotateCcw, Share2, X } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { ChosenRow, FormRow, FormRows } from '@/app/_components/form-row';
import { readOneAtATime, type RsvpAskConfig } from '@/lib/rsvp-ask';
import type { KeepAnswer } from '@/lib/form-row';
import { HOW_GUESTS_ANSWER_ABOUT, HOW_GUESTS_ANSWER_LABEL, HOW_GUESTS_ANSWER_OPTIONS } from '@/lib/how-guests-answer';
/* 📬 Replies open ▾ · Replies close ▾ — the Maker's own part, mounted here too (R1: it was the Studio RSVP tile's). */
import { RepliesWindowRows } from '../../launch/_components/replies-window-rows';
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
import { useGuestActions, useOpenRequests } from '../../guests/_components/guest-actions-context';
import { GuestConfirmActions, GuestPopup } from '../../guests/_components/guest-popup';
import { plainRefusal } from '../../guests/_components/plain-refusal';
import { GuestsGetIn } from './guests-get-in';
import { RsvpAsks } from './rsvp-asks';
import { ReplyBy } from './reply-by';
import type { OneLink } from './one-link.server';
import { asksFrame, getInFrame, replyByFrame } from './setup-frames';
import { GUESTS_SETTINGS_CLUSTERS } from '@/lib/event-settings-record';

export const ONE_LINK_TITLE = 'Your one link';
/** Behind the one link's ⓘ. */
export const ONE_LINK_ABOUT = 'Whoever opens it is in.';
/** 📥 Requests to join — the row's words (prototype § 4). */
export const REQUESTS_TITLE = 'Requests to join';
export const REQUESTS_LINE = 'People who asked through the link';
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
 *   2. (Invitations — GONE, R4 slice 11: sending lives where the guests are — the List's "To invite" count door
 *      with its Invite N ›, and Select › ✉ Invite N; the run itself is `/guests/send`. The ⚙ holds settings only.)
 *   3. Your one link       link · Copy · Share + the QR (Open · Anyone with the link only)
 *   4. RSVP asks           `RsvpAsks` (shared) — "They reply" choices only
 *   4b. How guests answer  All at once · One by one (`oneAtATime`) — "They reply" choices only
 *   5. Reply by            `ReplyBy` (shared) — "They reply" choices only
 *   5b. Replies open/close `RepliesWindowRows` (the Maker's part) — "They reply" choices only
 *      🗂 4b and 5b MOVED HERE in R1 (owner 2026-10-27/28, "RSVP SETTINGS LIVE IN THE GUESTS ⚙"): the Studio RSVP tile
 *      was the only other place they lived, and it is gone. The words the reply page says (its eyebrow, question, hint,
 *      Yes / No) stay the Reply page's — typed on its lines in the Invitation stage, where guests read them.
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
  oneLink,
  headcount,
  requests = null,
}: {
  eventId: string;
  /** Drafted-over-live `rsvp_ask_config` (sparse — an absent ask is ON). */
  config: RsvpAskConfig;
  /** The draft holds a different config from what guests see. */
  drafted: boolean;
  /** The reply-by date's own value + pricing view; null = could not be read. */
  reply: { own: string | null; pricingMode: 'realtime' | 'final_only'; fallback: string | null } | null;
  oneLink: OneLink;
  headcount: HeadcountView;
  /** Requests to join waiting (null = not counted — the row still opens the list). */
  requests?: number | null;
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

  const save = (patch: RsvpAskConfig, what: string): Promise<KeepAnswer> => {
    const next: RsvpAskConfig = { ...latest.current, ...patch };
    latest.current = next;
    setLocal(next); // on screen at the tap
    setError(null);
    const tap = ++newest.current;
    return (async (): Promise<KeepAnswer> => {
      let refused: string | null = null;
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { rsvp_ask_config: next } }));
        const r = await hubDraftAction(eventId, fd);
        if (r.ok) {
          saved.current = next;
          setWaiting(true);
        } else refused = plainRefusal(r.error, 'Please try again.');
      } catch {
        refused = 'Please try again.';
      }
      if (refused !== null && tap === newest.current) {
        latest.current = saved.current;
        setLocal(saved.current);
        /* The action's own words only if they are a plain sentence — never the database's (`plain-refusal.ts`). */
        setError(`${what} did not save, so it is back as it was. ${refused}`);
      }
      /* The row hears it too — but says nothing of its own: the sheet's one line above already did. */
      return refused === null ? { ok: true } : { ok: false, error: null };
    })();
  };
  /** ❓ How guests answer — the one writer of `oneAtATime` here; picking the stored answer writes nothing. */
  const oneAtATime = readOneAtATime(local);
  const pickAnswer = (value: string) => {
    const next = value === 'one';
    if (next !== oneAtATime) void save({ oneAtATime: next }, `“${HOW_GUESTS_ANSWER_LABEL}”`);
  };

  const getIn = readGuestsGetIn(local);
  const personal = guestsGetInPersonal(getIn);
  const replies = guestsGetInReplies(getIn);

  return (
    <div className="pb-6" data-guest-setup="" data-get-in={getIn}>
      {/* ONE list of the app's Form rows (`FormRows`): the pills share one width and one field is open at a time. The three shared
          parts are handed the SAME frames the Maker hands them (`setup-frames.tsx`) — one part, one look, in both doors. */}
      <FormRows data="guest-setup">
        {/* ⚙ THREE CLUSTERS (owner 2026-10-27, settings per menu; prototype § 4): Getting in · Replies · Closing the list. */}
        <ClusterHead name={GUESTS_SETTINGS_CLUSTERS[0]} first />
        <GuestsGetIn frame={getInFrame} value={getIn} onPick={(v) => void save(guestsGetInPatch(v), `“${GUESTS_GET_IN_LABEL}”`)} />
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

        {getIn === 'one_qr' ? <OneLinkRow link={oneLink} /> : null}
        <ClusterHead name={GUESTS_SETTINGS_CLUSTERS[1]} />
        {replies ? <RsvpAsks frame={asksFrame} config={local} onToggle={(field, v) => void save({ [field]: v }, 'That question')} /> : null}
        {replies ? (
          /* ❓ Any set of choices is ONE dropdown (owner 2026-09-28, "again") — the same PickMenu-in-a-Form-row as How
             guests get in and Replies open beside it; what each choice means is behind the ⓘ and on its option. */
          <ChosenRow
            data="how-guests-answer"
            name={HOW_GUESTS_ANSWER_LABEL}
            about={{ words: HOW_GUESTS_ANSWER_ABOUT }}
            value={oneAtATime ? 'one' : 'all'}
            options={HOW_GUESTS_ANSWER_OPTIONS}
            onPick={pickAnswer}
            dataAttr="data-setup-answer"
            attrs={{ 'data-setup-row': 'answer' }}
          />
        ) : null}
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
        {/* 📬 When replies open and close — under the date they can close on, the same one object, drafted. */}
        {replies ? <RepliesWindowRows config={local} setupRow="replies-window" onSave={(patch, what) => save(patch, what)} /> : null}
        <RequestsRow eventId={eventId} waiting={requests} />
        <ClusterHead name={GUESTS_SETTINGS_CLUSTERS[2]} />
        <FinalizeRow eventId={eventId} view={headcount} />
      </FormRows>
    </div>
  );
}

/** A cluster's head — the sheet's small mono label over its rows (prototype `.hd`). Not pressable: no frame. */
function ClusterHead({ name, first = false }: { name: string; first?: boolean }) {
  return (
    <p
      data-settings-cluster={name}
      className={`${first ? 'pt-2' : 'pt-5'} pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 [&+*]:!border-t-0`}
    >
      {name}
    </p>
  );
}

/**
 * 📥 REQUESTS TO JOIN — people who asked through the link. On the Guests screen the press opens them IN PLACE
 * (`useOpenRequests`: the sheet closes, Asking to join opens on the List); elsewhere, or with no script, the row is
 * still the link to their list (`/guests/claims`).
 */
function RequestsRow({ eventId, waiting }: { eventId: string; waiting: number | null }) {
  const { setupDoorHref } = useGuestActions();
  const openRequests = useOpenRequests();
  return (
    <FormRow data="requests" name={REQUESTS_TITLE} line={REQUESTS_LINE} attrs={{ 'data-setup-row': 'requests' }}>
      <ActionButton
        tone={waiting ? 'brand' : 'neutral'}
        icon={ChevronRight}
        label={waiting === null ? 'Open' : waiting === 0 ? 'None waiting' : `${waiting} waiting`}
        href={setupDoorHref(eventId, 'requests')}
        onClick={
          openRequests
            ? (e: MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                openRequests();
              }
            : undefined
        }
        data-testid="setup-requests"
      />
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
        setError(plainRefusal(res.error, 'Couldn’t finalize the list. Try again.'));
        return;
      }
      setOpen(false);
    });
  /* ↻ The hosts' way back (owner 2026-10-07). This panel renders for the couple only
     (`invite-panel.tsx`), and `reopenGuestList` refuses anyone else on the server. */
  const reopen = () =>
    start(async () => {
      setError(null);
      const res = await setGuestListFinalized(eventId, false);
      if (!res.ok) {
        setError(plainRefusal(res.error, 'Couldn’t reopen the list. Try again.'));
        return;
      }
      // ⚡ Finalize and Reopen revalidate the guest list (`setGuestListFinalized`): the answer carries the redraw.
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
      {/* A confirm box (the approved gallery § 12): `GuestPopup kind="confirm"` draws it centred on <body> — above the bottom bar,
          dark and blurred behind, a tap on the dark closes it as "Not now", nothing behind works or scrolls. (It was the shared
          `Sheet` in a hand portal.) A press in flight cannot be closed away. */}
      {open ? (
        <GuestPopup kind="confirm" onClose={() => (pending ? undefined : setOpen(false))} labelledById="setup-finalize-title">
          <div className="flex flex-col gap-2" data-finalize-sheet="">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">{FINALIZE_SHEET.eyebrow}</p>
            <p id="setup-finalize-title" className="font-serif text-xl text-ink">
              {FINALIZE_SHEET.title(heads)}
            </p>
            <p className="text-[14px] text-ink/75">{FINALIZE_SHEET.body()}</p>
            {error ? (
              <p role="alert" className="text-[13px] font-semibold text-danger-700">
                {error}
              </p>
            ) : null}
            {/* The confirm box's two buttons, side by side, the safe answer first (`GuestConfirmActions`). */}
            <div className="mt-2">
              <GuestConfirmActions
                keep={<ActionButton tone="neutral" icon={X} label={FINALIZE_SHEET.cancel} disabled={pending} onClick={() => setOpen(false)} />}
                go={
                  <ActionButton
                    tone="ok"
                    main
                    icon={Check}
                    label={pending ? 'Finalizing…' : FINALIZE_SHEET.confirm}
                    disabled={pending}
                    onClick={finalize}
                    data-testid="setup-finalize-go"
                  />
                }
              />
            </div>
          </div>
        </GuestPopup>
      ) : null}
    </>
  );
}
