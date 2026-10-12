'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeftRight,
  BookmarkCheck,
  Clock,
  CreditCard,
  RotateCcw,
  Search,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PolicySnapshot } from '@/lib/vendor-service-payment-schedules';
import { PLAN_GROUPS, type PlanGroupId } from '@/lib/wedding-plan-groups';
import { WEDDING_FOLDER_SLUG } from '@/lib/taxonomy';
import { haptic } from '@/lib/haptics';
import { useSaveLoader } from '@/components/sd-loader';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import {
  finalizeVendor,
  listLockTimeSlots,
  revertVendorToConsidering,
  type FinalizeVendorResult,
  type LockMilestone,
} from '../actions';
import {
  slotOptionLabel,
  type VendorServiceTimeSlot,
} from '@/lib/vendor-time-slots';
import { LOCK_PENDING_ICON, LockConfirmModal, LockMilestoneToast, LockPopup } from './lock-milestone';
import type { LockImpact } from '@/lib/lock-impact';
import { isExploreReplanEnabled } from '@/lib/explore-replan-flag';
import { isHardSinglePickGroup } from '@/lib/wedding-plan-groups';
import { markCategoryComplete } from '../category-decision-actions';
import { formatCount } from '@/lib/format-number';
import { analyticsAllowed } from '@/lib/cookie-consent';

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
 * CompareSheet is lifted to the accordion root. Since the 2026-10-12 look sweep
 * every pop-up here is the shared `LockPopup` frame (lock-milestone.tsx), which
 * portals itself, and the toast is the shared `PeekToast` from the top, which
 * leaves by itself — so this file keeps no timer of its own for it.
 */

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
  // Locking this vendor narrows the couple's candidate dates to one — confirm
  // that the lock also finalizes the wedding date. Carries the override/slot
  // context so the confirmed re-call preserves any prior switch/slot choice.
  | {
      kind: 'date_confirm';
      dateLabel: string;
      /** What ELSE this lock closes — rendered in the SAME confirm (owner
       *  2026-09-06), never as a second modal stacked behind this one. */
      impact: LockImpact | null;
      override: boolean;
      slotId: string | null;
    }
  // Owner 2026-09-06: this lock kills saved plans and/or sinks bench vendors,
  // but does NOT set the date. Same modal, impact half only. Carries the
  // override/slot context so the confirmed re-call preserves any prior choice.
  | {
      kind: 'impact_confirm';
      impact: LockImpact;
      override: boolean;
      slotId: string | null;
    }
  // No-Show Downpayment Protection — the booked downpayment carries protected
  // reservation terms; the couple must acknowledge them before the lock commits.
  // Carries the override/slot/date context so the acknowledged re-call preserves
  // any prior choice.
  | {
      kind: 'reservation_terms';
      policy: PolicySnapshot;
      override: boolean;
      slotId: string | null;
      confirmDateLock: boolean;
    }
  // Payment-gated lock — HARD server gate (NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED).
  // finalizeVendor returned 'downpayment_required' BEFORE committing: every other
  // gate passed, but this marketplace vendor requires the downpayment first.
  // Carries the vendor's published methods + the accumulated lock context, so the
  // modal's submit re-calls finalizeVendor with the downpayment AND that context —
  // which commits the lock. Cancel commits nothing (the gate returned pre-commit).
  | {
      kind: 'downpayment';
      methods: CoupleFacingMethod[];
      /** The accepted quote's on-lock first payment — prefilled, and the least the lock takes. */
      minimumAmountPhp: number | null;
      override: boolean;
      slotId: string | null;
      confirmDateLock: boolean;
      acknowledgeReservationTerms: boolean;
    }
  | { kind: 'error'; message: string }
  // PR-H · the press was an ASK (handshake on, marketplace supplier): nothing
  // is booked, the supplier has 48 hours to agree. Until 2026-09-19 this
  // result fell through the switch with no case, so the button sat idle and
  // looked exactly like a press that did nothing — tolerable only on the
  // bench, whose own revalidation swaps Lock for Withdraw. In the chat card
  // (the second mount) nothing revalidated, so the ask was invisible.
  | { kind: 'requested'; vendorName: string }
  // Coordinator proposed the lock (spec § 4) — the couple confirms it.
  | { kind: 'proposed'; vendorName: string };

