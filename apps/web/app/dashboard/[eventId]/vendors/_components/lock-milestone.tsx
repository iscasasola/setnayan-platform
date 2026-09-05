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

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { CalendarHeart, Loader2, Lock, PartyPopper, X, ArrowRight } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { lockImpactCopy, type LockImpact } from '@/lib/lock-impact';
import type { LockMilestone } from '../actions';

function portal(node: React.ReactNode): React.ReactNode {
  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose: onDismiss, containerRef: dialogRef });

  // Single source for every casualty sentence. Returns null for an empty
  // impact, so a stale non-null-but-empty impact renders nothing rather than an
  // empty bulleted list.
  const copy = impact ? lockImpactCopy(impact, vendorName) : null;

  return portal(
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm focus:outline-none sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-terracotta/40 bg-cream p-5 shadow-xl sm:p-6">
        <button
          type="button"
          aria-label="Close"
          onClick={onDismiss}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="flex items-start gap-2.5 pr-6">
          {dateLabel ? (
            <CalendarHeart
              aria-hidden
              className="mt-0.5 h-5 w-5 shrink-0 text-terracotta"
              strokeWidth={2}
            />
          ) : (
            <Lock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={2} />
          )}
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-ink">
              {dateLabel ? 'This locks your wedding date.' : copy?.headline}
            </h3>
            {dateLabel ? (
              <p className="text-xs leading-snug text-ink/70">
                Locking <strong>{vendorName}</strong> leaves only one of your
                candidate dates open. Continuing will finally set your wedding
                date to <strong>{dateLabel}</strong>. You can still change
                vendors, but the date becomes official.
              </p>
            ) : null}
            {/* What else it closes. Rendered under the date sentence when this
                lock does both, so the couple reads one consequence list. */}
            {copy ? (
              <ul className="space-y-1.5 pt-0.5">
                {copy.lines.map((line) => (
                  <li key={line} className="flex items-start gap-1.5 text-xs leading-snug text-ink/70">
                    <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-terracotta" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
          >
            Not yet
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                Locking…
              </>
            ) : (
              <>{dateLabel ? `Lock ${dateLabel}` : (copy?.confirmLabel ?? `Lock ${vendorName}`)}</>
            )}
          </button>
        </div>
      </div>
    </div>,
  );
}

/**
 * "Congratulations! You have picked a {Reception venue}!" — with an optional
 * "You can now finalize your {Save the Date}" CTA when the lock completed a
 * downstream feature's prerequisites. Auto-dismiss is the caller's job (so it
 * can coordinate with its own undo toast).
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
  return portal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-terracotta/40 bg-cream px-4 py-3.5 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta-700 text-cream">
          <PartyPopper aria-hidden className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-ink">
            Congratulations! You have picked a {milestone.pickedLabel}!
          </p>
          {milestone.dateLocked ? (
            <p className="text-[11px] text-ink/60">Your wedding date is now locked in. 🎉</p>
          ) : null}
          {milestone.finalizeReady ? (
            <div className="pt-1">
              <p className="text-[11px] text-ink/60">{milestone.finalizeReady.helper}</p>
              <Link
                href={milestone.finalizeReady.href}
                onClick={onDismiss}
                className="group mt-1 inline-flex items-center gap-1 text-sm font-medium text-terracotta-700 hover:underline"
              >
                Finalize your {milestone.finalizeReady.featureLabel}
                <ArrowRight
                  aria-hidden
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </Link>
            </div>
          ) : null}
          {askDone && onDone && onAddAnother ? (
            <div className="pt-1.5">
              <p className="text-[11px] font-medium text-ink/70">
                Done with {groupLabel ?? 'this service'}, or add another?
              </p>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={onDone}
                  className="flex-1 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-cream hover:bg-ink/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                >
                  ✓ I&apos;m done
                </button>
                <button
                  type="button"
                  onClick={onAddAnother}
                  className="flex-1 rounded-lg border border-terracotta px-3 py-1.5 text-xs font-semibold text-terracotta-700 hover:bg-terracotta/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                >
                  ＋ Add another
                </button>
              </div>
            </div>
          ) : null}
          {onUndo ? (
            <p className="pt-0.5 text-[11px] text-ink/55">
              Changed your mind?{' '}
              <button
                type="button"
                onClick={onUndo}
                className="font-medium text-terracotta-700 underline underline-offset-2 hover:text-terracotta-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                Undo · revert to considering
              </button>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-ink/45 hover:bg-ink/5 hover:text-ink/70"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>,
  );
}
