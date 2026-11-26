'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useHydrated } from '@/lib/use-hydrated';
import Link from 'next/link';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CalendarPlus,
  ChevronRight,
  Eye,
  HeartHandshake,
  Images,
  LayoutDashboard,
  Lock,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { ActionButton, EQUAL_ROW_CLASS } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';

import { setEventArchived } from '../../[eventId]/archive-actions';
import {
  askSuppliersToAgree,
  withdrawSupplierAsk,
  cancelEventDeletionRequest,
  deleteOwnEvent,
  getEventDeletionImpact,
  requestEventDeletion,
  type DeletionImpact,
} from '../../[eventId]/delete-actions';
import {
  DELETION_REASONS,
  deletionReasonLabel,
  reasonIsComplete,
} from '@/lib/event-deletion-reasons';
import { buildWeddingIcs, icsDataHref } from '@/lib/calendar-links';
import { useOneOpen } from '@/lib/one-open';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { openEventHub } from '@/lib/open-external';
import { menuShiftIntoView } from '@/lib/menu-place';
import { Sheet } from '@/app/_components/sheet';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { useIsDesktop } from '@/lib/use-responsive';
import { HOLD_MS } from '@/lib/motion-table';
import type { UnihomeCardMenu } from '@/lib/unihome';
import ecm from './event-card-menu.module.css';

/**
 * event-card-menu.tsx — the per-card "⋯" on My Events.
 *
 * ─── WHY IT IS HERE AND NOT ONLY ON THE EVENT'S OWN SCREEN ─────────────────
 * Owner, 2026-08-20: "we can allow users to delete their planned event. how can
 * we do that on my events?" My Events is where somebody looks at nine
 * celebrations at once and decides which ones are real — so that is where
 * tidying belongs. Opening each event in turn to put it away is the flow that
 * made the control feel missing in the first place.
 *
 * ─── PUT AWAY IS FIRST, ALWAYS ─────────────────────────────────────────────
 * `archive-actions.ts` calls put-away "the gentle option that delete is
 * measured against", and that only works if the two are presented TOGETHER.
 * A menu offering only Delete turns every "I'm done looking at this" into a
 * destruction. Put away leads, is one press, and is reversible; Delete sits
 * below a divider, is red, and costs a typed name.
 *
 * ─── IT IS A SIBLING OF THE CARD, NOT A CHILD ──────────────────────────────
 * 🪤 The board cards are `<Link>`s. A button nested inside an anchor is invalid
 * HTML and behaves accordingly — the click activates BOTH, so opening the menu
 * would navigate to the event underneath it. This component is therefore
 * rendered as an absolutely-positioned sibling inside the card's `relative`
 * wrapper, never inside `CardShell`.
 *
 * The popover idiom (backdrop button + `role="menu"`) is the one already
 * shipping in `app/_components/chat-thread-menu.tsx`, reproduced rather than
 * redesigned.
 */