type ToastState =
  | { kind: 'hidden' }
  | {
      kind: 'locked';
      milestone: LockMilestone;
      /** Explore Replan slice A: multi-pick lock → the toast asks "done with
       *  this service, or add another?" (flag-gated at the set site). */
      askDone?: boolean;
    };

/** What the downpayment modal hands back to performLock to commit the lock. */
type DownpaymentSubmission = {
  methodId: string;
  amountPhp: string;
  reference: string | null;
  proof: File | null;
};

export function AccordionLockButton({
  eventId,
  groupId,
  groupLabel,
  vendorId,
  vendorName,
  label = 'Book this pick',
  pendingLabel = 'Booking…',
  icon,
  className = 'lockbtn',
  wrapperClassName = 'lockbar',
  isVerified,
  source = 'plan_budget_accordion',
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
  /** Drawn before the word — a caller that wears the button rule's pill. */
  icon?: ReactNode;
  /** Button class — defaults to the accordion-scoped `.lockbtn`; the Lock tab
   *  passes a Tailwind class (outside the accordion's scoped CSS). */
  className?: string;
  wrapperClassName?: string;
  /**
   * Marketplace-vendor verification state (owner 2026-07-24 booking gate).
   * `undefined` = off-platform / not-yet-enriched → no indicator, lock proceeds
   * (server + DB still enforce). `false` = a marketplace vendor still verifying:
   * shows a "Verifying" pill and the tap surfaces the friendly block WITHOUT a
   * round-trip. `true` = verified → normal lock. This is a UX nicety only; the
   * server gate + DB trigger are the real enforcement.
   */
  isVerified?: boolean;
  /** Analytics only — which room the press came from. */
  source?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<LockState>({ kind: 'idle' });
  const [toast, setToast] = useState<ToastState>({ kind: 'hidden' });
  const [isPending, startTransition] = useTransition();
  const mountedRef = useRef(false);
  // ⚠ A REF, NOT A THREADED FLAG, AND THAT IS THE POINT (owner 2026-09-06).
  // Once the couple has read what this lock closes and pressed "lock anyway",
  // that consent must survive EVERY later gate — reservation terms, the
  // downpayment picker, a slot re-pick — each of which re-enters performLock.
  // `confirmDateLock` is threaded through those states one field at a time, so
  // a gate added later that forgets to carry it silently re-opens a modal the
  // couple already answered. A ref cannot be dropped by a gate that does not
  // know about it. Scoped per button, i.e. per vendor, so it never leaks to
  // another card; a dismiss leaves it false, so "Not yet" really means not yet.
  const impactConfirmedRef = useRef(false);
  const save = useSaveLoader();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // No auto-dismiss timer here: the plain result is a `PeekToast`, which leaves
  // by itself and calls `onDismiss`; a toast that asks a question (done or add
  // another?) or offers a next step is a pop-up that waits for its answer.

  // First tap: if the booked service has time slots, open the picker; else
  // proceed straight to the one-tap lock. Keeps the happy path one-tap for the
  // vast majority of vendors (no slots → no extra round-trip in the UI flow).
  const requestLock = () => {
    // Booking-requires-verified gate (owner 2026-07-24) — fast client-side
    // short-circuit when we already know this marketplace vendor is unverified,
    // so the couple gets the explanation without a round-trip. `undefined`
    // (off-platform / not-yet-enriched) still goes to the server, which is the
    // authority (+ the DB trigger).
    if (isVerified === false) {
      setState({
        kind: 'error',
        message:
          "This supplier is completing verification and can't be booked just yet. Keep them shortlisted — you'll be able to book them once they're verified.",
      });
      return;
    }
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
      performLock(false, null, false);
    });
  };

  const performLock = (
    override: boolean,
    slotId: string | null,
    confirmDateLock: boolean,
    acknowledgeReservationTerms = false,
    downpayment: DownpaymentSubmission | null = null,
  ) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      if (override) fd.set('override_existing', '1');
      if (slotId) fd.set('service_time_slot_id', slotId);
      if (confirmDateLock) fd.set('confirm_date_lock', '1');
      if (impactConfirmedRef.current) fd.set('confirm_lock_impact', '1');
      if (acknowledgeReservationTerms) fd.set('acknowledge_reservation_terms', '1');
      // Payment-gated lock (HARD gate): the downpayment submitted from the modal
      // rides on THIS finalize call, which validates it pre-commit then commits +
      // records it. Absent on the first attempt → the server returns
      // 'downpayment_required' and we open the modal.
      if (downpayment) {
        fd.set('deposit_method_id', downpayment.methodId);
        fd.set('deposit_php', downpayment.amountPhp);
        if (downpayment.reference) fd.set('reference', downpayment.reference);
        if (downpayment.proof) fd.set('proof', downpayment.proof);
      }
      let result: FinalizeVendorResult;
      try {
        result = await save.run(() => finalizeVendor(fd), {
          steps: ['Booking your supplier'],
          hint: 'Saving',
        });
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
        case 'already_locked': {
          haptic('confirm');
          const lockedMilestone: LockMilestone =
            result.status === 'ok'
              ? result.milestone
              : { pickedLabel: vendorName, dateLocked: false, finalizeReady: null };
          setState({ kind: 'idle' });
          // finalizeVendor revalidates the Vendors page only; a mount in any
          // other room (the chat quote card) must re-read its own server
          // props or it keeps offering a Lock that has already happened.
          router.refresh();
          // Congrats + undo toast outlives the (now revalidated) card flip.
          setToast({
            kind: 'locked',
            milestone: lockedMilestone,
            // Multi-pick categories: one lock is the floor, not the ceiling —
            // ask "done with this service, or add another?" (owner 2026-07-27).
            askDone: isExploreReplanEnabled() && !isHardSinglePickGroup(groupId),
          });
          // No yes, no analytics — and no SDK download either (`lib/cookie-consent.ts`).
          if (analyticsAllowed()) {
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
                source,
              });
            } catch {
              // PostHog optional — never block UX.
            }
          }
          return;
        }
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
              message: 'Please pick a time slot to book this supplier.',
            });
          }
          return;
        }
        case 'date_will_lock':
          // Locking narrows the couple's candidates to one date — confirm the
          // date lock, preserving the override/slot context of this attempt.
          // The server folds in what ELSE this lock closes so both facts land
          // in one dialog (owner 2026-09-06); null when it closes nothing.
          setState({
            kind: 'date_confirm',
            dateLabel: result.dateLabel,
            impact: result.impact,
            override,
            slotId,
          });
          return;
        case 'lock_will_cost':
          // This lock kills saved plans and/or sinks bench vendors without
          // setting the date. Same modal, impact half only. The server only
          // ever sends this with a NON-EMPTY impact.
          setState({
            kind: 'impact_confirm',
            impact: result.impact,
            override,
            slotId,
          });
          return;
        case 'reservation_terms_required':
          // The booked downpayment carries protected reservation terms — surface
          // the acknowledgement gate. The re-call preserves the override/slot/
          // date context so the couple doesn't re-answer those.
          setState({
            kind: 'reservation_terms',
            policy: result.policy,
            override,
            slotId,
            confirmDateLock,
          });
          return;
        case 'downpayment_required':
          // HARD payment gate — every other gate passed but the lock hasn't
          // committed. Open the downpayment picker with the vendor's published
          // methods; its submit re-calls performLock WITH the downpayment + the
          // preserved context, which commits the lock. Cancel commits nothing.
          setState({
            kind: 'downpayment',
            methods: result.methods,
            minimumAmountPhp: result.minimumAmountPhp ?? null,
            override,
            slotId,
            confirmDateLock,
            acknowledgeReservationTerms,
          });
          return;
        case 'vendor_not_verified':
          // Booking-requires-verified gate (owner 2026-07-24). The vendor is
          // still going through verification — keep them shortlisted; the lock
          // reopens once verified.
          setState({
            kind: 'error',
            message:
              "This supplier is completing verification and can't be booked just yet. Keep them shortlisted — you'll be able to book them once they're verified.",
          });
          return;
        case 'not_signed_in':
          setState({ kind: 'error', message: 'Sign in again to book this supplier.' });
          return;
        case 'not_secured':
          // A guest (anonymous) session cannot book. Like 'lock_requested', this
          // had no case and rendered as nothing; found by the \`never\` below.
          setState({
            kind: 'error',
            message: 'Save your account first to book this supplier.',
          });
          return;
        case 'not_found':
          setState({
            kind: 'error',
            message: "We can't find this supplier on your event. Refresh the page.",
          });
          return;
        case 'error':
          setState({ kind: 'error', message: result.message });
          return;
        case 'proposed':
          // Coordinator can't lock directly (money-adjacent) — a proposal was
          // recorded for the couple to confirm (spec § 4).
          setState({ kind: 'proposed', vendorName: result.vendorName });
          return;
        case 'lock_requested':
          // The ask is recorded. Say so on the button, and re-read the page so
          // every surface built from the row (the bench's Withdraw, the chat
          // card's "you have asked them to lock") catches up.
          haptic('confirm');
          setState({ kind: 'requested', vendorName: result.vendorName });
          router.refresh();
          return;
        default: {
          // 🔴 A RESULT THIS SWITCH DOES NOT NAME MUST NEVER RENDER AS NOTHING.
          // 'lock_requested' did exactly that for its whole life. The `never`
          // makes a new status a compile error here; the message covers a
          // server that is newer than this bundle.
          const unhandled: never = result;
          setState({
            kind: 'error',
            message: `We couldn't confirm the booking (${
              (unhandled as { status?: string }).status ?? 'unknown'
            }). Refresh the page to see where it stands.`,
          });
          return;
        }
      }
    });
  };

  const performUndo = () => {
    setToast({ kind: 'hidden' });
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      await save.run(() => revertVendorToConsidering(fd), {
        steps: ['Reverting your pick'],
        hint: 'Saving',
      });
    });
  };

  if (state.kind === 'requested') {
    return (
      <div className={wrapperClassName}>
        <p role="status" className="text-[12px] text-ink/70">
          Booking requested — waiting for {state.vendorName} to agree.
        </p>
      </div>
    );
  }

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
        {icon}
        <span className="lbl">{isPending && state.kind === 'idle' ? pendingLabel : label}</span>
      </button>

      {/* Booking-requires-verified indicator (owner 2026-07-24) — surfaces the
          block BEFORE the tap so it isn't a surprise. Shown only for a known-
          unverified marketplace vendor. */}
      {isVerified === false ? (
        <p
          role="status"
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--color-warn))]"
        >
          <Clock aria-hidden className="h-3 w-3" strokeWidth={2} />
          Verifying — can&apos;t book yet
        </p>
      ) : null}

      {state.kind === 'error' ? (
        <p role="alert" className="mt-2 text-[12px] text-[rgb(var(--color-danger))]">
          {state.message}
        </p>
      ) : null}

      {state.kind === 'proposed' ? (
        <p role="status" className="mt-2 text-[12px] text-ink/70">
          Proposed to the couple — {state.vendorName} will book once they confirm.
        </p>
      ) : null}

      {/* Every pop-up below is the shared LockPopup, which draws on <body> so
          `position:fixed` escapes the coverflow transform on the parent .card. */}
      {(state.kind === 'conflict' || state.kind === 'soft_hold') ? (
        <ExceptionModal
          state={state}
          vendorName={vendorName}
          groupId={groupId}
          isPending={isPending}
          onSwitch={() => performLock(true, null, false)}
          onDismiss={() => setState({ kind: 'idle' })}
        />
      ) : null}

      {/* Tier #3 — couple picks the time window before the lock proceeds. */}
      {state.kind === 'slot_select' ? (
        <SlotPickerModal
          vendorName={vendorName}
          slots={state.slots}
          selectedSlotId={state.selectedSlotId}
          isPending={isPending}
          onSelect={(slotId) =>
            setState({ ...state, selectedSlotId: slotId })
          }
          onConfirm={() => performLock(false, state.selectedSlotId, false)}
          onDismiss={() => setState({ kind: 'idle' })}
        />
      ) : null}

      {/* Pre-lock confirmation — this lock finalizes the date, and/or closes
          saved plans + sinks bench vendors. ONE modal for both (owner
          2026-09-06); it is never opened for a lock that costs nothing. */}
      {state.kind === 'date_confirm' ? (
        <LockConfirmModal
          vendorName={vendorName}
          dateLabel={state.dateLabel}
          impact={state.impact}
          isPending={isPending}
          onConfirm={() => {
            impactConfirmedRef.current = true;
            performLock(state.override, state.slotId, true);
          }}
          onDismiss={() => setState({ kind: 'idle' })}
        />
      ) : null}

      {state.kind === 'impact_confirm' ? (
        <LockConfirmModal
          vendorName={vendorName}
          dateLabel={null}
          impact={state.impact}
          isPending={isPending}
          onConfirm={() => {
            impactConfirmedRef.current = true;
            performLock(state.override, state.slotId, false);
          }}
          onDismiss={() => setState({ kind: 'idle' })}
        />
      ) : null}

      {/* Reservation terms — couple acknowledges the no-show downpayment policy
          before the lock commits. */}
      {state.kind === 'reservation_terms' ? (
        <ReservationTermsModal
          vendorName={vendorName}
          policy={state.policy}
          isPending={isPending}
          onAcknowledge={() =>
            performLock(state.override, state.slotId, state.confirmDateLock, true)
          }
          onDismiss={() => setState({ kind: 'idle' })}
        />
      ) : null}

      {/* Payment-gated lock (HARD gate) — the lock has NOT committed. Collect the
          downpayment through the vendor's published method + a required
          screenshot; the modal re-calls finalizeVendor WITH the downpayment + the
          preserved context, which commits the lock. Cancel commits nothing. */}
      {state.kind === 'downpayment' ? (
        <DownpaymentModal
          vendorName={vendorName}
          methods={state.methods}
          minimumAmountPhp={state.minimumAmountPhp}
          isPending={isPending}
          onSubmit={(dp) =>
            performLock(
              state.override,
              state.slotId,
              state.confirmDateLock,
              state.acknowledgeReservationTerms,
              dp,
            )
          }
          onCancel={() => setState({ kind: 'idle' })}
        />
      ) : null}

      {toast.kind === 'locked' ? (
        <LockMilestoneToast
          milestone={toast.milestone}
          onUndo={performUndo}
          onDismiss={() => setToast({ kind: 'hidden' })}
          askDone={toast.askDone ?? false}
          groupLabel={groupLabel}
          onDone={() => {
            // "✓ I'm done" → persist decision='complete'; the bench collapses
            // this category to "✓ Covered — reopen" on the revalidated render.
            setToast({ kind: 'hidden' });
            startTransition(async () => {
              await markCategoryComplete({ eventId, planGroupId: groupId });
            });
          }}
          onAddAnother={() => setToast({ kind: 'hidden' })}
        />
      ) : null}
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
  const save = useSaveLoader();
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
            await save.run(() => revertVendorToConsidering(fd), {
              steps: ['Reverting your pick'],
              hint: 'Saving',
            });
          });
        }}
      >
        <RotateCcw aria-hidden className="mr-1 inline h-3 w-3" strokeWidth={2} />
        {isPending ? 'Reopening…' : 'Change pick'}
      </button>
    </div>
  );
}

