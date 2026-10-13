'use client';

/**
 * Shared lock-flow UI: the pre-lock confirmation modal + the milestone congrats
 * toast. Both are used by every finalizeVendor caller (accordion-lock,
 * plan-card-lock, plan-card-compare) so the "here is what this lock costs" and
 * "congratulations, you picked X" experiences are identical everywhere.
 *
 * Both self-portal to <body> so `position:fixed` escapes any ancestor transform
 * (the coverflow `.card` on the home plan cards), matching the existing
 * ExceptionModal/UndoToast pattern in accordion-lock.tsx.
 *
 * ⚠ ONE MODAL, NOT TWO (owner 2026-09-06). The confirm below was
 * `LockDateConfirmModal` and fired only on 'date_will_lock'. It now also fires
 * on 'lock_will_cost' — a lock that kills a saved plan or sinks a bench vendor
 * without setting the date — and a lock that does BOTH renders both facts in a
 * single dialog. A second confirm stacked after the first would ask the couple
 * to re-decide something they decided one screen ago, and the second one gets
 * clicked through unread.
 */

import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CalendarHeart, Check, Loader2, Lock, PartyPopper, Plus, RotateCcw, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { POPUP_DARK, POPUP_SCRIM, usePopupBehind } from '@/lib/use-popup-behind';
import { lockImpactCopy, type LockImpact } from '@/lib/lock-impact';
import type { LockMilestone } from '../actions';

function portal(node: React.ReactNode): React.ReactNode {
  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}

/** The ✕ in a lock popup's corner — a 44-px target (2026-10-12 look sweep). */
export const LOCK_POPUP_CLOSE =
  'absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-60';

/** The spinner a pressed answer wears while the booking is written. */
export const LOCK_PENDING_ICON = <Loader2 aria-hidden className="animate-spin" strokeWidth={2} />;

/**
 * LockPopup — THE ONE FRAME OF EVERY POP-UP IN THE BOOKING FLOW (2026-10-12 look sweep; `INTERACTION_RULES.md` § 9,
 * "Anything popped up over the page"). The exception, slot, confirm, reservation-terms and first-payment pop-ups each
 * drew their own `bg-ink/40` wash — and `ink` turns LIGHT in dark mode. Now:
 *   · the rest of the screen is the shared dark (`.sn-popup-dark`, `POPUP_DARK`) — dark and blurred, taking no tap;
 *   · one button under it, the whole screen (`POPUP_SCRIM`), closes — a tap on the dark is "keep", never the answer;
 *   · nothing behind works and the page does not scroll (`usePopupBehind`), Esc closes, Tab stays in the panel;
 *   · the panel is `bg-cream` (it flips in dark mode); its ✕ is a 44-px target.
 * It draws on <body>: the bench card carries the coverflow `transform`, inside which `position: fixed` is not the
 * screen. `z-[90]` sits UNDER a dropdown's list (`PickMenu`, z-[95]) — the slot picker opens one inside it — and
 * under the toast (z-[100]). Mount it while open (mount = open).
 */