export function EventCardMenu({
  eventId,
  eventName,
  archived,
  /**
   * THIS one event's own date, for "Add to calendar" — a single all-day
   * VEVENT, downloaded once. Owner 2026-08-22: *"adding an event to a
   * calendar is not all events but just per event"* — a person wants ONE
   * wedding on their phone, not the whole board.
   *
   * ⚠ THIS IS NOW THE ONLY WAY INTO A CALENDAR, AND IT IS A COPY, NOT A
   * SUBSCRIPTION. An all-events `webcal:` feed used to sit on the board and
   * kept itself current — move a date and the phone followed. The owner
   * retired it the same day (*"block delete."*, migration 20271157440480),
   * knowing the trade: what this hands over is a snapshot, so a date changed
   * afterwards is silently stale in whatever calendar took it. Do not
   * "restore parity" by quietly making this re-fetch — there is nothing left
   * to re-fetch from.
   *
   * `null` when there is no date yet ⇒ the row is skipped entirely rather
   * than offered and refused.
   */
  eventDateIso = null,
  venueName = null,
  venueAddress = null,
  /**
   * TRUE on the Untold + Told shelves (the day has already passed). Owner
   * 2026-08-22, asked directly: *"shouldn't now happening and planning be
   * the only ones to have this add to calendar?"* — a day that already
   * happened is not something to add to a phone calendar, so this drops the
   * row entirely rather than offering a dead-feeling action on a past card.
   */
  finished = false,
  /** Dark cards (the mobile hero) need light chrome to stay visible. */
  tone = 'light',
  align = 'right',
  hubUrl = null,
  trigger = 'menu',
  card,
}: {
  eventId: string;
  eventName: string;
  archived: boolean;
  eventDateIso?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  finished?: boolean;
  tone?: 'light' | 'dark';
  /**
   * Which edge of the CARD the popover hangs from.
   *
   * 🚨 THIS IS NOT COSMETIC — right-anchoring it everywhere put the menu
   * PARTLY OFF THE SCREEN, permanently unreachable.
   *
   * The popover is a fixed 280px. On a phone the two-up chip grid gives each
   * chip about 160px: 393px viewport − 32px of page padding = 329px, split in
   * two. Hung from the right edge of a LEFT-column chip, the popover spans
   * roughly x = −97 … 183 — about a hundred pixels of it, including the icons
   * and the left third of "Put this away" and "Remove for good", sits left of
   * the viewport, and an LTR page cannot scroll left of the origin.
   *
   * Hanging it from the chip's LEFT edge instead puts it at 32 … 312, fully on
   * screen — so the two columns take opposite anchors and both fit. Callers
   * pass `align` from the grid index; everything wider than a chip keeps the
   * natural right anchor.
   */
  align?: 'left' | 'right';
  /**
   * 👁 The public Event Hub's address when guests can open it (Public or Unlisted, with a slug — Home's rule), else
   * null and the row is not drawn. Owner 2026-10-27: *"View event hub add that if event hub is available for that
   * event"*. Opens through `openEventHub`: the in-app browser sheet in the app, a new tab on the web.
   */
  hubUrl?: string | null;
  /**
   * 🗑 HOW THE CARD OPENS THIS (Unihome v5, owner-approved 23 Nov 2026 — DECISION_LOG "UNIHOME v5 APPROVED"):
   *   · `menu` — the board's "⋯" and its popover, exactly as shipped.
   *   · `remove` — Home's event card: the card already carries Dashboard · Event Hub as buttons, so the ⋯ goes and a
   *     small grey trash icon at the far end of the row opens THIS remove sheet straight away. It never removes on tap:
   *     screen 1 names what goes and offers "Put this away" FIRST (the ⋯'s row, moved into the sheet), screen 2 needs
   *     the name typed. Add to calendar moved into the event dashboard. No new delete flow — the same sheet, actions
   *     and guards.
   */
  trigger?: 'menu' | 'remove' | 'card';
  /**
   * 📋 `trigger="card"` — HOME'S EVENT CARD IS THE MENU'S BUTTON (owner-approved 25 Nov 2026, final-check brief Add 40;
   * drawing `build-sessions/final-check/drawings/event-card-menu.html`). Tapping the card (or its ⋯, a long-press or a
   * right-click) opens one menu: Open Dashboard · Open your Event Hub · Open Chat · Open your Memories · Publish Story
   * · Delete Event. Phone: the house `Sheet`. Desktop: a small menu anchored to the ⋯, over the one scrim. It replaces
   * the Dashboard · Event Hub · trash buttons under the card. Delete opens INSIDE the same sheet or menu and is the
   * shipped flow, word for word: what goes, "Put this away" first, an optional reason, then the typed name — the same
   * server actions and guards.
   */
  card?: {
    /** The card itself, without links or buttons of its own — the whole of it is the press. */
    body: ReactNode;
    /** The picture for the menu's head. */
    thumb: ReactNode;
    /** "Sat 13 Mar 2027 · Tagaytay". */
    meta: string;
    /** "You organise this". */
    stance: string;
    dashboardHref: string;
    menu: UnihomeCardMenu;
  };
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** How many suppliers were just asked — null until the couple presses. */
  const [asked, setAsked] = useState<number | null>(null);
  /**
   * Which of the six they picked, and anything they typed.
   *
   * Owner 2026-08-28: *"they can pick a reason for deleting. or they state
   * their reason."* Empty is a legal state on an ordinary removal — the reason
   * is asked, never demanded, because the alternative is holding somebody's
   * own celebration hostage to a survey.
   */
  const [reasonCode, setReasonCode] = useState<string>('');
  const [reasonText, setReasonText] = useState('');
  /** TRUE once they press "Ask us to remove it" — the reason step is showing. */
  const [asking, setAsking] = useState(false);
  /** TRUE once the request is in. */
  const [requested, setRequested] = useState(false);
  /**
   * WHICH HALF OF THE REMOVAL IS ON SCREEN — owner 2026-08-29: *"when they
   * click on their reason, change the content of the popup to just show the
   * type XXX to confirm so the popup stays fit."*
   *
   * The frame used to carry everything at once: what is lost, six reason
   * chips, a notes box, the typed name and the buttons — about 590px, taller
   * than the phone it opens on. Two short screens fit; one long one never can,
   * and the part that falls off the bottom is always the button.
   *
   * ⚖ THE REASON IS STILL ASKED, NEVER DEMANDED. Advancing on a chip press
   * would make the survey the toll gate on somebody's own celebration, so
   * "I'd rather not say" moves them on with nothing recorded — the same
   * standing this question has had since the owner set it on 2026-08-28.
   */
  const [step, setStep] = useState<'why' | 'confirm'>('why');
  /** The note is one line until it is asked for — see `step`. */
  const [noteOpen, setNoteOpen] = useState(false);
  useOneOpen(open, close); // one open at a time — lib/one-open.ts
  /**
   * 📐 THE OPEN MENU IS MEASURED AND KEPT ON SCREEN (owner 2026-10-27, phone screenshots: on a LEFT-column card the
   * menu ran off the left edge — "this away", "ove for good"). `align` alone cannot hold it: it depends on which
   * column a card lands in, and the board's grid has changed between one and two columns more than once. So once it
   * is drawn, its real box is measured and it is nudged sideways to sit inside the 16-px page gutter
   * (`menuShiftIntoView`, lib/menu-place.ts). Whatever the grid does, the whole menu shows.
   */
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuShift, setMenuShift] = useState(0);
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!open || confirming || !el) {
      setMenuShift(0);
      return;
    }
    el.style.transform = '';
    const r = el.getBoundingClientRect();
    setMenuShift(menuShiftIntoView({ left: r.left, right: r.right }, document.documentElement.clientWidth));
  }, [open, confirming, align]);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setConfirming(false);
    setImpact(null);
    setTyped('');
    setError(null);
    setAsked(null);
    setReasonCode('');
    setReasonText('');
    setAsking(false);
    setRequested(false);
    setStep('why');
    setNoteOpen(false);
  }

  function putAway() {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('archived', archived ? '0' : '1');
    startTransition(async () => {
      /*
        🪤 THE AWAIT IS INSIDE A TRY. A rejected server action escapes an async
        handler unhandled and the pending flag then never clears — the defect
        that left "Creating…" on screen forever in the onboarding wizard. The
        put-away card carries the same guard for the same reason.
      */
      try {
        const res = await setEventArchived(fd);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        close();
        /* ⚡ The card moves on the action's own answer: `setEventArchived` revalidates, and an action that revalidates
           answers WITH the page's new render, applied to what is on screen (measured 2026-10-20, `/dev/guests-lab` —
           the old note here said it did not). A `router.refresh()` drew the whole page a second time. */
      } catch (err) {
        console.error('[event-card-menu] archive rejected', err);
        setError('We couldn’t save that just now. Please try again.');
      }
    });
  }

  function openDelete() {
    setError(null);
    setStep('why');
    setNoteOpen(false);
    setConfirming(true);
    startTransition(async () => {
      try {
        const res = await getEventDeletionImpact(eventId);
        if (!res.ok) {
          setError(res.message);
          setConfirming(false);
          return;
        }
        setImpact(res.impact);
      } catch (err) {
        console.error('[event-card-menu] impact read rejected', err);
        setError('We couldn’t check this one just now. Please try again.');
        setConfirming(false);
      }
    });
  }

  function askSuppliers() {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    startTransition(async () => {
      try {
        const res = await askSuppliersToAgree(fd);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setAsked(res.asked);
      } catch (err) {
        console.error('[event-card-menu] ask rejected', err);
        setError('We couldn’t send that just now. Please try again.');
      }
    });
  }

  function withdrawAsk() {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    startTransition(async () => {
      try {
        const res = await withdrawSupplierAsk(fd);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setAsked(null);
      } catch (err) {
        console.error('[event-card-menu] withdraw rejected', err);
        setError('We couldn’t withdraw that just now. Please try again.');
      }
    });
  }

  function sendRequest() {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('reason_code', reasonCode);
    fd.set('reason', reasonText);
    startTransition(async () => {
      try {
        const res = await requestEventDeletion(fd);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setRequested(true);
        setAsking(false);
      } catch (err) {
        console.error('[event-card-menu] request rejected', err);
        setError('We couldn’t send that just now. Please try again.');
      }
    });
  }

  function withdrawRequest() {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    startTransition(async () => {
      try {
        const res = await cancelEventDeletionRequest(fd);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setRequested(false);
        setImpact((prev) => (prev ? { ...prev, pendingRequest: null, canAsk: true } : prev));
      } catch (err) {
        console.error('[event-card-menu] withdraw request rejected', err);
        setError('We couldn’t withdraw that just now. Please try again.');
      }
    });
  }

  function confirmDelete() {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('confirm_name', typed);
    fd.set('reason_code', reasonCode);
    fd.set('reason', reasonText);
    startTransition(async () => {
      try {
        const res = await deleteOwnEvent(fd);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        close();
      } catch (err) {
        console.error('[event-card-menu] delete rejected', err);
        setError('We couldn’t remove that just now. Please try again.');
      }
    });
  }

  const dark = tone === 'dark';

  // Computed once per open menu, not on every render — building a string is
  // cheap, but there is no reason to redo it on every keystroke elsewhere on
  // the card (the "type the name to confirm" field re-renders this component).
  const icsHref = useMemo(() => {
    if (finished) return null;
    const ics = buildWeddingIcs({
      title: eventName,
      dateIso: eventDateIso,
      location: venueName ?? venueAddress ?? null,
      uid: `wedding-${eventId}@setnayan.com`,
    });
    return ics ? icsDataHref(ics) : null;
  }, [finished, eventName, eventDateIso, venueName, venueAddress, eventId]);

  /* Home's card menu says Delete (the drawing's word, brief Add 40); the board's ⋯ keeps Remove. Same flow. */
  const verb = trigger === 'card' ? 'Delete' : 'Remove';
  const headingId = `ecm-del-${eventId}`;
  /* THE SHIPPED DELETE FLOW, ONCE — drawn in the dialog below for the board and the trash icon, and inside the card
     menu for `trigger="card"`. One body, so the two can never drift. */
  const deleteBody = (
        <div className="p-4">
          <p className="text-base font-bold text-ink" id={headingId}>
            {verb} {eventName}?
          </p>

          {!impact ? (
            <p className="mt-1.5 text-sm text-ink/70">
              {error ? error : 'Checking what’s on this one…'}
            </p>
          ) : requested || impact.pendingRequest ? (
            /*
              🔑 THE REQUEST IS SHOWN WHEREVER THEY LEFT IT, AND CAN BE
              TAKEN BACK. A person who asks and then sees no trace of it
              asks again — and the one-open-request-per-celebration rule
              would refuse the second press with an error about a
              duplicate, which reads as the product being broken.
            */
            <>
              <p className="mt-1.5 text-sm leading-snug text-ink/75">
                <strong className="font-semibold text-ink">
                  We have your request
                </strong>{' '}
                — nothing is removed until we answer, and we’ll let you
                know when we do.
              </p>
              {impact.pendingRequest ? (
                <p className="mt-1 text-[13px] leading-snug text-ink/70">
                  You said: {deletionReasonLabel(impact.pendingRequest.reasonCode).toLowerCase()}
                  {impact.pendingRequest.reason
                    ? ` — “${impact.pendingRequest.reason}”`
                    : ''}
                </p>
              ) : null}
              <button
                type="button"
                onClick={withdrawRequest}
                disabled={pending}
                className="sn-press mt-2 inline-flex min-h-11 items-center text-[13px] font-bold text-ink/75 underline underline-offset-2 hover:text-ink disabled:opacity-60"
              >
                {pending ? 'Withdrawing…' : 'Withdraw the request'}
              </button>
            </>
          ) : asking ? (
            /*
              THE REASON STEP. The same six answers as an ordinary
              removal, so what we learn is comparable however somebody
              leaves; the box is where they say what they actually want
              done about the money.
            */
            <>
              <p className="mt-1.5 text-sm leading-snug text-ink/75">
                Tell us why and a person will answer you.
              </p>
              <ReasonPicker
                code={reasonCode}
                onCode={setReasonCode}
                text={reasonText}
                onText={setReasonText}
                textLabel="Anything we should know?"
                textRequired={reasonCode === 'other'}
              />
            </>
          ) : impact.blocked ? (
            /* The refusal is stated BEFORE anything is typed. Asking
               somebody to type their wedding's name and then telling
               them no is a worse refusal than no button at all. */
            <>
              <p className="mt-1.5 text-sm leading-snug text-ink/75">
                {impact.blockedReason}
              </p>
              {/*
                🚨 AND NOW IT SAYS WHICH MONEY. Until 2026-08-28 a refusal
                about a bill we had confirmed, a screenshot nobody had
                opened, and a check that failed all wore ONE sentence, and
                the owner's verdict on it was "still failed to identify" —
                on a celebration where, measured in production, nothing
                had been confirmed at all.

                The list is only drawn where there IS money of ours in the
                way. A supplier refusal already names who is holding it,
                and an unreadable one must name nothing, because the whole
                reason it refused is that it could not read.
              */}
              {(impact.blockKind === 'settled' ||
                impact.blockKind === 'awaiting_check') &&
              impact.paidItems.length > 0 ? (
                <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
                  {impact.paidItems.map((item, i) => (
                    <li
                      key={`${item.description}-${i}`}
                      className="flex min-h-11 items-center justify-between gap-2 py-2 text-sm leading-snug"
                    >
                      <span className="font-semibold text-ink">
                        {item.description}
                      </span>
                      {item.amountPhp !== null ? (
                        <span className="shrink-0 font-bold text-ink tabular-nums">
                          ₱{item.amountPhp.toLocaleString('en-PH')}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {/*
                🔑 A REFUSAL WITH A DOOR. Owner 2026-08-21: a paid supplier
                must ACCEPT the deletion — so where suppliers are what is
                holding it, the couple gets the ask rather than a dead end.
                Only offered when suppliers are the reason: it asks the
                suppliers directly, which is a better door than putting a
                person in the middle of somebody else's money.
              */}
              {impact.blockKind === 'suppliers' ? (
                <ActionButton
                  tone="brand"
                  main
                  icon={Send}
                  label={pending ? 'Asking…' : 'Ask them to agree'}
                  onClick={askSuppliers}
                  disabled={pending}
                  waiting={pending}
                  className="mt-3 w-full"
                />
              ) : null}
              {/*
                ⛔ AND THE UNREADABLE ONE KEEPS ITS DEAD END, DELIBERATELY.
                `canAsk` is false there because there is nothing to
                request about — we do not yet know whether there is
                anything to request about. A button would be a door to a
                room we cannot describe.
              */}
              {impact.canAsk ? (
                <ActionButton
                  tone="brand"
                  main={impact.blockKind !== 'suppliers'}
                  icon={MessageCircle}
                  label="Ask us to remove it"
                  onClick={() => setAsking(true)}
                  disabled={pending}
                  className="mt-3 w-full"
                />
              ) : null}
            </>
          ) : step === 'why' ? (
            /*
              SCREEN ONE — WHAT GOES, AND WHY. No typed name and no Remove
              button: this half is a question, and a destructive control on a
              screen whose job is to ask one is a control pressed by accident.
            */
            <>
              <ImpactLines impact={impact} />
              {/* 📦 THE GENTLE CHOICE FIRST (Unihome v5): on Home the ⋯ is gone, so its "Put this away" leads this
                  screen — the undoable answer before the permanent one. The board's ⋯ still carries it. */}
              {trigger === 'remove' || trigger === 'card' ? (
                <button
                  type="button"
                  onClick={putAway}
                  disabled={pending}
                  data-remove-put-away=""
                  className="sn-press mt-3 flex min-h-[60px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-ink disabled:opacity-60"
                  style={{ background: 'rgb(var(--color-raised-2))' }}
                >
                  <Archive aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.9} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sn-lg font-semibold">{archived ? 'Bring it back' : trigger === 'card' ? 'Put this away instead' : 'Put this away'}</span>
                    <span className="block text-sn-sm text-ink/70">
                      {archived ? 'Back onto your active list.' : 'Off your list. Nothing is deleted.'}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
                </button>
              ) : null}
              {(trigger === 'remove' || trigger === 'card') && error ? (
                <p role="alert" className="mt-1.5 text-sn-md font-semibold text-[color:var(--sn-danger)]">
                  {error}
                </p>
              ) : null}
              {/*
                ⚖ ASKED, NEVER DEMANDED. The Remove button does not wait
                on this — holding somebody's own celebration hostage to a
                survey would be the product asking for a favour on the way
                out. It is here because this is the ONLY moment anybody
                will ever tell us why they left, and it costs one tap.

                🔑 A PRESS IS THE ANSWER AND THE PAGE TURN, BOTH — owner
                2026-08-29. Clearing the chosen one is NOT a page turn: it
                leaves them here, where the chips are, which is the only place
                clearing it means anything.
              */}
              <ReasonPicker
                code={reasonCode}
                onCode={(c) => {
                  setReasonCode(c);
                  if (c) setStep('confirm');
                }}
                text={reasonText}
                onText={setReasonText}
                textLabel="Anything you want to add?"
                textRequired={false}
                optional
                hideText
              />
              {/*
                ⚖ THE WAY PAST THE QUESTION, AND IT IS NOT A SMALL PRINT LINK.
                Without it, advancing-on-a-chip turns an optional survey into
                the toll gate on somebody's own celebration — the exact thing
                the note above says this question must never be.
              */}
              <button
                type="button"
                onClick={() => {
                  setReasonCode('');
                  setReasonText('');
                  setStep('confirm');
                }}
                className="sn-press mt-2.5 inline-flex min-h-11 items-center text-[13px] font-bold text-ink/75 underline underline-offset-2 hover:text-ink"
              >
                I’d rather not say
              </button>
            </>
          ) : (
            /*
              SCREEN TWO — THE PRESS. The strongest warning moved here on
              purpose: it belongs beside the button, not two scrolls above it.
            */
            <>
              <PermanenceWarning />
              <SupplierRecordsNote />
              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-snug text-ink/70">
                <span>
                  {reasonCode
                    ? `You said: ${deletionReasonLabel(reasonCode).toLowerCase()}`
                    : 'No reason given'}
                </span>
                <button
                  type="button"
                  onClick={() => setStep('why')}
                  className="sn-press inline-flex min-h-11 items-center font-bold text-ink/75 underline underline-offset-2 hover:text-ink"
                >
                  {reasonCode ? 'Change' : 'Say why'}
                </button>
              </div>
              {/*
                🔑 THE NOTE IS ONE LINE UNTIL IT IS ASKED FOR. Owner
                2026-08-28: *"they can pick a reason for deleting. or they state
                their reason."* — so the box has to stay reachable, and an
                always-open box is 60px of the height this screen exists to save
                spent on a field most people leave empty.
              */}
              {reasonCode && !noteOpen && !reasonText ? (
                <button
                  type="button"
                  onClick={() => setNoteOpen(true)}
                  className="sn-press mt-1.5 inline-flex min-h-11 items-center text-[13px] font-bold text-ink/75 underline underline-offset-2 hover:text-ink"
                >
                  Add a note
                </button>
              ) : null}
              {reasonCode && (noteOpen || reasonText) ? (
                <ReasonNote
                  label="Anything you want to add?"
                  required={false}
                  text={reasonText}
                  onText={setReasonText}
                />
              ) : null}
              <label className="mt-2.5 block text-[13px] font-semibold text-ink/75">
                Type <span className="font-bold text-ink">{eventName}</span> to
                confirm
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  /*
                    ⌨ ENTER REMOVES IT — owner 2026-08-29: *"also pressing enter
                    on that text box should also confirm"*. A lone `<input>`
                    outside a `<form>` does nothing at all on Enter, so a person
                    who has just typed their celebration's name in full presses
                    the key every text box has taught them to press and the
                    screen ignores them.

                    🔑 THE SAME CONDITION AS THE BUTTON, WORD FOR WORD. A second
                    way to fire something irreversible must never be the LOOSER
                    way: if this test drifted from the button's, Enter would
                    remove a celebration on a screen still showing the control
                    greyed out. A guard pins the two spellings as identical.
                  */
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (pending || typed.trim().length === 0) return;
                    confirmDelete();
                  }}
                  autoComplete="off"
                  className="mt-1 min-h-12 w-full rounded-xl border border-ink/20 bg-raised px-3 py-2 text-base font-normal text-ink outline-none focus:border-mulberry"
                />
              </label>
              {error ? (
                <p
                  role="alert"
                  className="mt-1.5 text-[13px] font-semibold text-[color:var(--sn-danger)]"
                >
                  {error}
                </p>
              ) : null}
            </>
          )}

          {asked !== null ? (
            <>
              <p className="mt-2 text-sm leading-snug text-[color:var(--sn-ink-500)]">
                {asked === 0
                  ? 'Everyone has already been asked — we’re waiting on them.'
                  : `Asked ${asked === 1 ? '1 supplier' : `${asked} suppliers`}. We’ll let you know as they answer; you can remove this once they agree.`}
              </p>
              {/*
                🔑 THE INVERSE, AND IT IS REACHABLE. `withdrawSupplierAsk`
                shipped with ZERO CALLERS while its own docblock cited
                `cancel_vendor_lock_request` — granted, tested, uncallable
                for its whole life — as the thing not to repeat. A couple
                who asks by mistake, or sorts it out by phone, must be able
                to take the question back.
              */}
              <button
                type="button"
                onClick={withdrawAsk}
                disabled={pending}
                className="sn-press mt-1.5 inline-flex min-h-11 items-center text-[13px] font-bold text-ink/75 underline underline-offset-2 hover:text-ink disabled:opacity-60"
              >
                {pending ? 'Withdrawing…' : 'Withdraw the request'}
              </button>
            </>
          ) : null}
          <div className={`mt-4 ${EQUAL_ROW_CLASS}`}>
            <ActionButton
              tone="neutral"
              icon={asking ? ArrowLeft : X}
              label={asking ? 'Back' : 'Cancel'}
              onClick={asking ? () => setAsking(false) : close}
              disabled={pending}
            />
            {asking ? (
              <ActionButton
                tone="brand"
                main
                icon={Send}
                label={pending ? 'Sending…' : 'Send it'}
                onClick={sendRequest}
                disabled={pending || !reasonIsComplete(reasonCode, reasonText)}
                waiting={pending}
              />
            ) : impact && !impact.blocked && step === 'confirm' ? (
              /* Not on the "why" screen — see the note there. The disabled
                 condition itself is UNCHANGED: Remove still waits on the typed
                 name and nothing else. */
              <ActionButton
                tone="danger"
                filled
                icon={Trash2}
                label={pending ? (verb === 'Delete' ? 'Deleting…' : 'Removing…') : `${verb} for good`}
                onClick={confirmDelete}
                disabled={pending || typed.trim().length === 0}
                waiting={pending}
              />
            ) : null}
          </div>
        </div>
  );

  return (
    /*
      🪤 A FRAGMENT, NOT A POSITIONED WRAPPER — AND THAT IS THE WHOLE FIX.
      This used to be `<div className="absolute right-2 top-2 z-20">` holding
      both the button and the popover, which made that ~32px box the popover's
      containing block. `right-0` then measured from the BUTTON's right edge
      (not the card's), so the 280px popover hung off the left of a narrow chip;
      and `left-0` would have measured from the button's LEFT edge and hung off
      the right instead. Anchoring to a 32px box can never place a 280px panel.

      Both children are now positioned against `BoardCardWithMenu`'s
      `relative h-full` wrapper — the CARD's box — so `left-0` / `right-0` mean
      the card's edges and `align` can actually put the panel on screen.
    */
    <>
      {trigger === 'card' && card ? (
        <CardMenuFrame
          eventName={eventName}
          card={card}
          open={open || confirming}
          deleting={confirming}
          onOpen={() => setOpen(true)}
          onClose={close}
          onBack={() => {
            setConfirming(false);
            setImpact(null);
            setTyped('');
            setError(null);
            setStep('why');
          }}
          onDelete={openDelete}
          pending={pending}
          error={confirming ? null : error}
          deleteBody={deleteBody}
          deleteHeadingId={headingId}
        />
      ) : trigger === 'remove' ? (
        <ActionButton
          tone="neutral"
          quiet
          iconOnly
          icon={Trash2}
          label="Remove"
          name={`Remove ${eventName}`}
          aria-haspopup="dialog"
          onClick={openDelete}
          disabled={pending}
          data-event-remove={eventId}
        />
      ) : (
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Options for ${eventName}`}
        className={`absolute right-1 top-1 z-20 grid h-11 w-11 place-items-center rounded-full backdrop-blur-sm transition-colors duration-sn-control ${
          dark
            ? 'bg-black/35 text-white/80 hover:bg-black/55 hover:text-white'
            : 'bg-raised/80 text-ink/75 shadow-sn-sm hover:bg-raised hover:text-ink'
        }`}
      >
        <MoreVertical aria-hidden className="h-4 w-4" strokeWidth={2} />
      </button>
      )}

      {trigger !== 'card' && open && !confirming ? (
        <>
          {/* Backdrop — closes on any outside press. `fixed` so it covers the
              whole board, not just this card. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            ref={menuRef}
            role="menu"
            data-board-menu=""
            style={menuShift ? { transform: `translateX(${menuShift}px)` } : undefined}
            className={`absolute top-12 z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-ink/10 bg-cream p-1 text-left shadow-sn-float ${
              align === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            {hubUrl ? (
              <>
                <a
                  href={hubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  data-board-menu-hub=""
                  onClick={(e) => {
                    e.preventDefault();
                    close();
                    openEventHub(hubUrl);
                  }}
                  className="flex min-h-14 w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-ink/5"
                >
                  <Eye aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/70" strokeWidth={2} />
                  <span>
                    <span className="block font-semibold">View Event Hub</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink/70">What your guests see.</span>
                  </span>
                </a>
                <div className="my-1 h-px bg-ink/10" />
              </>
            ) : null}
            {icsHref ? (
              <>
                {/* 📥 Saved, never shown in place: the app's web view ignores `download` and renders the .ics with no way
                    back (owner 2026-10-27). SaveFileLink runs the share sheet / download; the wrapper's capture still
                    closes the menu on the same tap. */}
                <div className="contents" onClickCapture={close}>
                <SaveFileLink
                  href={icsHref}
                  filename={`${eventName}.ics`}
                  role="menuitem"
                  className="flex min-h-14 w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-ink/5"
                >
                  <CalendarPlus
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-ink/70"
                    strokeWidth={2}
                  />
                  <span>
                    <span className="block font-semibold">
                      Add to calendar
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink/70">
                      Just this event, on your phone.
                    </span>
                  </span>
                </SaveFileLink>
                </div>
                <div className="my-1 h-px bg-ink/10" />
              </>
            ) : null}

            <button
              type="button"
              role="menuitem"
              onClick={putAway}
              disabled={pending}
              className="flex min-h-14 w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-ink/5 disabled:opacity-60"
            >
              <Archive
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-ink/70"
                strokeWidth={2}
              />
              <span>
                <span className="block font-semibold">
                  {archived ? 'Bring it back' : 'Put this away'}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-ink/70">
                  {archived
                    ? 'Back onto your active list.'
                    : 'Off your list. Nothing is deleted.'}
                </span>
              </span>
            </button>

            <div className="my-1 h-px bg-ink/10" />

            <button
              type="button"
              role="menuitem"
              onClick={openDelete}
              disabled={pending}
              className="flex min-h-14 w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[color:var(--sn-danger)] hover:bg-[color:var(--sn-danger-soft)] disabled:opacity-60"
            >
              <Trash2
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={2}
              />
              <span>
                <span className="block font-semibold">Remove for good</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-ink/70">
                  Photos and everything else, gone for good.
                </span>
              </span>
            </button>

            {error ? (
              <p
                role="alert"
                className="px-3 pb-2 pt-1 text-[13px] font-semibold text-[color:var(--sn-danger)]"
              >
                {error}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {/*
        🚪 THE REMOVE FRAME IS A DIALOG IN THE BROWSER'S TOP LAYER — IT IS NOT
        A PANEL HANGING OFF THE CARD, AND THAT IS THE WHOLE FIX.

        Owner, 2026-08-29, on a phone: *"i cannot click on the delete this
        frame should be on top and not under."* He was right, and the panel was
        not broken — it was OUTRANKED. It rendered as `absolute z-50` inside the
        card's wrapper, so the only thing keeping it above the shelves below was
        a z-index, and a z-index is only worth anything INSIDE its own stacking
        context. Anything on this board that opens one — an animated section, a
        blurred card, a sticky bar — clamps the panel inside it, and then the
        next shelf paints straight over the bottom of it: over Cancel, and over
        the one button the whole frame exists to offer.

        🔑 A TALLER PANEL IS ALSO A TRAPPED ONE. Six reason chips, a notes box
        and a type-the-name field made this frame ~590px. Hung 44px below a card
        on a 780px phone it runs out of screen with the buttons at the bottom,
        and nothing about `absolute` lets a person scroll to them — the page
        scrolls, the panel goes with the card.

        `showModal()` answers both at once and answers them structurally, not by
        out-bidding anybody: the top layer is above every stacking context by
        construction, so no future z-index anywhere can get in front of it, and
        the frame scrolls inside itself when the screen is short. It is the
        idiom already shipping in `app/_components/confirm-dialog.tsx` —
        reproduced, not invented, and the browser hands us the focus trap, ESC,
        and the inert background with it.

        ⛔ DO NOT "SIMPLIFY" THIS BACK INTO THE POPOVER. The panel above is
        small, anchored, and correct where it is; this one is a decision about
        somebody's photographs and belongs in front of the whole page.
      */}
      {trigger !== 'card' ? (
        <RemoveDialog open={confirming} onDismiss={close} label={`Remove ${eventName}?`}>
          {deleteBody}
        </RemoveDialog>
      ) : null}
    </>
  );
}

/**
 * The remove frame's container: a native `<dialog>` opened with `showModal()`,
 * portaled to `document.body`.
 *
 * ─── WHY A `<dialog>` AND NOT ANOTHER PANEL WITH A BIGGER NUMBER ───────────
 * `showModal()` puts the element in the browser's TOP LAYER, which sits above
 * every stacking context on the page by construction. That is a different kind
 * of promise from `z-50`: a z-index only ranks you against your siblings inside
 * whatever context an ancestor happens to have opened, so it can be beaten
 * tomorrow by a shelf someone gives a transform, a blur or a sticky bar — which
 * is exactly what happened to this frame. Nothing can be given a number that
 * gets in front of the top layer.
 *
 * It also brings the parts a hand-rolled overlay has to remember and this one
 * never had: focus is trapped inside the frame, ESC closes it, the page behind
 * goes inert, and the backdrop is the browser's own.
 *
 * 🪤 PORTALED TO `document.body` FOR A SECOND REASON. This component renders as
 * a SIBLING of a board card, inside a grid cell — and the `<dialog>` element in
 * the tree, wherever it sits, inherits that ancestor's `overflow`. The top layer
 * is unaffected by DOM position, but keeping the element out of a clipped,
 * transformed grid cell is what stops the next well-meaning `overflow-hidden`
 * from being a mystery.
 *
 * ⚠ THE ELEMENT IS ALWAYS RENDERED, THE CONTENT IS NOT. A `<dialog>` mounted
 * only while open has no ref to call `showModal()` on at the moment it is
 * needed; gating the CHILDREN keeps the impact read, the typed name and the
 * reason chips from existing at all while the frame is shut.
 */
function RemoveDialog({
  open,
  onDismiss,
  label,
  children,
}: {
  open: boolean;
  /** ESC, the backdrop, and a browser-initiated close all land here. */
  onDismiss: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  /* ⚡ NOT `typeof document` — that differs between the server pass and the hydration pass, so
     the server sent no `<dialog>` and the first client render drew one: React #418 on every
     phone load of the board, and the whole board rendered again on the phone (662–676 ms long
     task at 4× CPU, measured 2026-10-16). `useHydrated` is false for both of those passes. */
  const hydrated = useHydrated();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open, hydrated]);

  /*
    A native dialog closes itself on ESC without telling React. Routing its
    `close` event back through `onDismiss` is what keeps the two in step — the
    alternative is a frame the browser has closed and a component that still
    believes it is open, so the next press of "Remove for good" opens nothing.
  */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function handleClose() {
      if (open) onDismiss();
    }
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, [open, onDismiss, hydrated]);

  if (!hydrated) return null;

  return createPortal(
    <dialog
      ref={ref}
      aria-label={label}
      onClick={(e) => {
        /* The backdrop IS the dialog element — a press only lands on it when it
           missed the frame's own content. */
        if (e.target === e.currentTarget) onDismiss();
      }}
      className="m-auto max-h-[min(85dvh,44rem)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-ink/10 bg-cream p-0 text-left text-ink shadow-2xl backdrop:bg-ink/45 backdrop:backdrop-blur-sm"
    >
      {open ? children : null}
    </dialog>,
    document.body,
  );
}

/**
 * What disappears, counted. A count that could not be read says so — it never
 * prints 0, because a zero here is read immediately before an irreversible
 * press and would be the most expensive lie on the screen.
 */
function ImpactLines({ impact }: { impact: DeletionImpact }) {
  const line = (n: number | null, one: string, many: string) => {
    if (n === null) return `We couldn’t check the ${many}`;
    if (n === 0) return null;
    return `${n} ${n === 1 ? one : many}`;
  };
  const parts = [
    line(impact.photos, 'photo', 'photos'),
    line(impact.guests, 'guest', 'guests'),
    line(impact.bookedVendors, 'booked supplier', 'booked suppliers'),
  ].filter(Boolean) as string[];

  return (
    <p className="mt-1.5 text-sm leading-snug text-ink/75">
      {parts.length > 0 ? (
        <>
          <span className="font-semibold text-ink">{parts.join(' · ')}</span> go
          with it, along with the page your guests use.
        </>
      ) : (
        <>Everything on it goes, including the page your guests use.</>
      )}
    </p>
  );
}

/**
 * ⚠ THE SENTENCE THE OWNER ASKED FOR, 2026-08-20: "give them the information
 * that you will also lose your photos and information of the event
 * permanently."
 *
 * It is separate from the counted line on purpose. That line lists WHAT — and a
 * count reads as an inventory, something you could imagine asking us to
 * restore. This says the photographs are GONE, in the two words people actually
 * check for.
 *
 * 🔑 AND IT MOVED TO THE SCREEN WITH THE BUTTON ON IT (2026-08-29). The frame
 * is two screens now, and a warning left behind on the first one is a warning
 * somebody read before they were deciding anything. "Deleted for good" and
 * "can't be undone" are not the same promise: the second is about the button,
 * the first is about the photographs — so the first one belongs beside it.
 */
function PermanenceWarning() {
  return (
    <p className="mt-1.5 text-sm leading-snug text-ink/75">
      <strong className="font-semibold text-ink">
        Your photos and everything about this event are deleted for good
      </strong>{' '}
      — you can’t bring any of it back, and neither can we.
    </p>
  );
}

/**
 * SUP-106 · WHAT HAPPENS ON THE SUPPLIERS' SIDE — described, not changed.
 *
 * The dialog listed only what the couple loses. Suppliers the couple worked
 * with lose things too, and keep others, and a couple deciding to remove a
 * celebration should know both. This is TODAY's behaviour, stated plainly; the
 * owner has not ruled on changing it (DATA-01), so the copy describes it.
 *
 * Every clause is a measured fact, not an intention:
 *   • KEPT — a payment the supplier CONFIRMED: amount and date only, with the
 *     couple's rail, reference, note and screenshot scrubbed
 *     (`the-money-outlives-the-event.db.test.ts`).
 *   • KEPT — the proposals and contracts the supplier sent, and reviews:
 *     `vendor_proposals` / `vendor_contracts` / `vendor_reviews` → events are
 *     ON DELETE SET NULL.
 *   • REMOVED — the conversation (`chat_threads`, `chat_messages`), the
 *     payment schedule (`event_vendor_payment_plan`) and deliveries
 *     (`vendor_guest_deliveries`): ON DELETE CASCADE.
 * `tests/db/the-delete-dialog-tells-the-truth-about-suppliers.db.test.ts`
 * reads those rules out of the replayed schema, so if anyone changes what
 * happens, this sentence goes red instead of quietly becoming untrue.
 */
function SupplierRecordsNote() {
  /* Rule 7 of the design sheet: the label stays, the explaining sits behind the ⓘ — every word kept. */
  return (
    <div className="mt-1.5">
      <InfoTip
        label="Suppliers you worked with keep a record"
        labelClassName="text-sm font-semibold text-ink"
        align="start"
      >
        Suppliers you worked with keep a record of payments they confirmed (the amount and date, never your bank
        details, notes or screenshots), plus the quotes and contracts they sent you. Your conversations with them,
        their payment schedules and their deliveries for this event are removed with it.
      </InfoTip>
    </div>
  );
}

/**
 * The six answers plus a box — the SAME control on an ordinary removal and on a
 * request, and that is the point.
 *
 * 🔑 ONE PICKER, TWO PLACES. What we learn has to be comparable however
 * somebody leaves: if the blocked path offered a different set of reasons from
 * the unblocked one, "why do people remove celebrations" would be two questions
 * with two answers and neither could be added up. The only thing that differs
 * is the label over the box and whether it is required.
 *
 * ⚠ A REAL `<select>`, not divs with click handlers — a person reaches it with
 * the keyboard on the way out of something irreversible, and the chosen answer
 * is announced as the control's value. (It was six `aria-pressed` chips until
 * 2026-09-30; see the comment on the control for why it is native.)
 */
function ReasonPicker({
  code,
  onCode,
  text,
  onText,
  textLabel,
  textRequired,
  optional = false,
  hideText = false,
}: {
  code: string;
  onCode: (c: string) => void;
  text: string;
  onText: (t: string) => void;
  textLabel: string;
  textRequired: boolean;
  /** Ordinary removals say so — the button never waits on this. */
  optional?: boolean;
  /**
   * TRUE where the box belongs on a later screen than the chips — the removal
   * frame, whose whole point since 2026-08-29 is that no one screen is taller
   * than the phone it opens on. The caller renders `<ReasonNote>` itself.
   */
  hideText?: boolean;
}) {
  return (
    <div className="mt-2.5">
      <p className="text-[13px] font-semibold text-ink/75">
        Why are you removing it?
        {optional ? (
          <span className="ml-1 font-normal text-ink/70">Optional</span>
        ) : null}
      </p>
      {/* ONE dropdown, not six chips (owner rule 2026-09-28: a choice of
          several is a dropdown, never a pill row).
          ⚠ A NATIVE <select>, NOT THE SHARED PickMenu — ON PURPOSE. This picker
          lives inside the remove frame, a `<dialog>` opened with `showModal()`.
          That puts the frame in the browser's TOP LAYER and makes everything
          outside it inert; PickMenu portals its list to `document.body`, i.e.
          outside the dialog, so its options would be drawn UNDER the frame and
          could not be pressed. The OS picker of a native select is drawn above
          everything. The first option is the "no answer" choice, so an
          optional question can still be cleared. */}
      <select
        aria-label="Why are you removing it?"
        value={code}
        onChange={(e) => onCode(e.target.value)}
        className="mt-1 min-h-12 w-full rounded-xl border border-ink/20 bg-raised px-3 py-2 text-base font-semibold text-ink outline-none focus:border-mulberry"
      >
        <option value="">{optional ? 'Choose a reason (optional)' : 'Choose a reason'}</option>
        {DELETION_REASONS.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </select>
      {code && !hideText ? (
        <ReasonNote
          label={textLabel}
          required={textRequired}
          text={text}
          onText={onText}
        />
      ) : null}
    </div>
  );
}

/**
 * The box under the chips — ONE implementation, two places.
 *
 * 🔑 It is a component rather than markup repeated twice because the removal
 * frame now shows it on a LATER screen than the chips (owner 2026-08-29), while
 * the request path still shows it inline. Two copies of a field is two copies
 * of its 1000-character cap, its rows, and its Optional/required label — and
 * the copy somebody forgets to change is the one a person meets.
 */
function ReasonNote({
  label,
  required,
  text,
  onText,
}: {
  label: string;
  required: boolean;
  text: string;
  onText: (t: string) => void;
}) {
  return (
    <label className="mt-2 block text-[13px] font-semibold text-ink/75">
      {label}
      {required ? null : (
        <span className="ml-1 font-normal text-ink/70">Optional</span>
      )}
      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        rows={2}
        maxLength={1000}
        className="mt-1 w-full rounded-xl border border-ink/20 bg-raised px-3 py-2 text-base font-normal leading-snug text-ink outline-none focus:border-mulberry"
      />
    </label>
  );
}

/**
 * 📋 THE CARD AND ITS MENU (`trigger="card"`, brief Add 40). The card is the press; the menu is the house `Sheet` on a
 * phone and a small menu anchored to the ⋯ on a computer, over the one scrim (`OverlayBackdrop`), so the page behind
 * cannot be pressed. Keyboard: Enter or Space opens, Tab stays inside, the arrows move between rows, Esc closes and the
 * focus goes back to the card.
 */
function CardMenuFrame({
  eventName,
  card,
  open,
  deleting,
  onOpen,
  onClose,
  onBack,
  onDelete,
  pending,
  error,
  deleteBody,
  deleteHeadingId,
}: {
  eventName: string;
  card: NonNullable<CardProp>;
  open: boolean;
  deleting: boolean;
  onOpen: () => void;
  onClose: () => void;
  onBack: () => void;
  onDelete: () => void;
  pending: boolean;
  /** A refused check before Delete (the impact read) — said under the rows, never a press that does nothing. */
  error: string | null;
  deleteBody: ReactNode;
  deleteHeadingId: string;
}) {
  const desktop = useIsDesktop();
  const hitRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const press = useRef<{ timer: number | null; x: number; y: number }>({ timer: null, x: 0, y: 0 });
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const hydrated = useHydrated();
  const nameId = `ecm-name-${card.dashboardHref.replace(/[^a-zA-Z0-9]/g, '')}`;

  // Focus goes back to the card when the menu closes — wherever the close came from.
  useEffect(() => {
    if (wasOpen.current && !open) hitRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // 📐 Desktop: anchored under the card's ⋯, kept inside the screen (flipped above when there is no room below).
  useLayoutEffect(() => {
    if (!open || !desktop) {
      setPos(null);
      return;
    }
    const anchor = moreRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!anchor) return;
    const w = panel?.offsetWidth ?? 360;
    const h = panel?.offsetHeight ?? 0;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(16, anchor.right - w), vw - w - 16);
    let top = anchor.bottom + 8;
    if (h && top + h > vh - 16) top = Math.max(16, anchor.top - h - 8);
    setPos({ top, left });
  }, [open, desktop, deleting]);

  // Desktop: the first row takes the focus on open.
  useEffect(() => {
    if (!open || !desktop) return;
    const first = panelRef.current?.querySelector<HTMLElement>('[data-ecm-row]:not([aria-disabled="true"]), input, button');
    first?.focus();
  }, [open, desktop, deleting, pos === null]);

  function clearPress() {
    if (press.current.timer !== null) window.clearTimeout(press.current.timer);
    press.current.timer = null;
  }

  function onPanelKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const panel = panelRef.current;
    if (!panel) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => el.getAttribute('aria-disabled') !== 'true');
    if (e.key === 'Tab' && focusables.length > 0) {
      const i = focusables.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : i === focusables.length - 1 ? 0 : i + 1;
      e.preventDefault();
      focusables[next]?.focus();
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !deleting) {
      const rows = Array.from(panel.querySelectorAll<HTMLElement>('[data-ecm-row]')).filter(
        (el) => el.getAttribute('aria-disabled') !== 'true',
      );
      const i = rows.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % rows.length : i <= 0 ? rows.length - 1 : i - 1;
      e.preventDefault();
      rows[next]?.focus();
    }
  }

  const head = deleting ? (
    <div className={ecm.head}>
      <button type="button" className={ecm.close} onClick={onBack} disabled={pending} aria-label="Back to the menu">
        <ArrowLeft aria-hidden strokeWidth={2} />
      </button>
      <span className={ecm.headText}>
        <span className={ecm.meta}>{eventName}</span>
      </span>
      <button type="button" className={ecm.close} onClick={onClose} disabled={pending} aria-label="Close">
        <X aria-hidden strokeWidth={2} />
      </button>
    </div>
  ) : (
    <div className={ecm.head}>
      <span className={ecm.thumb} aria-hidden>
        {card.thumb}
      </span>
      <span className={ecm.headText}>
        <b className={ecm.name} id={nameId}>
          {eventName}
        </b>
        <span className={ecm.meta}>{card.meta}</span>
        <span className={ecm.stance}>
          <HeartHandshake aria-hidden strokeWidth={2.25} />
          {card.stance}
        </span>
      </span>
      <button type="button" className={ecm.close} onClick={onClose} aria-label="Close">
        <X aria-hidden strokeWidth={2} />
      </button>
    </div>
  );

  const body = deleting ? (
    <div data-ecm-delete="">{deleteBody}</div>
  ) : (
    <div className={ecm.body}>
      <CardMenuRows card={card} onNavigate={onClose} onDelete={onDelete} pending={pending} />
      {error ? (
        <p role="alert" className="pb-1 pt-2 text-sn-md font-semibold text-[color:var(--sn-danger)]" data-ecm-error="">
          {error}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className={ecm.wrap} data-ecm-card="">
      <div
        ref={hitRef}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${eventName}: open its menu`}
        className={ecm.hit}
        data-ecm-hit=""
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          clearPress();
          onOpen();
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return;
          clearPress();
          press.current = {
            x: e.clientX,
            y: e.clientY,
            timer: window.setTimeout(() => {
              press.current.timer = null;
              onOpen();
            }, HOLD_MS),
          };
        }}
        onPointerMove={(e) => {
          if (Math.abs(e.clientX - press.current.x) > 10 || Math.abs(e.clientY - press.current.y) > 10) clearPress();
        }}
        onPointerUp={clearPress}
        onPointerCancel={clearPress}
        onPointerLeave={clearPress}
      >
        {card.body}
      </div>
      <button
        ref={moreRef}
        type="button"
        className={ecm.more}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Options for ${eventName}`}
        onClick={onOpen}
        data-ecm-more=""
      >
        <MoreHorizontal aria-hidden strokeWidth={2} />
      </button>

      {desktop ? (
        open && hydrated
          ? createPortal(
              <>
                <OverlayBackdrop onClose={onClose} label="Close the menu" className="z-[74]" />
                <div
                  ref={panelRef}
                  role="dialog"
                  aria-labelledby={deleting ? deleteHeadingId : nameId}
                  className={ecm.panel}
                  style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
                  onKeyDown={onPanelKey}
                  data-ecm-panel=""
                >
                  {head}
                  {body}
                </div>
              </>,
              document.body,
            )
          : null
      ) : (
        <Sheet open={open} onClose={onClose} labelledById={deleting ? deleteHeadingId : nameId} head={head}>
          <div data-ecm-sheet="">{body}</div>
        </Sheet>
      )}
    </div>
  );
}

type CardProp = Parameters<typeof EventCardMenu>[0]['card'];

/** The six rows, in the drawing's order. A row the person may not open is not drawn; one that waits says why. */
function CardMenuRows({
  card,
  onNavigate,
  onDelete,
  pending,
}: {
  card: NonNullable<CardProp>;
  onNavigate: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const { menu } = card;
  const row = (props: {
    href: string | null;
    icon: React.ComponentType<{ 'aria-hidden'?: boolean; strokeWidth?: number; className?: string }>;
    label: string;
    help: string;
    main?: boolean;
    locked?: boolean;
    mark: string;
    /** Load the address as a whole page instead of an in-app switch (see the hub row). */
    fullLoad?: boolean;
  }) => {
    const Icon = props.icon;
    const inner = (
      <>
        <Icon aria-hidden strokeWidth={1.9} />
        <span className={ecm.tx}>
          <span className={ecm.lb}>{props.label}</span>
          <span className={ecm.hp}>{props.help}</span>
        </span>
        {props.locked ? (
          <Lock aria-hidden className={ecm.end} strokeWidth={2} />
        ) : props.href ? (
          <ChevronRight aria-hidden className={ecm.end} strokeWidth={2} />
        ) : null}
      </>
    );
    const cls = `${ecm.row} ${props.main ? ecm.main : ''}`;
    if (props.href && !props.locked && props.fullLoad) {
      return (
        <a key={props.mark} href={props.href} className={cls} onClick={onNavigate} data-ecm-row={props.mark} data-full-load="">
          {inner}
        </a>
      );
    }
    return props.href && !props.locked ? (
      <Link key={props.mark} href={props.href} className={cls} onClick={onNavigate} data-ecm-row={props.mark}>
        {inner}
      </Link>
    ) : (
      <div key={props.mark} className={cls} aria-disabled="true" data-ecm-row={props.mark}>
        {inner}
      </div>
    );
  };

  return (
    <>
      {row({ href: card.dashboardHref, icon: LayoutDashboard, label: 'Open Dashboard', help: 'Tasks, guests, suppliers and budget.', main: true, mark: 'dashboard' })}
      <div className={ecm.rows}>
        {/* 👁 The hub ITSELF, signed in as you, the way your own QR opens it — view only, never the Maker. A plain
            in-app link: the session rides along (never `openEventHub`, which leaves the app's view). */}
        {row({
          href: menu.hubHref,
          icon: Eye,
          label: 'Open your Event Hub',
          help: menu.hubHref ? 'See your hub as your QR opens it.' : 'Set up your Event Hub first.',
          mark: 'hub',
          // 🔁 A WHOLE-PAGE LOAD, not an in-app switch (walkthrough 27 Nov, as testnayan1 on the iPhone app): the hub
          // `/[slug]` lives under a different root layout than Home, and the in-app switch half-finished: the title
          // changed, the address stayed /dashboard and the iPhone never drew the hub. The same host, so it stays in
          // the app's view and the session rides along.
          fullLoad: true,
        })}
        {row({ href: menu.chatHref, icon: MessageCircle, label: 'Open Chat', help: 'Messages with your suppliers.', mark: 'chat' })}
        {menu.memoriesHref
          ? row({ href: menu.memoriesHref, icon: Images, label: 'Open your Memories', help: 'Photos and videos from this event.', mark: 'memories' })
          : null}
        {menu.story
          ? row({
              href: menu.story.href,
              icon: BookOpen,
              label: 'Publish Story',
              help: menu.story.open ? 'Your day has passed. Choose who reads it.' : 'Opens the day after your event.',
              locked: !menu.story.open,
              mark: 'story',
            })
          : null}
      </div>
      {menu.canDelete ? (
        <>
          <div className={ecm.divider} />
          <button
            type="button"
            className={`${ecm.row} ${ecm.danger}`}
            onClick={onDelete}
            disabled={pending}
            data-ecm-row="delete"
          >
            <Trash2 aria-hidden strokeWidth={1.9} />
            <span className={ecm.tx}>
              <span className={ecm.lb}>Delete Event</span>
              <span className={ecm.hp}>Photos and everything else, gone for good.</span>
            </span>
            <ChevronRight aria-hidden className={ecm.end} strokeWidth={2} />
          </button>
        </>
      ) : null}
    </>
  );
}
