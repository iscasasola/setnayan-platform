'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Mail, Share2, SquareCheck, X } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { Count } from '@/components/count';
import { Sheet } from '@/app/_components/sheet';
import type { RsvpAskConfig } from '@/lib/rsvp-ask';
import {
  GUESTS_GET_IN_LABEL,
  guestsGetInPatch,
  guestsGetInPersonal,
  guestsGetInReplies,
  readGuestsGetIn,
} from '@/lib/who-can-reply';
import {
  FINALIZE_NOW_LABEL,
  FINALIZE_SHEET,
  HEADCOUNT_LOCKED_TITLE,
  HEADCOUNT_TITLE,
  HEADCOUNT_UNREAD_LINE,
  headcountLockedLine,
  headcountOpenLine,
} from '@/lib/headcount-row';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { updatePaxSettings } from '../../actions';
import { setGuestListFinalized } from '../../guests/finalize-actions';
import { GuestsGetIn } from './guests-get-in';
import { RsvpAsks } from './rsvp-asks';
import { ReplyBy } from './reply-by';
import type { OneLink } from './one-link.server';
import { SETUP_ACTS, SETUP_ROW, SETUP_SUB, SETUP_TITLE } from './setup-skin';

/** 📨 The Invitations row's words (HOME_AND_GUESTS_CHECK G26). */
export const INVITATIONS_TITLE = 'Invitations';
export const ONE_LINK_TITLE = 'Your one link';

export type HeadcountView = {
  /** The row renders at all (`showsHeadcountRow`). */
  show: boolean;
  /** The ✓ Finalize now button (`headcountMayFinalize`). */
  mayFinalize: boolean;
  locked: boolean;
  /** Who said yes, now (null = unread). */
  attending: number | null;
  /** The count Finalize would lock / has locked (`resolveLivePax` / `final_pax`). */
  heads: number | null;
  /** The per-head check was refused. */
  unread: boolean;
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
 *   6. Headcount           ✓ Finalize now → one sheet, one way — only when a
 *                          booked supplier prices per head
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
    <div className="flex flex-col pb-6" data-guest-setup="" data-get-in={getIn}>
      <GuestsGetIn value={getIn} onPick={(v) => save(guestsGetInPatch(v), `“${GUESTS_GET_IN_LABEL}”`)} />
      {waiting ? (
        <p className="-mt-1 pb-2 text-[12.5px] font-medium text-terracotta-700" data-setup-waiting="">
          Saved — guests see it after you Apply in the Event Hub Maker.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="pb-2 text-[13px] text-terracotta-700">
          {error}
        </p>
      ) : null}

      {personal ? <InvitationsRow eventId={eventId} toInvite={toInvite} passSrc={passSrc} /> : null}
      {getIn === 'one_qr' ? <OneLinkRow link={oneLink} /> : null}
      {replies ? <RsvpAsks config={local} onToggle={(field, v) => save({ [field]: v }, 'That question')} /> : null}
      {replies ? (
        reply ? (
          <ReplyBy
            layout="row"
            eventId={eventId}
            own={reply.own}
            pricingMode={reply.pricingMode}
            fallback={reply.fallback}
            action={updatePaxSettings}
          />
        ) : (
          <section className={SETUP_ROW} data-setup-row="reply-by">
            <p className={SETUP_TITLE}>Reply by</p>
            <p role="alert" className="text-[13px] text-terracotta-700">
              We couldn&rsquo;t read it just now.
            </p>
          </section>
        )
      ) : null}
      {headcount.show ? <HeadcountRow eventId={eventId} view={headcount} /> : null}
    </div>
  );
}

/** ✉ INVITATIONS — the shipped one-by-one run (`/guests/send`), and what each guest gets. */
function InvitationsRow({ eventId, toInvite, passSrc }: { eventId: string; toInvite: number | null; passSrc: string }) {
  const acts = useRef<HTMLSpanElement>(null);
  useFitRow(acts);
  const [passFailed, setPassFailed] = useState(false);
  return (
    <>
      <section className={SETUP_ROW} data-setup-row="invitations">
        <div className="min-w-0">
          <p className={SETUP_TITLE}>{INVITATIONS_TITLE}</p>
          <p className={SETUP_SUB}>
            One by one from your phone — Viber, Messenger, WhatsApp or SMS.{' '}
            {toInvite === null ? (
              'We couldn’t count who is left to invite just now.'
            ) : (
              <>
                <Count value={toInvite} id="setup-to-invite" /> to invite.
              </>
            )}
          </p>
        </div>
        <span ref={acts} className={SETUP_ACTS}>
          {toInvite === 0 ? (
            <ActionButton tone="ok" main quiet icon={Check} label="Everyone invited" disabled />
          ) : (
            <ActionButton
              tone="info"
              main
              icon={Mail}
              label={toInvite === null ? 'Send' : `Send to ${toInvite}`}
              href={`/dashboard/${eventId}/guests/send`}
              data-testid="setup-send"
            />
          )}
          <ActionButton
            tone="neutral"
            icon={SquareCheck}
            label="Pick who"
            href={`/dashboard/${eventId}/guests?select=to-invite`}
            data-testid="setup-pick-who"
          />
        </span>
      </section>
      {/* 🎫 THEIR DIGITAL PASS (owner: *"and show their Digital Pass"*) — the shipped ticket
          (`/api/hub-print/pass`, the first guest who is coming, their own QR), so the couple
          sees what each guest gets. A picture that fails says so. */}
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
    </>
  );
}

