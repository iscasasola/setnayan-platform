'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BookmarkCheck,
  Clock,
  Loader2,
  Lock,
  X,
} from 'lucide-react';
import {
  PLAN_GROUPS,
  type PlanCardPick,
  type PlanGroupId,
} from '@/lib/wedding-plan-groups';
import { WEDDING_FOLDER_SLUG } from '@/lib/taxonomy';
import {
  finalizeVendor,
  listLockTimeSlots,
  revertVendorToConsidering,
  type FinalizeVendorResult,
} from '../vendors/actions';
import {
  slotOptionLabel,
  type VendorServiceTimeSlot,
} from '@/lib/vendor-time-slots';

// Lock-this-vendor inline CTA — for the single-pick case (2026-05-22).
//
// When a card has exactly ONE considering pick, the Compare drawer doesn't
// surface (it gates on picks.length >= 2 because there's nothing to compare).
// Without this component the host has no in-card path to lock that single
// vendor — they had to leave the dashboard, open the vendor tracker, change
// the status manually, and come back. Owner-reported gap 2026-05-22:
// "When only 1 considering pick, show a Lock button in place of Compare."
//
// Reuses the proven server actions from PlanCardCompare (2026-05-22, PR shipping
// the finalizeVendor + revertVendorToConsidering pair):
//   - finalizeVendor flips status considering → 'contracted' (the first entry
//     in CONFIRMED_VENDOR_STATUSES per lib/events.ts). Returns a Result shape
//     so the UI can surface conflict + error states without a page fault.
//   - revertVendorToConsidering powers the 5-second Undo toast — same UX
//     contract PlanCardCompare ships, lifted here for symmetry.
//
// Hard-single conflict: ceremony_venue + reception_venue + officiant +
// coordinator + host_mc + led_background are HARD_SINGLE_PICK_GROUPS per
// lib/wedding-plan-groups.ts. The hasLocked short-circuit in GroupCard already
// prevents this component from rendering when THIS card has a lock — but a
// hard-single CANONICAL could still have a lock elsewhere (rare, only on
// shared-canonical multi-card groups). The conflict path stays wired so the
// host gets the same Switch / Cancel modal PlanCardCompare ships.
//
// Brand voice — Lock icon + label "Lock" matches the Compare-drawer Lock CTA
// (BookmarkCheck + "Lock this vendor"). The inline button is sized to the
// Search / Add row so the three CTAs read as a single button group. Per
// [[feedback_setnayan_no_dev_text_post_launch]] — polite copy, no jargon,
// no all-caps urgency.

const TOAST_AUTO_DISMISS_MS = 5_000;

type LockState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | {
      kind: 'conflict';
      existingVendorId: string;
      existingVendorName: string;
      conflictGroupLabel: string;
    }
  // PR A · Rule 3 of the lock/delete/overlap architecture (CLAUDE.md
  // 2026-05-24 row "Canonical wizard sequence reconciled 38 → 45 + Lock/
  // delete/overlap architecture"). Surfaced when the target vendor's
  // configured max_soft_holds_per_date is already filled by other hosts'
  // contracted-status picks on the same event_date. UI shows a polite
  // explanation + Browse-similar-vendors CTA. Single-pick Lock surface
  // (this component) mirrors the Compare drawer flow (PlanCardCompare).
  | {
      kind: 'soft_hold_limit';
      currentLimit: number;
      existingHoldCount: number;
    }
  // Tier #3 (owner 2026-06-09): the booked service has active time windows —
  // the couple must pick one before the lock proceeds.
  | {
      kind: 'slot_select';
      slots: VendorServiceTimeSlot[];
      selectedSlotId: string;
    }
  | { kind: 'error'; message: string };

type ToastState =
  | { kind: 'hidden' }
  | {
      kind: 'locked';
      vendorId: string;
      vendorName: string;
      undoUntil: number;
    };

type Props = {
  eventId: string;
  groupId: PlanGroupId;
  groupLabel: string;
  pick: PlanCardPick;
};

