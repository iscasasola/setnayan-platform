'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AlertTriangle, BookmarkCheck, Clock, Loader2, RotateCcw, X } from 'lucide-react';
import { PLAN_GROUPS, type PlanGroupId } from '@/lib/wedding-plan-groups';
import { WEDDING_FOLDER_SLUG } from '@/lib/taxonomy';
import { haptic } from '@/lib/haptics';
import {
  finalizeVendor,
  listLockTimeSlots,
  revertVendorToConsidering,
  type FinalizeVendorResult,
} from '../actions';
import {
  slotOptionLabel,
  type VendorServiceTimeSlot,
} from '@/lib/vendor-time-slots';

/**
 * AccordionLockButton + ChangePickButton — the Plan + Budget card's lock /
 * unlock controls (couple Vendors tab).
 *
 * WHY this exists (the bug it fixes): the accordion's "Lock this pick" button
 * used to post `updateVendorStatus(status=contracted)` — a dumb status flip
 * that bypassed every guard the canonical lock path runs. This wires the same
 * `finalizeVendor` the rest of the dashboard uses (plan-card-lock.tsx,
 * plan-card-compare.tsx): the hard-single conflict gate (one venue/officiant/
 * coordinator/host/LED at a time), the soft-hold gate (vendor's
 * max_soft_holds_per_date), auto-archive of the losing shortlist, the
 * auto-cascade into the vendor's other services, and the claim-invite for
 * off-platform picks. ChangePickButton wires `revertVendorToConsidering`
 * (which the accordion previously had no path to — a locked card had no unlock).
 *
 * VISUAL: renders the accordion's own `.lockbtn` (mulberry full-width) — NOT
 * PlanCardLock's `h-11` cream button — so the prototype card visual is intact.
 * One-tap happy path (matches the prototype's one-tap lock); only the conflict
 * / soft-hold EXCEPTIONS open a modal.
 *
 * PORTAL: the exception modals + the undo toast are `position:fixed`, and this
 * button lives inside a `.card` that carries the coverflow `transform`
 * (which makes `fixed` resolve against the card, not the viewport). They're
 * `createPortal`'d to `document.body` to escape it — the same reason
 * CompareSheet is lifted to the accordion root.
 */

const TOAST_AUTO_DISMISS_MS = 5_000;

