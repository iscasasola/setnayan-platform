'use client';

// ============================================================================
// CancelBookingButton — host-side cancel pre-downpayment.
//
// CLAUDE.md decision-log row "Canonical wizard sequence reconciled 38 → 45 +
// Lock/delete/overlap architecture" (2026-05-24). Rule 1 of 5 from the
// lock/delete/overlap pillar — pilot-critical batch landing same session as
// PR A (`max_soft_holds_per_date` + finalizeVendor extension) and PR C
// (PLAN_GROUPS.bridal_car alignment).
//
// Why this exists:
//   The existing per-row Trash2 icon on /dashboard/[eventId]/vendors fires
//   the blunt `deleteVendor` action — hard-deletes the row, no notification,
//   no payment-stage guard. Fine for `considering`/`shortlisted` rows where
//   no commitment exists. For `contracted` rows (host clicked Lock; soft
//   hold registered with vendor; vendor sees the booking on their calendar),
//   silent deletion is hostile: the vendor's calendar stays dirty until they
//   notice + admin would handle the cleanup manually.
//
// Status routing (this component handles ONE branch — the cancellable case):
//   considering / shortlisted        → existing Trash2 + deleteVendor
//   contracted (no downpayment)      → THIS COMPONENT (cancelBookingAsHost)
//   contracted (downpayment confirmed),
//   deposit_paid / delivered / complete → DisputeLinkButton (separate
//     component below, links to /dashboard/[eventId]/disputes)
//
// Parent decides which button to render based on the vendor row's status +
// deposit_paid_php — keeps this component focused on the cancellable case.
//
// Confirm UX (design template 14 Nov 2026, rule 9): the app's one confirm box,
// `ConfirmDialog` — native <dialog>, so ESC, focus trap and the dark blurred
// backdrop come from the browser; a tap on the dark keeps the booking. Polite
// brand voice, no engineering jargon, no all-caps urgency.
//
// On success: the app's one toast says it worked, and the page revalidates via
// the server action's revalidatePath calls so the cancelled supplier
// disappears from every host-facing view. When `redirectToHomeOnSuccess` is
// true (workspace page entry), router pushes back to event home — the
// workspace URL is stale after the row is deleted.
// ============================================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { actionButtonClass } from '@/components/action-button';
import { ConfirmDialog } from '@/app/_components/confirm-dialog';
import { useToast } from '@/app/_components/toast/toast-provider';
import {
  cancelBookingAsHost,
  type CancelBookingAsHostResult,
} from '../actions';

// 📐 DESIGN TEMPLATE (14 Nov 2026, rules 3 · 9 · 14): the confirm is the app's one
// confirm box (`ConfirmDialog` — dark blurred backdrop, the two answers drawn by
// `ActionButton`), the trigger wears the shared button's classes, and "it worked"
// is the app's one toast. Every fact and every outcome below is unchanged.

type Props = {
  eventId: string;
  vendorId: string;
  vendorName: string;
  /** When true (workspace page entry), success routes back to event home
   *  because the workspace URL becomes stale after the row deletes. When
   *  false (vendors list entry), success stays on the current page so the
   *  host sees the row disappear in-place. */
  redirectToHomeOnSuccess?: boolean;
  /** Optional layout — 'pill' is the quiet row-level button; 'cta' is the
   *  workspace page's red action. Both are the shared button. */
  variant?: 'pill' | 'cta';
  /** Wear another control's own classes (the Booked row's `ActionButton`
   *  pill) instead of a variant's. The word then sits in a `.lbl`, so a verb
   *  row's fit pass can fold it to the icon. */
  triggerClass?: string;
  /** The word on a `triggerClass` trigger — the Booked row's tile says "Cancel" (owner 2026-10-30, one row of equal
   *  tiles). The accessible name still says the whole thing. Absent → "Cancel booking". */
  triggerWord?: string;
};