export function PlanCardLock({ eventId, groupId, groupLabel, pick }: Props) {
  const [isOpen, setOpen] = useState(false);
  const [lockState, setLockState] = useState<LockState>({ kind: 'idle' });
  const [toast, setToast] = useState<ToastState>({ kind: 'hidden' });
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-dismiss the toast after TOAST_AUTO_DISMISS_MS.
  useEffect(() => {
    if (toast.kind !== 'locked') return;
    const remaining = toast.undoUntil - Date.now();
    if (remaining <= 0) {
      setToast({ kind: 'hidden' });
      return;
    }
    const t = setTimeout(() => setToast({ kind: 'hidden' }), remaining);
    return () => clearTimeout(t);
  }, [toast]);

  // Focus the cancel button on open — calmest default, the destructive
  // path requires a deliberate tab over.
  useEffect(() => {
    if (isOpen) {
      cancelBtnRef.current?.focus();
    }
  }, [isOpen]);

  // Escape-key dismissal — accessibility default for modals.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const closeModal = () => {
    setOpen(false);
    // Clear ephemeral lock state so the next open starts clean. The toast
    // outlives the modal on purpose — Undo should reach the host even
    // after the dialog closes.
    setLockState({ kind: 'idle' });
  };

  // "Yes, lock" entry point — if the booked service has time windows, open the
  // in-modal picker; else lock straight through. Keeps the happy path one
  // confirm for vendors without slots.
  const requestLock = () => {
    setLockState({ kind: 'pending' });
    startTransition(async () => {
      let slots: VendorServiceTimeSlot[] = [];
      try {
        slots = await listLockTimeSlots(eventId, pick.vendor_id);
      } catch {
        slots = [];
      }
      const firstSlot = slots[0];
      if (firstSlot) {
        setLockState({
          kind: 'slot_select',
          slots,
          selectedSlotId: firstSlot.slot_id,
        });
        return;
      }
      performLock(false, null);
    });
  };

  const performLock = (overrideExisting: boolean, slotId: string | null) => {
    setLockState({ kind: 'pending' });
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', pick.vendor_id);
      if (overrideExisting) fd.set('override_existing', '1');
      if (slotId) fd.set('service_time_slot_id', slotId);
      let result: FinalizeVendorResult;
      try {
        result = await finalizeVendor(fd);
      } catch (err) {
        setLockState({
          kind: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Something went wrong. Try again.',
        });
        return;
      }
      switch (result.status) {
        case 'ok':
        case 'already_locked':
          // Show toast immediately so it persists after the modal closes.
          setToast({
            kind: 'locked',
            vendorId: pick.vendor_id,
            vendorName: pick.vendor_name,
            undoUntil: Date.now() + TOAST_AUTO_DISMISS_MS,
          });
          // Close the modal. revalidatePath on the server action refreshes
          // the page — the card flips to the LockedCard variant on the
          // next render so the host never sees the now-stale Lock CTA.
          setOpen(false);
          setLockState({ kind: 'idle' });
          // PostHog vendor_locked event — mirrors the vendor_unlocked event
          // SwitchVendorConfirm fires (2026-05-22 owner directive). Lazy
          // import so the home-page bundle stays lean.
          try {
            const mod = await import('posthog-js');
            const client = (mod.default ?? mod) as unknown as {
              capture?: (
                event: string,
                props?: Record<string, unknown>,
              ) => void;
            };
            client.capture?.('vendor_locked', {
              event_id: eventId,
              vendor_id: pick.vendor_id,
              group_id: groupId,
              group_label: groupLabel,
              source: 'plan_card_lock_single_pick',
            });
          } catch {
            // PostHog optional — never block UX.
          }
          return;
        case 'hard_single_conflict':
          setLockState({
            kind: 'conflict',
            existingVendorId: result.existingVendorId,
            existingVendorName: result.existingVendorName,
            conflictGroupLabel: result.groupLabel,
          });
          return;
        case 'soft_hold_limit_reached':
          setLockState({
            kind: 'soft_hold_limit',
            currentLimit: result.currentLimit,
            existingHoldCount: result.existingHoldCount,
          });
          return;
        case 'slot_required': {
          // The service needs a slot pick — re-fetch the windows + open the
          // in-modal picker.
          let slots: VendorServiceTimeSlot[] = [];
          try {
            slots = await listLockTimeSlots(eventId, pick.vendor_id);
          } catch {
            slots = [];
          }
          const firstSlot = slots[0];
          if (firstSlot) {
            setLockState({
              kind: 'slot_select',
              slots,
              selectedSlotId: firstSlot.slot_id,
            });
          } else {
            setLockState({
              kind: 'error',
              message: 'Please pick a time slot to lock this vendor.',
            });
          }
          return;
        }
        case 'not_signed_in':
          setLockState({
            kind: 'error',
            message: 'Sign in again to lock this vendor.',
          });
          return;
        case 'not_found':
          setLockState({
            kind: 'error',
            message:
              "We can't find this vendor on your event. Refresh the page.",
          });
          return;
        case 'error':
          setLockState({ kind: 'error', message: result.message });
          return;
      }
    });
  };

  const performUndo = (vendorId: string) => {
    setToast({ kind: 'hidden' });
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      await revertVendorToConsidering(fd);
    });
  };

  return (
    <>
      {/* "Lock" trigger · `h-11` (44px) per CLAUDE.md 2026-05-30 owner
       *  button-height parity. Renders directly under the Search/Add
       *  row when host has exactly 1 considering pick · sits visually
       *  adjacent to PlanCardCTAs's primary CTAs, so it needs to share
       *  the same 44pt floor for the planning-card row to read as one
       *  uniform action surface. The inner-modal CTAs below already
       *  ship at `min-h-[44px]`. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
      >
        <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Lock
      </button>

      {isOpen ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-card-lock-headline"
          aria-describedby="plan-card-lock-body"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === dialogRef.current) closeModal();
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-cream p-5 shadow-xl sm:p-6">
            <button
              type="button"
              aria-label="Close"
              onClick={closeModal}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>

            <h2
              id="plan-card-lock-headline"
              className="font-display text-2xl italic tracking-tight text-ink"
            >
              Lock {pick.vendor_name} in?
            </h2>

            <div
              id="plan-card-lock-body"
              className="mt-3 space-y-3 text-sm text-ink/75"
            >
              <p>
                You&rsquo;re about to lock{' '}
                <strong className="font-medium text-ink">
                  {pick.vendor_name}
                </strong>{' '}
                for {groupLabel.toLowerCase()}. This marks them as your
                confirmed vendor and surfaces them on your day-of timeline.
              </p>
              <p className="text-ink/65">
                You can switch later if plans change — your other research
                stays on the card as considering picks.
              </p>
            </div>

            {lockState.kind === 'error' ? (
              <p
                role="alert"
                className="mt-3 rounded-md border border-danger-300/50 bg-danger-50/60 px-3 py-2 text-xs text-danger-900"
              >
                {lockState.message}
              </p>
            ) : null}

            {lockState.kind === 'conflict' ? (
              <div
                role="alertdialog"
                aria-labelledby="plan-card-lock-conflict-heading"
                aria-describedby="plan-card-lock-conflict-body"
                className="mt-3 space-y-3 rounded-lg border border-warn-300/60 bg-warn-50/70 px-3 py-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-warn-700"
                    strokeWidth={2}
                  />
                  <div className="space-y-1">
                    <h3
                      id="plan-card-lock-conflict-heading"
                      className="text-sm font-semibold text-warn-900"
                    >
                      {lockState.existingVendorName} is already locked for{' '}
                      {lockState.conflictGroupLabel.toLowerCase()}.
                    </h3>
                    <p
                      id="plan-card-lock-conflict-body"
                      className="text-xs leading-snug text-warn-900/85"
                    >
                      Only one {lockState.conflictGroupLabel.toLowerCase()} can
                      be locked at a time. Switch to{' '}
                      <strong>{pick.vendor_name}</strong> instead? Your earlier
                      pick stays on the card as a considering option.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => performLock(true, null)}
                    disabled={isPending}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-mulberry px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry disabled:opacity-60"
                  >
                    {isPending ? (
                      <>
                        <Loader2
                          aria-hidden
                          className="h-3.5 w-3.5 animate-spin"
                          strokeWidth={2}
                        />
                        Switching…
                      </>
                    ) : (
                      <>Switch to {pick.vendor_name}</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLockState({ kind: 'idle' })}
                    disabled={isPending}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-warn-400/60 bg-cream px-3 py-2 text-sm font-medium text-warn-900 transition-colors hover:bg-warn-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn-600 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {lockState.kind === 'soft_hold_limit' ? (
              <div
                role="alertdialog"
                aria-labelledby="plan-card-lock-soft-hold-heading"
                aria-describedby="plan-card-lock-soft-hold-body"
                className="mt-3 space-y-3 rounded-lg border border-warn-300/60 bg-warn-50/70 px-3 py-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-warn-700"
                    strokeWidth={2}
                  />
                  <div className="space-y-1">
                    <h3
                      id="plan-card-lock-soft-hold-heading"
                      className="text-sm font-semibold text-warn-900"
                    >
                      {pick.vendor_name} is fully booked with soft holds for
                      your date.
                    </h3>
                    <p
                      id="plan-card-lock-soft-hold-body"
                      className="text-xs leading-snug text-warn-900/85"
                    >
                      {pick.vendor_name} already has{' '}
                      {lockState.existingHoldCount} confirmed soft holds for
                      your wedding date. They only accept{' '}
                      {lockState.currentLimit} simultaneous holds at a time.
                      Try a different vendor or come back later — they&rsquo;ll
                      free up if another couple doesn&rsquo;t downpay.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={resolveBrowseSimilarHref(groupId)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-mulberry px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
                  >
                    Browse similar vendors
                  </Link>
                  <button
                    type="button"
                    onClick={() => setLockState({ kind: 'idle' })}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-warn-400/60 bg-cream px-3 py-2 text-sm font-medium text-warn-900 transition-colors hover:bg-warn-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}

            {/* Tier #3 — couple picks the time window (owner 2026-06-09). */}
            {lockState.kind === 'slot_select' ? (
              <div className="mt-4 space-y-3 rounded-lg border border-terracotta/30 bg-terracotta/[0.04] px-3 py-3">
                <div className="flex items-start gap-2">
                  <Clock
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                    strokeWidth={2}
                  />
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-ink">
                      Pick a time slot
                    </h3>
                    <p className="text-xs leading-snug text-ink/65">
                      {pick.vendor_name} runs more than one window on your date —
                      choose the one you&rsquo;re booking.
                    </p>
                  </div>
                </div>
                <select
                  value={lockState.selectedSlotId}
                  onChange={(e) =>
                    setLockState({ ...lockState, selectedSlotId: e.target.value })
                  }
                  className="input-field cursor-pointer"
                >
                  {lockState.slots.map((slot) => (
                    <option key={slot.slot_id} value={slot.slot_id}>
                      {slotOptionLabel(slot)}
                    </option>
                  ))}
                </select>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isPending}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => performLock(false, lockState.selectedSlotId)}
                    disabled={isPending || !lockState.selectedSlotId}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry disabled:opacity-60"
                  >
                    {isPending ? (
                      <>
                        <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                        Locking…
                      </>
                    ) : (
                      <>
                        <BookmarkCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
                        Lock this slot
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {lockState.kind !== 'conflict' &&
            lockState.kind !== 'soft_hold_limit' &&
            lockState.kind !== 'slot_select' ? (
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => requestLock()}
                  disabled={isPending}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <Loader2
                        aria-hidden
                        className="h-4 w-4 animate-spin"
                        strokeWidth={2}
                      />
                      Locking…
                    </>
                  ) : (
                    <>
                      <BookmarkCheck
                        aria-hidden
                        className="h-4 w-4"
                        strokeWidth={2}
                      />
                      Yes, lock {pick.vendor_name}
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Undo toast — outlives the modal so a host who clicks Lock then
          immediately rethinks can roll back without re-opening the dialog.
          Mirrors the PlanCardCompare toast UX for consistency. */}
      {toast.kind === 'locked' ? (
        <UndoToast
          vendorName={toast.vendorName}
          onUndo={() => performUndo(toast.vendorId)}
          onDismiss={() => setToast({ kind: 'hidden' })}
        />
      ) : null}
    </>
  );
}

/**
 * PR A · Resolve the "Browse similar vendors" deep-link from a PlanGroupId
 * for the soft-hold-limit modal. Same shape as plan-card-compare.tsx —
 * reads PLAN_GROUPS → catalogFolder → WEDDING_FOLDER_SLUG → /vendors URL.
 * Falls back to /vendors if the group isn't found (defensive). Doesn't use
 * `from=plan` because the host benefits from the full marketplace filter
 * UI when shopping for an alternative.
 */
function resolveBrowseSimilarHref(groupId: PlanGroupId): string {
  const group = PLAN_GROUPS.find((g) => g.id === groupId);
  if (!group) return '/explore';
  const slug = WEDDING_FOLDER_SLUG[group.catalogFolder];
  return `/explore?folder=${slug}#${slug}`;
}

function UndoToast({
  vendorName,
  onUndo,
  onDismiss,
}: {
  vendorName: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-success-300/60 bg-cream px-4 py-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <BookmarkCheck
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-success-700"
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-ink">
            {vendorName} is locked in.
          </p>
          <p className="text-[11px] text-ink/60">
            Changed your mind?{' '}
            <button
              type="button"
              onClick={onUndo}
              className="font-medium text-terracotta underline underline-offset-2 hover:text-terracotta/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Undo · revert to considering
            </button>
          </p>
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
    </div>
  );
}