/** 🔗 YOUR ONE LINK — Open · Anyone with the link only (G27): link · Copy · Share + the one QR. */
function OneLinkRow({ link }: { link: OneLink }) {
  const acts = useRef<HTMLSpanElement>(null);
  useFitRow(acts);
  const [copied, setCopied] = useState(false);
  if (!link.url) {
    return (
      <section className={SETUP_ROW} data-setup-row="one-link">
        <div className="min-w-0">
          <p className={SETUP_TITLE}>{ONE_LINK_TITLE}</p>
          <p className={SETUP_SUB}>{link.notice}</p>
        </div>
        <span />
      </section>
    );
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
    <>
      <section className={SETUP_ROW} data-setup-row="one-link">
        <div className="min-w-0">
          <p className={SETUP_TITLE}>{ONE_LINK_TITLE}</p>
          <p className={`${SETUP_SUB} break-all`}>{shown} · whoever opens it is in</p>
        </div>
        <span ref={acts} className={SETUP_ACTS}>
          <ActionButton tone="neutral" main icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy'} onClick={copy} />
          <ActionButton tone="neutral" icon={Share2} label="Share" onClick={share} />
        </span>
      </section>
      {link.qrSvg ? (
        <div className="pb-3" data-setup-one-qr="">
          <div
            className="mx-auto h-[168px] w-[168px] rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: link.qrSvg }}
          />
        </div>
      ) : null}
    </>
  );
}

/**
 * 🔒 HEADCOUNT — one-way Finalize (DECISION_LOG "FINALIZING THE HEADCOUNT IS
 * ONE-WAY"). Open → `✓ Finalize now` → ONE sheet (*"… this cannot be undone"*,
 * `✓ Finalize` · `✕ Not now`). Locked → the locked count and NO button: there
 * is no Reopen anywhere. A refused press is said under the row.
 */
function HeadcountRow({ eventId, view }: { eventId: string; view: HeadcountView }) {
  const router = useRouter();
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

  return (
    <section className={SETUP_ROW} data-setup-row="headcount" data-headcount={view.locked ? 'locked' : 'open'}>
      <div className="min-w-0">
        <p className={SETUP_TITLE}>{view.locked ? HEADCOUNT_LOCKED_TITLE : HEADCOUNT_TITLE}</p>
        <p className={SETUP_SUB}>
          {view.locked
            ? headcountLockedLine(view.heads)
            : view.unread
              ? HEADCOUNT_UNREAD_LINE
              : view.attending === null
                ? 'We couldn’t count who is coming just now.'
                : headcountOpenLine(view.attending)}
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-[13px] text-terracotta-700">
            {error}
          </p>
        ) : null}
      </div>
      {view.mayFinalize ? (
        <span className={SETUP_ACTS}>
          <ActionButton
            tone="ok"
            main
            icon={Check}
            label={FINALIZE_NOW_LABEL}
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            data-testid="setup-finalize-now"
          />
        </span>
      ) : (
        <span />
      )}
      <Sheet open={open} onClose={() => (pending ? undefined : setOpen(false))} labelledById="setup-finalize-title">
        <div className="flex flex-col gap-2 p-1" data-finalize-sheet="">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">{FINALIZE_SHEET.eyebrow}</p>
          <p id="setup-finalize-title" className="font-serif text-xl text-ink">
            {FINALIZE_SHEET.title(heads)}
          </p>
          <p className="text-[14px] text-ink/75">{FINALIZE_SHEET.body(heads)}</p>
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
            <ActionButton tone="neutral" icon={X} label={FINALIZE_SHEET.cancel} disabled={pending} onClick={() => setOpen(false)} />
          </div>
          {error ? (
            <p role="alert" className="text-[13px] text-terracotta-700">
              {error}
            </p>
          ) : null}
        </div>
      </Sheet>
    </section>
  );
}
