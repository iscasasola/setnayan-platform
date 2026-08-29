'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Archive, CalendarPlus, MoreVertical, Trash2 } from 'lucide-react';

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
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
        /* revalidatePath marks the cache stale; it does not push fresh props
           into a component already on screen. Without this the card does not
           move and a silent success reads exactly like a dead button. */
        router.refresh();
      } catch (err) {
        console.error('[event-card-menu] archive rejected', err);
        setError('We couldn’t save that just now. Please try again.');
      }
    });
  }

  function openDelete() {
    setError(null);
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
        router.refresh();
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
        router.refresh();
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
        router.refresh();
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
        router.refresh();
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
        router.refresh();
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
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Options for ${eventName}`}
        className={`absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-full backdrop-blur-[6px] transition-colors ${
          dark
            ? 'bg-black/35 text-white/80 hover:bg-black/55 hover:text-white'
            : 'bg-white/80 text-ink/60 shadow-[0_2px_8px_rgba(30,26,18,0.10)] hover:bg-white hover:text-ink'
        }`}
      >
        <MoreVertical aria-hidden className="h-[17px] w-[17px]" strokeWidth={2} />
      </button>

      {open && !confirming ? (
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
            role="menu"
            className={`absolute top-11 z-50 w-[17.5rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-ink/10 bg-cream p-1 text-left shadow-lg ${
              align === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            {icsHref ? (
              <>
                <a
                  href={icsHref}
                  download={`${eventName}.ics`}
                  role="menuitem"
                  onClick={close}
                  className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-ink/5"
                >
                  <CalendarPlus
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-ink/60"
                    strokeWidth={2}
                  />
                  <span>
                    <span className="block font-semibold">
                      Add to calendar
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-ink/55">
                      Just this celebration, on your phone.
                    </span>
                  </span>
                </a>
                <div className="my-1 h-px bg-ink/10" />
              </>
            ) : null}

            <button
              type="button"
              role="menuitem"
              onClick={putAway}
              disabled={pending}
              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-ink/5 disabled:opacity-60"
            >
              <Archive
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-ink/60"
                strokeWidth={2}
              />
              <span>
                <span className="block font-semibold">
                  {archived ? 'Bring it back' : 'Put this away'}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink/55">
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
              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-[color:var(--sn-danger)] hover:bg-[color:var(--sn-danger-soft)] disabled:opacity-60"
            >
              <Trash2
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={2}
              />
              <span>
                <span className="block font-semibold">Remove for good</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink/55">
                  Photos and everything else, gone for good.
                </span>
              </span>
            </button>

            {error ? (
              <p
                role="alert"
                className="px-3 pb-2 pt-1 text-[11.5px] font-semibold text-[color:var(--sn-danger)]"
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
      <RemoveDialog open={confirming} onDismiss={close} label={`Remove ${eventName}?`}>
        <div className="p-4">
          <p className="text-sm font-bold text-ink">
            Remove {eventName}?
          </p>

          {!impact ? (
            <p className="mt-1.5 text-[12px] text-ink/60">
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
              <p className="mt-1.5 text-[12px] leading-snug text-ink/70">
                <strong className="font-semibold text-ink">
                  We have your request
                </strong>{' '}
                — nothing is removed until we answer, and we’ll let you
                know when we do.
              </p>
              {impact.pendingRequest ? (
                <p className="mt-1 text-[11.5px] leading-snug text-ink/55">
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
                className="sn-press mt-2 text-[12px] font-bold text-ink/60 underline underline-offset-2 hover:text-ink disabled:opacity-60"
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
              <p className="mt-1.5 text-[12px] leading-snug text-ink/70">
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
              <p className="mt-1.5 text-[12px] leading-snug text-ink/70">
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
                <ul className="mt-2 grid gap-1">
                  {impact.paidItems.map((item, i) => (
                    <li
                      key={`${item.description}-${i}`}
                      className="flex items-start justify-between gap-2 rounded-md bg-ink/5 px-2 py-1.5 text-[11.5px] leading-snug"
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
                <button
                  type="button"
                  onClick={askSuppliers}
                  disabled={pending}
                  className="sn-press mt-2.5 inline-flex items-center gap-2 rounded-full bg-mulberry px-3 py-1.5 text-[12.5px] font-bold text-cream transition-colors hover:bg-mulberry-600 disabled:opacity-60"
                >
                  {pending ? 'Asking…' : 'Ask them to agree'}
                </button>
              ) : null}
              {/*
                ⛔ AND THE UNREADABLE ONE KEEPS ITS DEAD END, DELIBERATELY.
                `canAsk` is false there because there is nothing to
                request about — we do not yet know whether there is
                anything to request about. A button would be a door to a
                room we cannot describe.
              */}
              {impact.canAsk ? (
                <button
                  type="button"
                  onClick={() => setAsking(true)}
                  disabled={pending}
                  className="sn-press mt-2.5 inline-flex items-center gap-2 rounded-full bg-mulberry px-3 py-1.5 text-[12.5px] font-bold text-cream transition-colors hover:bg-mulberry-600 disabled:opacity-60"
                >
                  Ask us to remove it
                </button>
              ) : null}
            </>
          ) : (
            <>
              <ImpactLines impact={impact} />
              {/*
                ⚖ ASKED, NEVER DEMANDED. The Remove button does not wait
                on this — holding somebody's own celebration hostage to a
                survey would be the product asking for a favour on the way
                out. It is here because this is the ONLY moment anybody
                will ever tell us why they left, and it costs one tap.
              */}
              <ReasonPicker
                code={reasonCode}
                onCode={setReasonCode}
                text={reasonText}
                onText={setReasonText}
                textLabel="Anything you want to add?"
                textRequired={false}
                optional
              />
              <label className="mt-2.5 block text-[11.5px] font-semibold text-ink/70">
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
                  className="mt-1 w-full rounded-lg border border-ink/20 bg-white px-2.5 py-1.5 text-sm font-normal text-ink outline-none focus:border-mulberry"
                />
              </label>
              {error ? (
                <p
                  role="alert"
                  className="mt-1.5 text-[11.5px] font-semibold text-[color:var(--sn-danger)]"
                >
                  {error}
                </p>
              ) : null}
            </>
          )}

          {asked !== null ? (
            <>
              <p className="mt-2 text-[12px] leading-snug text-[color:var(--sn-ink-500)]">
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
                className="sn-press mt-1.5 text-[12px] font-bold text-ink/60 underline underline-offset-2 hover:text-ink disabled:opacity-60"
              >
                {pending ? 'Withdrawing…' : 'Withdraw the request'}
              </button>
            </>
          ) : null}
          <div className="mt-3 flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={asking ? () => setAsking(false) : close}
              disabled={pending}
              className="rounded-full px-3 py-1.5 text-[12.5px] font-bold text-ink/70 hover:text-ink disabled:opacity-60"
            >
              {asking ? 'Back' : 'Cancel'}
            </button>
            {asking ? (
              <button
                type="button"
                onClick={sendRequest}
                disabled={pending || !reasonIsComplete(reasonCode, reasonText)}
                className="rounded-full bg-mulberry px-3 py-1.5 text-[12.5px] font-bold text-cream disabled:opacity-45"
              >
                {pending ? 'Sending…' : 'Send it'}
              </button>
            ) : impact && !impact.blocked ? (
              <button
                type="button"
                onClick={confirmDelete}
                disabled={pending || typed.trim().length === 0}
                className="rounded-full bg-[color:var(--sn-danger)] px-3 py-1.5 text-[12.5px] font-bold text-cream disabled:opacity-45"
              >
                {pending ? 'Removing…' : 'Remove for good'}
              </button>
            ) : null}
          </div>
        </div>
      </RemoveDialog>
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

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
  }, [open, onDismiss]);

  if (typeof document === 'undefined') return null;

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
    <p className="mt-1.5 text-[12px] leading-snug text-ink/70">
      {parts.length > 0 ? (
        <>
          <span className="font-semibold text-ink">{parts.join(' · ')}</span> go
          with it, along with the page your guests use.{' '}
        </>
      ) : (
        <>Everything on it goes, including the page your guests use. </>
      )}
      {/*
        ⚠ THE SENTENCE THE OWNER ASKED FOR, 2026-08-20: "give them the
        information that you will also lose your photos and information of the
        event permanently."

        It is separate from the counted line above on purpose. That line lists
        WHAT — and a count reads as an inventory, something you could imagine
        asking us to restore. This says the photographs are GONE, in the two
        words people actually check for. Until today it was not even true that
        the files went; now it is, so the warning has to say so before the press
        rather than after.

        "Deleted for good" and "can't be undone" are not the same promise. The
        second one is about the button; the first is about the photographs.
      */}
      <strong className="font-semibold text-ink">
        Your photos and everything about this celebration are deleted for good
      </strong>{' '}
      — you can’t bring any of it back, and neither can we.
    </p>
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
 * ⚠ REAL `<button>`s, not divs with click handlers. These are toggles a person
 * reaches with the keyboard on the way out of something irreversible;
 * `aria-pressed` is what makes the chosen one audible.
 */
function ReasonPicker({
  code,
  onCode,
  text,
  onText,
  textLabel,
  textRequired,
  optional = false,
}: {
  code: string;
  onCode: (c: string) => void;
  text: string;
  onText: (t: string) => void;
  textLabel: string;
  textRequired: boolean;
  /** Ordinary removals say so — the button never waits on this. */
  optional?: boolean;
}) {
  return (
    <div className="mt-2.5">
      <p className="text-[11.5px] font-semibold text-ink/70">
        Why are you removing it?
        {optional ? (
          <span className="ml-1 font-normal text-ink/45">Optional</span>
        ) : null}
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {DELETION_REASONS.map((r) => {
          const on = r.code === code;
          return (
            <button
              key={r.code}
              type="button"
              aria-pressed={on}
              /* Pressing the chosen one again clears it — on an optional
                 question, a choice you cannot take back is a trap. */
              onClick={() => onCode(on ? '' : r.code)}
              className={`rounded-full border px-2 py-1 text-[11.5px] font-semibold transition-colors ${
                on
                  ? 'border-mulberry bg-mulberry text-cream'
                  : 'border-ink/20 text-ink/70 hover:border-ink/40 hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      {code ? (
        <label className="mt-2 block text-[11.5px] font-semibold text-ink/70">
          {textLabel}
          {textRequired ? null : (
            <span className="ml-1 font-normal text-ink/45">Optional</span>
          )}
          <textarea
            value={text}
            onChange={(e) => onText(e.target.value)}
            rows={2}
            maxLength={1000}
            className="mt-1 w-full rounded-lg border border-ink/20 bg-white px-2.5 py-1.5 text-[12px] font-normal leading-snug text-ink outline-none focus:border-mulberry"
          />
        </label>
      ) : null}
    </div>
  );
}
