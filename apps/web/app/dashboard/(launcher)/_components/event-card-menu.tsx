'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CalendarPlus, MoreVertical, Trash2 } from 'lucide-react';

import { setEventArchived } from '../../[eventId]/archive-actions';
import {
  askSuppliersToAgree,
  withdrawSupplierAsk,
  deleteOwnEvent,
  getEventDeletionImpact,
  type DeletionImpact,
} from '../../[eventId]/delete-actions';
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
   * VEVENT, downloaded once. NOT the all-events subscription
   * (`calendar-subscribe.tsx`), which follows every celebration and keeps
   * itself up to date. Owner 2026-08-22: *"adding an event to a calendar is
   * not all events but just per event"* — a person wants ONE wedding on
   * their phone, not the whole board, and picking it out of the subscribed
   * feed by name is a worse experience than a button on the card itself.
   * `null` when there is no date yet ⇒ the row is skipped entirely rather
   * than offered and refused.
   */
  eventDateIso = null,
  venueName = null,
  venueAddress = null,
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
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function close() {
    setOpen(false);
    setConfirming(false);
    setImpact(null);
    setTyped('');
    setError(null);
    setAsked(null);
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

  function confirmDelete() {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('confirm_name', typed);
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
    const ics = buildWeddingIcs({
      title: eventName,
      dateIso: eventDateIso,
      location: venueName ?? venueAddress ?? null,
      uid: `wedding-${eventId}@setnayan.com`,
    });
    return ics ? icsDataHref(ics) : null;
  }, [eventName, eventDateIso, venueName, venueAddress, eventId]);

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

      {open ? (
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
            {!confirming ? (
              <>
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
              </>
            ) : (
              <div className="px-3 py-2.5">
                <p className="text-sm font-bold text-ink">
                  Remove {eventName}?
                </p>

                {!impact ? (
                  <p className="mt-1.5 text-[12px] text-ink/60">
                    {error ? error : 'Checking what’s on this one…'}
                  </p>
                ) : impact.blocked ? (
                  /* The refusal is stated BEFORE anything is typed. Asking
                     somebody to type their wedding's name and then telling
                     them no is a worse refusal than no button at all. */
                  <>
                    <p className="mt-1.5 text-[12px] leading-snug text-ink/70">
                      {impact.blockedReason}
                    </p>
                    {/*
                      🔑 A REFUSAL WITH A DOOR. Owner 2026-08-21: a paid supplier
                      must ACCEPT the deletion — so where suppliers are what is
                      holding it, the couple gets the ask rather than a dead end.
                      Only offered when suppliers are the reason: money paid to
                      Setnayan, or an unreadable check, has no supplier to ask
                      and the button would be a door to nothing.
                    */}
                    {(impact.unsettledPaidSuppliers ?? 0) > 0 ? (
                      <button
                        type="button"
                        onClick={askSuppliers}
                        disabled={pending}
                        className="sn-press mt-2.5 inline-flex items-center gap-2 rounded-full bg-mulberry px-3 py-1.5 text-[12.5px] font-bold text-cream transition-colors hover:bg-mulberry-600 disabled:opacity-60"
                      >
                        {pending ? 'Asking…' : 'Ask them to agree'}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <ImpactLines impact={impact} />
                    <label className="mt-2.5 block text-[11.5px] font-semibold text-ink/70">
                      Type <span className="font-bold text-ink">{eventName}</span> to
                      confirm
                      <input
                        type="text"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
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
                    onClick={close}
                    disabled={pending}
                    className="rounded-full px-3 py-1.5 text-[12.5px] font-bold text-ink/70 hover:text-ink disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  {impact && !impact.blocked ? (
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
            )}
          </div>
        </>
      ) : null}
    </>
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