type LockState =
  | { kind: 'idle' }
  | {
      kind: 'conflict';
      existingVendorName: string;
      conflictGroupLabel: string;
    }
  | {
      kind: 'soft_hold';
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
  | { kind: 'locked'; undoUntil: number };

export function AccordionLockButton({
  eventId,
  groupId,
  groupLabel,
  vendorId,
  vendorName,
  label = 'Lock this pick',
  pendingLabel = 'Locking…',
  className = 'lockbtn',
  wrapperClassName = 'lockbar',
}: {
  eventId: string;
  groupId: PlanGroupId;
  groupLabel: string;
  vendorId: string;
  vendorName: string;
  /** CTA copy. Defaults to the Shortlist card's "Lock this pick"; the Lock tab
   *  passes "Lock to confirm". */
  label?: string;
  pendingLabel?: string;
  /** Button class — defaults to the accordion-scoped `.lockbtn`; the Lock tab
   *  passes a Tailwind class (outside the accordion's scoped CSS). */
  className?: string;
  wrapperClassName?: string;
}) {
  const [state, setState] = useState<LockState>({ kind: 'idle' });
  const [toast, setToast] = useState<ToastState>({ kind: 'hidden' });
  const [isPending, startTransition] = useTransition();
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-dismiss the undo toast.
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

  // Escape closes an open exception / picker modal.
  useEffect(() => {
    if (
      state.kind !== 'conflict' &&
      state.kind !== 'soft_hold' &&
      state.kind !== 'slot_select'
    )
      return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState({ kind: 'idle' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.kind]);

  // First tap: if the booked service has time slots, open the picker; else
  // proceed straight to the one-tap lock. Keeps the happy path one-tap for the
  // vast majority of vendors (no slots → no extra round-trip in the UI flow).
  const requestLock = () => {
    startTransition(async () => {
      let slots: VendorServiceTimeSlot[] = [];
      try {
        slots = await listLockTimeSlots(eventId, vendorId);
      } catch {
        // Degrade open — a slot-fetch hiccup must not block locking. The
        // server still enforces (returns 'slot_required' if a pick is needed).
        slots = [];
      }
      const firstSlot = slots[0];
      if (firstSlot) {
        setState({ kind: 'slot_select', slots, selectedSlotId: firstSlot.slot_id });
        return;
      }
      performLock(false, null);
    });
  };

  const performLock = (override: boolean, slotId: string | null) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      if (override) fd.set('override_existing', '1');
      if (slotId) fd.set('service_time_slot_id', slotId);
      let result: FinalizeVendorResult;
      try {
        result = await finalizeVendor(fd);
      } catch (err) {
        setState({
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
        });
        return;
      }
      switch (result.status) {
        case 'ok':
        case 'already_locked':
          haptic('confirm');
          setState({ kind: 'idle' });
          // Undo toast outlives the (now revalidated) card flip.
          setToast({ kind: 'locked', undoUntil: Date.now() + TOAST_AUTO_DISMISS_MS });
          try {
            const mod = await import('posthog-js');
            const client = (mod.default ?? mod) as unknown as {
              capture?: (e: string, p?: Record<string, unknown>) => void;
            };
            client.capture?.('vendor_locked', {
              event_id: eventId,
              vendor_id: vendorId,
              group_id: groupId,
              group_label: groupLabel,
              source: 'plan_budget_accordion',
            });
          } catch {
            // PostHog optional — never block UX.
          }
          return;
        case 'hard_single_conflict':
          setState({
            kind: 'conflict',
            existingVendorName: result.existingVendorName,
            conflictGroupLabel: result.groupLabel,
          });
          return;
        case 'soft_hold_limit_reached':
          setState({
            kind: 'soft_hold',
            currentLimit: result.currentLimit,
            existingHoldCount: result.existingHoldCount,
          });
          return;
        case 'slot_required': {
          // The service needs a slot pick (couple skipped it or the chosen one
          // expired). Re-fetch the windows and open the picker.
          let slots: VendorServiceTimeSlot[] = [];
          try {
            slots = await listLockTimeSlots(eventId, vendorId);
          } catch {
            slots = [];
          }
          const firstSlot = slots[0];
          if (firstSlot) {
            setState({
              kind: 'slot_select',
              slots,
              selectedSlotId: firstSlot.slot_id,
            });
          } else {
            setState({
              kind: 'error',
              message: 'Please pick a time slot to lock this vendor.',
            });
          }
          return;
        }
        case 'not_signed_in':
          setState({ kind: 'error', message: 'Sign in again to lock this vendor.' });
          return;
        case 'not_found':
          setState({
            kind: 'error',
            message: "We can't find this vendor on your event. Refresh the page.",
          });
          return;
        case 'error':
          setState({ kind: 'error', message: result.message });
          return;
      }
    });
  };

  const performUndo = () => {
    setToast({ kind: 'hidden' });
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      await revertVendorToConsidering(fd);
    });
  };

  return (
    <div className={wrapperClassName}>
      <button
        type="button"
        className={className}
        disabled={isPending}
        onClick={() => {
          haptic('confirm');
          requestLock();
        }}
      >
        {isPending && state.kind === 'idle' ? pendingLabel : label}
      </button>

      {state.kind === 'error' ? (
        <p
          role="alert"
          className="mt-2 rounded-md border border-danger-300/50 bg-danger-50/60 px-3 py-2 text-[11px] text-danger-900"
        >
          {state.message}
        </p>
      ) : null}

      {/* Exception modals + undo toast portal to <body> so `position:fixed`
          escapes the coverflow transform on the parent .card. */}
      {(state.kind === 'conflict' || state.kind === 'soft_hold') &&
        portal(
          <ExceptionModal
            state={state}
            vendorName={vendorName}
            groupId={groupId}
            isPending={isPending}
            onSwitch={() => performLock(true, null)}
            onDismiss={() => setState({ kind: 'idle' })}
          />,
        )}

      {/* Tier #3 — couple picks the time window before the lock proceeds. */}
      {state.kind === 'slot_select' &&
        portal(
          <SlotPickerModal
            vendorName={vendorName}
            slots={state.slots}
            selectedSlotId={state.selectedSlotId}
            isPending={isPending}
            onSelect={(slotId) =>
              setState({ ...state, selectedSlotId: slotId })
            }
            onConfirm={() => performLock(false, state.selectedSlotId)}
            onDismiss={() => setState({ kind: 'idle' })}
          />,
        )}

      {toast.kind === 'locked' &&
        portal(
          <UndoToast
            vendorName={vendorName}
            onUndo={performUndo}
            onDismiss={() => setToast({ kind: 'hidden' })}
          />,
        )}
    </div>
  );
}

/** "↩ Change pick" on a locked card — reverts to considering (re-expands the
 *  rail on the next render). Subtle mulberry-outline pill in the .lockbar slot. */
export function ChangePickButton({
  eventId,
  vendorId,
}: {
  eventId: string;
  vendorId: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="lockbar">
      <button
        type="button"
        className="changebtn"
        disabled={isPending}
        onClick={() => {
          haptic('tick');
          startTransition(async () => {
            const fd = new FormData();
            fd.set('event_id', eventId);
            fd.set('vendor_id', vendorId);
            await revertVendorToConsidering(fd);
          });
        }}
      >
        <RotateCcw aria-hidden className="mr-1 inline h-3 w-3" strokeWidth={2} />
        {isPending ? 'Reopening…' : 'Change pick'}
      </button>
    </div>
  );
}