type DialogState =
  | { kind: 'closed' }
  | { kind: 'open' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

export function CancelBookingButton({
  eventId,
  vendorId,
  vendorName,
  redirectToHomeOnSuccess = false,
  variant = 'pill',
  triggerClass,
  triggerWord,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [isPending, startTransition] = useTransition();

  const closeDialog = () => {
    if (isPending || dialog.kind === 'pending') return; // Don't allow close during in-flight submit.
    setDialog({ kind: 'closed' });
  };

  const performCancel = () => {
    if (isPending || dialog.kind === 'pending') return;
    setDialog({ kind: 'pending' });
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      let result: CancelBookingAsHostResult;
      try {
        result = await cancelBookingAsHost(fd);
      } catch (err) {
        setDialog({
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
        case 'not_found':
          // Both states leave the row deleted — say so either way so
          // re-cancels (multi-host race) don't look broken.
          toast.success(`Booking with ${vendorName} cancelled — your date is open again on their calendar.`);
          setDialog({ kind: 'closed' });
          // Otherwise stay on the current page — the server action revalidated, and its answer carries the redraw.
          if (redirectToHomeOnSuccess) router.push(`/dashboard/${eventId}`);
          return;
        case 'downpaid_use_dispute_flow':
          // Race: vendor flipped to deposit_paid between our render and
          // the submit. Push the host to the dispute flow. Server already
          // declined the delete so the row is intact.
          setDialog({ kind: 'closed' });
          router.push(`/dashboard/${eventId}/disputes`);
          return;
        case 'has_logged_payments':
          // SUP-67: payments are logged against this supplier. The row is
          // intact; say why and how through, rather than routing to disputes.
          setDialog({ kind: 'error', message: result.message });
          return;
        case 'not_signed_in':
          setDialog({
            kind: 'error',
            message: 'Sign in again to cancel this booking.',
          });
          return;
        case 'error':
          setDialog({ kind: 'error', message: result.message });
          return;
      }
    });
  };

  const triggerLabel = 'Cancel booking';
  const ownClass =
    variant === 'cta' ? actionButtonClass('danger') : actionButtonClass('danger', { quiet: true });

  return (
    <>
      <button
        type="button"
        onClick={() => setDialog({ kind: 'open' })}
        className={triggerClass ?? ownClass}
        aria-label={`Cancel booking with ${vendorName}`}
        title={triggerClass ? triggerLabel : undefined}
      >
        <X aria-hidden strokeWidth={1.9} />
        <span className="lbl">{triggerClass ? (triggerWord ?? triggerLabel) : triggerLabel}</span>
      </button>

      <ConfirmDialog
        open={dialog.kind !== 'closed'}
        title={`Cancel your booking with ${vendorName}?`}
        body={
          <div className="space-y-2">
            <p>
              We&rsquo;ll let <strong className="font-semibold text-ink">{vendorName}</strong> know and your date opens back up on
              their calendar. You can add them again from Find anytime.
            </p>
            {dialog.kind === 'pending' ? (
              <p role="status" className="font-semibold text-ink">
                Cancelling…
              </p>
            ) : null}
            {dialog.kind === 'error' ? (
              <p role="alert" className="flex items-start justify-center gap-1.5 font-semibold text-danger-700">
                <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                <span>{dialog.message}</span>
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Yes, cancel"
        cancelLabel="Keep the booking"
        destructive
        confirmIcon={Trash2}
        onConfirm={performCancel}
        onCancel={closeDialog}
      />
    </>
  );
}

// ============================================================================
// DisputeLinkButton — sibling component for the downpaid-status path.
//
// Renders when status >= 'deposit_paid' (or deposit_paid_php > 0). Routes to
// the existing 0023 § 3.6 Disputes flow at /dashboard/[eventId]/disputes
// instead of offering a destructive cancel — money has moved + the vendor
// has a contractual commitment, so resolution belongs in the dispute
// surface where admin can mediate per CLAUDE.md 2026-05-12 row "0023 § 9.1
// two-admin approval" + the per-vendor dispute schema at
// supabase/migrations/20260516210000_vendor_payout_model.sql.
//
// The words are "Report a problem" (owner 2026-10-14, DECISION_LOG 🧾 — was "Request refund / dispute";
// Setnayan pays no money back, so the door never promises one). Same flow.
//
// Server-rendered as a Link (no client logic needed) — kept in the same
// file so callers import one symbol and the status-routing logic stays
// adjacent.
// ============================================================================

export function DisputeLinkButton({
  eventId,
  variant = 'pill',
}: {
  eventId: string;
  variant?: 'pill' | 'cta';
}) {
  const className = actionButtonClass('warn', { quiet: variant !== 'cta' });
  return (
    <Link href={`/dashboard/${eventId}/disputes`} className={className}>
      <AlertTriangle aria-hidden strokeWidth={1.9} />
      <span className="lbl">Report a problem</span>
    </Link>
  );
}