export function LockPopup({
  label,
  alertRole = false,
  onClose,
  closeDisabled = false,
  children,
}: {
  /** The pop-up's accessible name. */
  label: string;
  /** A decision with a consequence (`alertdialog`) rather than a plain dialog. */
  alertRole?: boolean;
  onClose: () => void;
  /** The ✕ cannot be pressed (a payment is being written). */
  closeDisabled?: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  usePopupBehind({ root, panel, onClose });
  return portal(
    <div ref={root} data-lock-popup="" className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
      {/* A tap on the dark closes it. */}
      <button type="button" aria-label="Close" onClick={onClose} className={POPUP_SCRIM} />
      <span aria-hidden className={POPUP_DARK} />
      <div
        ref={panel}
        role={alertRole ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="relative max-h-[calc(100dvh-32px)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl bg-cream p-5 text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,.5)] focus:outline-none sm:p-6"
      >
        <button type="button" aria-label="Close" onClick={onClose} disabled={closeDisabled} className={LOCK_POPUP_CLOSE}>
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
        {children}
      </div>
    </div>,
  );
}

/**
 * The pre-lock confirm — *"what does this cost me?"*, answered before the write.
 *
 * Fires on two gate results, together or apart:
 *
 *  • `date_will_lock` → `dateLabel` set: "Locking this service will finally set
 *    your wedding date to {date}." Confirm → re-call with confirm_date_lock=1.
 *  • `lock_will_cost` → `impact` set: the saved plans that stop being loadable
 *    and the bench vendors that stop sharing a free day. Confirm → re-call with
 *    confirm_lock_impact=1.
 *
 * Both null is not a state this renders — the caller must not open a confirm
 * for a lock that costs nothing (a modal that always fires is clicked through
 * unread, and then the one that mattered is too).
 *
 * ⚠ TWO SENTENCES THIS MODAL MUST NEVER SAY, both already pinned by tests:
 *  • that a day is HELD or RESERVED. `build-date-window.ts` rule 3 — the soft
 *    tier reasons over declared calendars and promises nothing about
 *    reservations until a vendor accepts payment. A lock SETS the event's date;
 *    it does not hold a day with anybody.
 *  • that a saved plan is DELETED. A lock makes a plan un-loadable; the row
 *    survives and comes back the moment the lock does. `lockImpactCopy` owns
 *    that wording (`lock-impact.test.ts` fails if it drifts), which is exactly
 *    why the copy is called here rather than re-written in JSX.
 */
export function LockConfirmModal({
  vendorName,
  dateLabel,
  impact,
  isPending,
  onConfirm,
  onDismiss,
}: {
  vendorName: string;
  /** Set when this lock also finalizes the wedding date; null otherwise. */
  dateLabel: string | null;
  /** What else this lock closes; null when it closes nothing. */
  impact: LockImpact | null;
  isPending: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  // Single source for every casualty sentence. Returns null for an empty
  // impact, so a stale non-null-but-empty impact renders nothing rather than an
  // empty bulleted list.
  const copy = impact ? lockImpactCopy(impact, vendorName) : null;
  const heading = dateLabel ? 'This books your date.' : (copy?.headline ?? `Book ${vendorName}`);

  return (
    <LockPopup label={heading} alertRole onClose={onDismiss}>
      <div className="flex items-start gap-2.5 pr-8">
        {dateLabel ? (
          <CalendarHeart aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-sn-accent" strokeWidth={2} />
        ) : (
          <Lock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-sn-accent" strokeWidth={2} />
        )}
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-ink">
            {dateLabel ? 'This books your date.' : copy?.headline}
          </h3>
          {dateLabel ? (
            <p className="text-xs leading-snug text-ink/70">
              Booking <strong>{vendorName}</strong> leaves only one of your
              candidate dates open. Continuing will finally set your
              date to <strong>{dateLabel}</strong>. You can still change
              suppliers, but the date becomes official.
            </p>
          ) : null}
          {/* What else it closes. Rendered under the date sentence when this
              lock does both, so the couple reads one consequence list. */}
          {copy ? (
            <ul className="space-y-1.5 pt-0.5">
              {copy.lines.map((line) => (
                <li key={line} className="flex items-start gap-1.5 text-xs leading-snug text-ink/70">
                  <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sn-accent" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* The safe one grey, the answer filled (the confirm box's own pair). */}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <ActionButton tone="neutral" icon={X} label="Not yet" onClick={onDismiss} disabled={isPending} />
        <ActionButton
          tone="brand"
          main
          icon={isPending ? LOCK_PENDING_ICON : dateLabel ? CalendarHeart : Lock}
          label={isPending ? 'Booking…' : dateLabel ? `Book ${dateLabel}` : (copy?.confirmLabel ?? `Book ${vendorName}`)}
          onClick={onConfirm}
          disabled={isPending}
        />
      </div>
    </LockPopup>
  );
}

/**
 * "Congratulations! You have picked a {Reception venue}!" — the result of a lock.
 *
 * 2026-10-12 look sweep (`INTERACTION_RULES.md` § 9, kind 12 "Messages": a toast peeks from the TOP). Two shapes:
 *   · THE RESULT ALONE (no question, no next step) is the shared `PeekToast` — the accent with a ✓, from the top,
 *     with "Undo" as its one action; it leaves by itself and tells the caller (`onDismiss`). It was a bordered card
 *     at the bottom of the screen.
 *   · WITH A QUESTION ("Done with Photography, or add another?") or A NEXT STEP ("Finalize your Save the Date") it
 *     is not a notice but a pop-up that waits for the answer — the shared `LockPopup`, its answers `ActionButton`s.
 *     A tap on the dark is "add another" — the harmless answer (it only dismisses).
 */
export function LockMilestoneToast({
  milestone,
  onUndo,
  onDismiss,
  askDone = false,
  groupLabel,
  onDone,
  onAddAnother,
}: {
  milestone: LockMilestone;
  /** When provided, renders an "Undo · revert to considering" affordance. */
  onUndo?: () => void;
  onDismiss: () => void;
  /** Explore Replan slice A: multi-pick lock → ask "done with this service, or
   *  add another?" ("✓ I'm done" persists decision='complete'; "＋ Add another"
   *  just dismisses — the rail stays open for the next candidate). */
  askDone?: boolean;
  groupLabel?: string;
  onDone?: () => void;
  onAddAnother?: () => void;
}) {
  const asks = askDone && onDone && onAddAnother ? { onDone, onAddAnother } : null;
  if (!asks && !milestone.finalizeReady) {
    return portal(
      <PeekToast
        tone="ok"
        data="lock-milestone"
        action={onUndo ? { label: 'Undo', onPress: onUndo } : undefined}
        onGone={onDismiss}
      >
        Congratulations! You have picked a {milestone.pickedLabel}!
        {milestone.dateLocked ? ' Your date is now booked.' : ''}
      </PeekToast>,
    );
  }
  const finalize = milestone.finalizeReady;
  return (
    <LockPopup
      label={`Congratulations! You have picked a ${milestone.pickedLabel}!`}
      onClose={asks ? asks.onAddAnother : onDismiss}
    >
      <div role="status" aria-live="polite" className="flex items-start gap-3 pr-8">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sn-accent text-sn-on-accent">
          <PartyPopper aria-hidden className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-semibold text-ink">
            Congratulations! You have picked a {milestone.pickedLabel}!
          </h3>
          {milestone.dateLocked ? <p className="text-xs text-ink/60">Your date is now booked. 🎉</p> : null}
          {finalize ? <p className="text-xs text-ink/60">{finalize.helper}</p> : null}
          {asks ? (
            <p className="pt-1 text-xs font-medium text-ink/70">
              Done with {groupLabel ?? 'this service'}, or add another?
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {onUndo ? (
          <ActionButton tone="neutral" quiet icon={RotateCcw} label="Undo" name="Undo · revert to considering" onClick={onUndo} />
        ) : null}
        {asks ? (
          <>
            <ActionButton tone="neutral" icon={Plus} label="Add another" onClick={asks.onAddAnother} />
            <ActionButton tone="brand" main icon={Check} label="I'm done" onClick={asks.onDone} />
          </>
        ) : null}
        {finalize ? (
          <ActionButton
            tone="brand"
            main={!asks}
            icon={ArrowRight}
            label={`Finalize your ${finalize.featureLabel}`}
            href={finalize.href}
            onClick={onDismiss}
          />
        ) : null}
      </div>
    </LockPopup>
  );
}