function portal(node: React.ReactNode): React.ReactNode {
  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}

function ExceptionModal({
  state,
  vendorName,
  groupId,
  isPending,
  onSwitch,
  onDismiss,
}: {
  state: Extract<LockState, { kind: 'conflict' | 'soft_hold' }>;
  vendorName: string;
  groupId: PlanGroupId;
  isPending: boolean;
  onSwitch: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-warn-300/60 bg-cream p-5 shadow-xl sm:p-6">
        <button
          type="button"
          aria-label="Close"
          onClick={onDismiss}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="flex items-start gap-2.5">
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-warn-700"
            strokeWidth={2}
          />
          {state.kind === 'conflict' ? (
            <div className="space-y-1.5 pr-6">
              <h3 className="text-sm font-semibold text-warn-900">
                {state.existingVendorName} is already locked for{' '}
                {state.conflictGroupLabel.toLowerCase()}.
              </h3>
              <p className="text-xs leading-snug text-warn-900/85">
                Only one {state.conflictGroupLabel.toLowerCase()} can be locked
                at a time. Switch to <strong>{vendorName}</strong> instead? Your
                earlier pick stays on the card as a considering option.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 pr-6">
              <h3 className="text-sm font-semibold text-warn-900">
                {vendorName} is fully booked with soft holds for your date.
              </h3>
              <p className="text-xs leading-snug text-warn-900/85">
                {vendorName} already has {state.existingHoldCount} confirmed soft
                holds for your wedding date. They only accept {state.currentLimit}{' '}
                at a time. Try a different vendor or come back later — they&rsquo;ll
                free up if another couple doesn&rsquo;t downpay.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {state.kind === 'conflict' ? (
            <button
              type="button"
              onClick={onSwitch}
              disabled={isPending}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-mulberry px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  Switching…
                </>
              ) : (
                <>Switch to {vendorName}</>
              )}
            </button>
          ) : (
            <Link
              href={resolveBrowseSimilarHref(groupId)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-mulberry px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
            >
              Browse similar vendors
            </Link>
          )}
          <button
            type="button"
            onClick={onDismiss}
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-warn-400/60 bg-cream px-3 py-2 text-sm font-medium text-warn-900 transition-colors hover:bg-warn-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn-600 disabled:opacity-60"
          >
            {state.kind === 'conflict' ? 'Cancel' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tier #3 couple slot picker — the couple chooses the vendor's time window
 *  (owner 2026-06-09) before the lock proceeds. Renders only when the booked
 *  service has >=1 active slot. */
function SlotPickerModal({
  vendorName,
  slots,
  selectedSlotId,
  isPending,
  onSelect,
  onConfirm,
  onDismiss,
}: {
  vendorName: string;
  slots: VendorServiceTimeSlot[];
  selectedSlotId: string;
  isPending: boolean;
  onSelect: (slotId: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pick a time slot for ${vendorName}`}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-cream p-5 shadow-xl sm:p-6">
        <button
          type="button"
          aria-label="Close"
          onClick={onDismiss}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="flex items-start gap-2.5 pr-6">
          <Clock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={2} />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink">
              Pick a time slot for {vendorName}
            </h3>
            <p className="text-xs leading-snug text-ink/65">
              This vendor runs more than one window on your date. Choose the one
              you&rsquo;re booking.
            </p>
          </div>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="block text-xs font-medium text-ink/70">Time slot</span>
          <select
            value={selectedSlotId}
            onChange={(e) => onSelect(e.target.value)}
            className="input-field cursor-pointer"
          >
            {slots.map((slot) => (
              <option key={slot.slot_id} value={slot.slot_id}>
                {slotOptionLabel(slot)}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !selectedSlotId}
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
    </div>
  );
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
      className="fixed bottom-4 left-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-success-300/60 bg-cream px-4 py-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <BookmarkCheck
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-success-700"
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-ink">{vendorName} is locked in.</p>
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

/** /vendors deep-link for the soft-hold "Browse similar vendors" CTA. Mirrors
 *  plan-card-lock.tsx — PLAN_GROUPS → catalogFolder → WEDDING_FOLDER_SLUG. */
function resolveBrowseSimilarHref(groupId: PlanGroupId): string {
  const group = PLAN_GROUPS.find((g) => g.id === groupId);
  if (!group) return '/explore';
  const slug = WEDDING_FOLDER_SLUG[group.catalogFolder];
  return `/explore?folder=${slug}#${slug}`;
}