/** One-line human detail for a published method in the downpayment picker. */
function methodDetail(m: CoupleFacingMethod): string {
  if (m.method_type === 'bank') {
    const bits = [m.provider, m.account_name, m.account_number].filter(Boolean);
    return bits.join(' · ') || 'Bank transfer';
  }
  if (m.method_type === 'qr') {
    return m.decoded_destination || m.provider || 'Scan-to-pay QR';
  }
  return m.link_domain || m.link_url || 'Payment link';
}

/**
 * DownpaymentModal — payment-gated lock HARD gate.
 *
 * Opens on 'downpayment_required' — BEFORE the lock commits. The couple picks the
 * vendor's PUBLISHED method they paid through + attaches a REQUIRED screenshot;
 * submit hands the downpayment back to performLock, which re-calls finalizeVendor
 * to commit the lock AND record the payment atomically. Cancel commits NOTHING
 * (the gate returned pre-commit — there is no lock to undo). Setnayan never holds
 * the money (0% commission, off-platform).
 */
function DownpaymentModal({
  vendorName,
  methods,
  minimumAmountPhp = null,
  isPending,
  onSubmit,
  onCancel,
}: {
  vendorName: string;
  methods: CoupleFacingMethod[];
  /** finalizeVendor refuses less (`decideDepositAmount`); this only says so up front. */
  minimumAmountPhp?: number | null;
  isPending: boolean;
  onSubmit: (dp: DownpaymentSubmission) => void;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    methods[0]?.payment_method_id ?? '',
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amountPhp = String(form.get('deposit_php') ?? '');
    const referenceRaw = String(form.get('reference') ?? '').trim();
    const proofEntry = form.get('proof');
    onSubmit({
      methodId: selectedMethodId,
      amountPhp,
      reference: referenceRaw.length > 0 ? referenceRaw : null,
      proof: proofEntry instanceof File && proofEntry.size > 0 ? proofEntry : null,
    });
  }

  return (
    <LockPopup label="Pay the first payment to book" alertRole onClose={onCancel} closeDisabled={isPending}>
      <div className="flex items-start gap-2.5 pr-8">
        <CreditCard aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-sn-accent" strokeWidth={2} />
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-ink">Pay the first payment to book</h3>
          <p className="text-xs leading-snug text-ink/70">
            To book <strong>{vendorName}</strong>, pay the first payment through one of
            their methods below, then attach a screenshot so they can confirm. Your
            date is held the moment you submit. Setnayan never touches the money — you
            pay {vendorName} directly.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {/* The supplier's published methods stay RICH CARDS (name · Primary · the
            account to pay into) — a pill or a dropdown would hide the very
            number the couple types into their bank app. Fits no control kind yet
            (2026-10-12 look sweep); drawn in the accent, flipping in dark mode. */}
        <fieldset className="space-y-1.5">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-ink/55">
            How you paid
          </legend>
          {methods.map((m) => (
            <label
              key={m.payment_method_id}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors ${
                selectedMethodId === m.payment_method_id
                  ? 'border-sn-accent bg-sn-accent/10'
                  : 'border-ink/15 bg-cream hover:border-ink/30'
              }`}
            >
              <input
                type="radio"
                name="method_choice"
                value={m.payment_method_id}
                checked={selectedMethodId === m.payment_method_id}
                onChange={() => setSelectedMethodId(m.payment_method_id)}
                className="mt-0.5 accent-sn-accent"
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-ink">
                  {m.label || m.provider || m.method_type.toUpperCase()}
                  {m.is_primary ? (
                    <span className="ml-1.5 rounded-full bg-ink/[0.07] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink/70">
                      Primary
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-[11px] text-ink/60">{methodDetail(m)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-1">
          <label htmlFor="downpayment_php" className="block text-[11px] font-medium text-ink/70">
            Amount you paid (₱)
          </label>
          <input
            id="downpayment_php"
            name="deposit_php"
            type="number"
            min={minimumAmountPhp ?? 1}
            step="0.01"
            required
            inputMode="decimal"
            defaultValue={minimumAmountPhp ?? undefined}
            placeholder="e.g. 10000"
            aria-describedby={minimumAmountPhp ? 'downpayment_php_min' : undefined}
            className="w-full rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm text-ink focus:border-sn-accent focus:outline-none focus:ring-1 focus:ring-sn-accent"
          />
          {minimumAmountPhp ? (
            <p id="downpayment_php_min" className="text-[11px] text-ink/55">
              {vendorName} asked for ₱{minimumAmountPhp.toLocaleString('en-PH')} on booking in the
              quote you accepted. At least that amount — you may pay more.
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="downpayment_proof" className="flex items-center gap-1.5 text-[11px] font-medium text-ink/70">
            <Upload aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Payment screenshot <span className="font-semibold text-ink">(required)</span>
          </label>
          <input
            id="downpayment_proof"
            name="proof"
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            required
            className="block w-full text-xs text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-sn-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-sn-accent/20"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="downpayment_ref" className="block text-[11px] font-medium text-ink/70">
            Reference <span className="text-ink/40">(optional)</span>
          </label>
          <input
            id="downpayment_ref"
            name="reference"
            type="text"
            maxLength={64}
            placeholder="Txn ref / GCash no."
            className="w-full rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm text-ink focus:border-sn-accent focus:outline-none focus:ring-1 focus:ring-sn-accent"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onCancel} disabled={isPending} />
          <ActionButton
            type="submit"
            tone="brand"
            main
            icon={isPending ? LOCK_PENDING_ICON : CreditCard}
            label={isPending ? 'Booking…' : 'Book & submit first payment'}
            disabled={isPending || !selectedMethodId}
          />
        </div>
      </form>
    </LockPopup>
  );
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
  // Mounted only while open (parent renders `{cond ? <ExceptionModal …> : null}`),
  // so open is a constant true — mount = open, unmount runs the focus restore.
  return (
    <LockPopup
      label={
        state.kind === 'conflict'
          ? `${state.existingVendorName} is already booked`
          : `${vendorName} is fully booked`
      }
      alertRole
      onClose={onDismiss}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--color-warn))]"
          strokeWidth={2}
        />
        {state.kind === 'conflict' ? (
          <div className="space-y-1.5 pr-8">
            <h3 className="text-sm font-semibold text-ink">
              {state.existingVendorName} is already booked for{' '}
              {state.conflictGroupLabel.toLowerCase()}.
            </h3>
            <p className="text-xs leading-snug text-ink/70">
              Only one {state.conflictGroupLabel.toLowerCase()} can be booked
              at a time. Switch to <strong>{vendorName}</strong> instead? Your
              earlier pick stays on the card as a considering option.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 pr-8">
            <h3 className="text-sm font-semibold text-ink">
              {vendorName} is fully booked with soft holds for your date.
            </h3>
            <p className="text-xs leading-snug text-ink/70">
              {vendorName} already has {formatCount(state.existingHoldCount)} confirmed soft
              holds for your date. They only accept {state.currentLimit}{' '}
              at a time. Try a different supplier or come back later — they&rsquo;ll
              free up if another client doesn&rsquo;t downpay.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <ActionButton
          tone="neutral"
          icon={X}
          label={state.kind === 'conflict' ? 'Cancel' : 'Dismiss'}
          onClick={onDismiss}
          disabled={isPending}
        />
        {state.kind === 'conflict' ? (
          <ActionButton
            tone="brand"
            main
            icon={isPending ? LOCK_PENDING_ICON : ArrowLeftRight}
            label={isPending ? 'Switching…' : `Switch to ${vendorName}`}
            onClick={onSwitch}
            disabled={isPending}
          />
        ) : (
          <ActionButton
            tone="brand"
            main
            icon={Search}
            label="Browse similar suppliers"
            href={resolveBrowseSimilarHref(groupId)}
          />
        )}
      </div>
    </LockPopup>
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
  // Mounted only while open (parent renders `{cond ? <SlotPickerModal …> : null}`),
  // so open is a constant true — mount = open, unmount runs the focus restore.
  return (
    <LockPopup label={`Pick a time slot for ${vendorName}`} onClose={onDismiss}>
      <div className="flex items-start gap-2.5 pr-8">
        <Clock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-sn-accent" strokeWidth={2} />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">
            Pick a time slot for {vendorName}
          </h3>
          <p className="text-xs leading-snug text-ink/65">
            This supplier runs more than one window on your date. Choose the one
            you&rsquo;re booking.
          </p>
        </div>
      </div>

      {/* One of several windows → the one dropdown (`PickMenu`), not a native
          <select> (2026-10-12 look sweep). Not inside a form: the pick is state. */}
      <div className="mt-4 space-y-1">
        <span className="block text-xs font-medium text-ink/70">Time slot</span>
        <PickMenu
          label="Time slot"
          value={selectedSlotId}
          dataAttr="data-lock-slot"
          options={slots.map((slot) => ({ key: slot.slot_id, label: slotOptionLabel(slot) }))}
          onPick={onSelect}
        />
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onDismiss} disabled={isPending} />
        <ActionButton
          tone="brand"
          main
          icon={isPending ? LOCK_PENDING_ICON : BookmarkCheck}
          label={isPending ? 'Booking…' : 'Book this slot'}
          onClick={onConfirm}
          disabled={isPending || !selectedSlotId}
        />
      </div>
    </LockPopup>
  );
}

/**
 * No-Show Downpayment Protection — the reservation-terms acknowledgement gate.
 * Renders the vendor's frozen downpayment policy + a tick-box the couple MUST
 * check before the lock commits. Setnayan holds no money; this records consent.
 *
 * The tick stays a REAL checkbox (2026-10-12 look sweep): it records a legal
 * "I agree", which is not an on/off setting, so it is not the Switch kind — and
 * the app has no shared checkbox drawing yet. Its tick is the accent.
 */
function ReservationTermsModal({
  vendorName,
  policy,
  isPending,
  onAcknowledge,
  onDismiss,
}: {
  vendorName: string;
  policy: PolicySnapshot;
  isPending: boolean;
  onAcknowledge: () => void;
  onDismiss: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  const amountLabel =
    policy.downpayment_amount_php != null
      ? `₱${Math.round(policy.downpayment_amount_php).toLocaleString('en-PH')}`
      : null;

  return (
    <LockPopup label={`Reservation terms for ${vendorName}`} alertRole onClose={onDismiss}>
      <div className="flex items-start gap-2.5 pr-8">
        <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-sn-accent" strokeWidth={2} />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">
            Reservation terms for {vendorName}
          </h3>
          <p className="text-xs leading-snug text-ink/65">
            Before you book, please read {vendorName}&rsquo;s first payment policy.
            Booking records that you understood and agreed to these terms.
          </p>
        </div>
      </div>

      {/* What is only READ sits on the page and ends in a divider — no box. */}
      <div className="mt-4 space-y-2 border-b border-ink/15 pb-3 text-xs text-ink/85">
        <ul className="space-y-1.5">
          {policy.downpayment_non_refundable ? (
            <li className="flex items-start gap-1.5">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sn-accent" />
              <span>
                The first payment{amountLabel ? ` (${amountLabel})` : ''} is{' '}
                <strong>non-refundable</strong>.
              </span>
            </li>
          ) : null}
          {policy.no_show_forfeit ? (
            <li className="flex items-start gap-1.5">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sn-accent" />
              <span>
                A <strong>no-show forfeits</strong> the first payment.
              </span>
            </li>
          ) : null}
          {policy.refund_window_days != null ? (
            <li className="flex items-start gap-1.5">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" />
              <span>
                Refundable if you cancel within{' '}
                <strong>{policy.refund_window_days} day{policy.refund_window_days === 1 ? '' : 's'}</strong>{' '}
                of booking.
              </span>
            </li>
          ) : null}
        </ul>
        {policy.cancellation_terms ? (
          <p className="whitespace-pre-wrap border-t border-ink/15 pt-2 text-ink/70">
            {policy.cancellation_terms}
          </p>
        ) : null}
      </div>

      <label className="mt-4 flex items-start gap-2 text-xs text-ink/85">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-sn-accent"
        />
        <span>
          I understand the first payment is non-refundable on no-show and agree to{' '}
          {vendorName}&rsquo;s reservation terms.
        </span>
      </label>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onDismiss} disabled={isPending} />
        <ActionButton
          tone="brand"
          main
          icon={isPending ? LOCK_PENDING_ICON : BookmarkCheck}
          label={isPending ? 'Booking…' : 'Agree & book'}
          onClick={onAcknowledge}
          disabled={isPending || !agreed}
        />
      </div>
    </LockPopup>
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
