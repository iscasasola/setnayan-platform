'use client';

/**
 * Shared lock-flow UI: the date-lock confirmation modal + the milestone
 * congrats toast. Both are used by every finalizeVendor caller (accordion-lock,
 * plan-card-lock, plan-card-compare) so the "locking this narrows your date" and
 * "congratulations, you picked X" experiences are identical everywhere.
 *
 * Both self-portal to <body> so `position:fixed` escapes any ancestor transform
 * (the coverflow `.card` on the home plan cards), matching the existing
 * ExceptionModal/UndoToast pattern in accordion-lock.tsx.
 */

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { CalendarHeart, Loader2, PartyPopper, X, ArrowRight } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import type { LockMilestone } from '../actions';

function portal(node: React.ReactNode): React.ReactNode {
  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}

/**
 * "Locking this service will finally set your wedding date to {date}." Shown
 * when finalizeVendor returns 'date_will_lock'. Confirm → re-call the lock with
 * confirm_date_lock=1.
 */
export function LockDateConfirmModal({
  vendorName,
  dateLabel,
  isPending,
  onConfirm,
  onDismiss,
}: {
  vendorName: string;
  dateLabel: string;
  isPending: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose: onDismiss, containerRef: dialogRef });

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
          <CalendarHeart
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-terracotta"
            strokeWidth={2}
          />
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-ink">
              This locks your wedding date.
            </h3>
            <p className="text-xs leading-snug text-ink/70">
              Locking <strong>{vendorName}</strong> leaves only one of your
              candidate dates open. Continuing will finally set your wedding date
              to <strong>{dateLabel}</strong>. You can still change vendors, but
              the date becomes official.
            </p>
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
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                Locking…
              </>
            ) : (
              <>Lock {dateLabel}</>
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
}: {
  milestone: LockMilestone;
  /** When provided, renders an "Undo · revert to considering" affordance. */
  onUndo?: () => void;
  onDismiss: () => void;
}) {
  return portal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-terracotta/40 bg-cream px-4 py-3.5 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta text-cream">
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
                className="group mt-1 inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline"
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
          {onUndo ? (
            <p className="pt-0.5 text-[11px] text-ink/55">
              Changed your mind?{' '}
              <button
                type="button"
                onClick={onUndo}
                className="font-medium text-terracotta underline underline-offset-2 hover:text-terracotta/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
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
