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
// Modal UX: native overlay div + role="dialog" matching plan-card-lock.tsx
// (the canonical Setnayan modal pattern). ESC key dismisses, backdrop
// click dismisses, Tab cycles focus, Cancel button focused on open
// (calmest default per the same pattern). Per
// [[feedback_setnayan_no_dev_text_post_launch]] — polite brand voice, no
// engineering jargon, no all-caps urgency.
//
// On success: success toast surfaces for 5 seconds in the corner, page
// revalidates via the server action's revalidatePath calls so the
// cancelled vendor disappears from every host-facing view. When
// `redirectToHomeOnSuccess` is true (workspace page entry), router pushes
// back to event home — the workspace URL is stale after the row is
// deleted.
// ============================================================================

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import {
  cancelBookingAsHost,
  type CancelBookingAsHostResult,
} from '../actions';

type Props = {
  eventId: string;
  vendorId: string;
  vendorName: string;
  /** When true (workspace page entry), success routes back to event home
   *  because the workspace URL becomes stale after the row deletes. When
   *  false (vendors list entry), success stays on the current page so the
   *  host sees the row disappear in-place. */
  redirectToHomeOnSuccess?: boolean;
  /** Optional layout — 'pill' renders as a small bordered button matching
   *  the vendors-list per-row affordances. 'cta' renders as a destructive-
   *  toned full-width button matching the workspace page's action row. */
  variant?: 'pill' | 'cta';
};

const TOAST_AUTO_DISMISS_MS = 5_000;

type DialogState =
  | { kind: 'closed' }
  | { kind: 'open' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

type ToastState =
  | { kind: 'hidden' }
  | { kind: 'cancelled'; vendorName: string };

export function CancelBookingButton({
  eventId,
  vendorId,
  vendorName,
  redirectToHomeOnSuccess = false,
  variant = 'pill',
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [toast, setToast] = useState<ToastState>({ kind: 'hidden' });
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-dismiss the success toast after 5s. Matches plan-card-lock.tsx
  // and the rest of the lock/delete/overlap flows for consistency.
  useEffect(() => {
    if (toast.kind !== 'cancelled') return;
    const t = setTimeout(() => setToast({ kind: 'hidden' }), TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast]);

  // Focus the cancel-modal close button on open — calmest default, the
  // destructive path requires a deliberate Tab over. Mirrors plan-card-lock.
  useEffect(() => {
    if (dialog.kind === 'open' || dialog.kind === 'error') {
      cancelBtnRef.current?.focus();
    }
  }, [dialog]);

  // Escape-key dismissal.
  useEffect(() => {
    if (dialog.kind === 'closed') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) {
        setDialog({ kind: 'closed' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, isPending]);

  const closeDialog = () => {
    if (isPending) return; // Don't allow close during in-flight submit.
    setDialog({ kind: 'closed' });
  };

  const performCancel = () => {
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
          // Both states leave the row deleted — show the toast either
          // way so re-cancels (multi-host race) don't look broken.
          setToast({ kind: 'cancelled', vendorName });
          setDialog({ kind: 'closed' });
          if (redirectToHomeOnSuccess) {
            router.push(`/dashboard/${eventId}`);
          } else {
            // Stay on the current page — server action already revalidated.
            router.refresh();
          }
          return;
        case 'downpaid_use_dispute_flow':
          // Race: vendor flipped to deposit_paid between our render and
          // the submit. Push the host to the dispute flow. Server already
          // declined the delete so the row is intact.
          setDialog({ kind: 'closed' });
          router.push(`/dashboard/${eventId}/disputes`);
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
  const triggerClassName =
    variant === 'cta'
      ? 'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-danger-300/60 bg-cream px-3 py-2 text-xs font-medium text-danger-800 transition-colors hover:border-danger-400 hover:bg-danger-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-500'
      : 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink/55 transition-colors hover:bg-ink/5 hover:text-danger-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';

  return (
    <>
      <button
        type="button"
        onClick={() => setDialog({ kind: 'open' })}
        className={triggerClassName}
        aria-label={`Cancel booking with ${vendorName}`}
      >
        <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        {triggerLabel}
      </button>

      {dialog.kind !== 'closed' ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-booking-headline"
          aria-describedby="cancel-booking-body"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === dialogRef.current) closeDialog();
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-cream p-5 shadow-xl sm:p-6">
            <button
              type="button"
              aria-label="Close"
              onClick={closeDialog}
              disabled={isPending}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>

            <h2
              id="cancel-booking-headline"
              className="font-display text-2xl italic tracking-tight text-ink"
            >
              Cancel your booking with {vendorName}?
            </h2>

            <div
              id="cancel-booking-body"
              className="mt-3 space-y-3 text-sm text-ink/75"
            >
              <p>
                We&rsquo;ll let{' '}
                <strong className="font-medium text-ink">{vendorName}</strong>{' '}
                know and your wedding date opens back up on their calendar.
              </p>
              <p className="text-ink/65">
                You can re-add them via the marketplace anytime if plans
                change.
              </p>
            </div>

            {dialog.kind === 'error' ? (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-md border border-danger-300/60 bg-danger-50/70 px-3 py-2 text-xs text-danger-900"
              >
                <AlertTriangle
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-danger-700"
                  strokeWidth={2}
                />
                <span>{dialog.message}</span>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={closeDialog}
                disabled={isPending}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
              >
                Keep the booking
              </button>
              <button
                type="button"
                onClick={performCancel}
                disabled={isPending}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-danger-700 px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-danger-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-500 disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <Loader2
                      aria-hidden
                      className="h-4 w-4 animate-spin"
                      strokeWidth={2}
                    />
                    Cancelling…
                  </>
                ) : (
                  <>
                    <Trash2
                      aria-hidden
                      className="h-4 w-4"
                      strokeWidth={2}
                    />
                    Yes, cancel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Success toast — same fixed-bottom-centered shape plan-card-lock
          uses. 5-second auto-dismiss matches the rest of the lock/delete
          flow toasts. Visible after redirect-to-home path completes too —
          toast state survives the router.push because Next 13+ keeps
          client component state across navigations within the same layout. */}
      {toast.kind === 'cancelled' ? (
        <SuccessToast
          vendorName={toast.vendorName}
          onDismiss={() => setToast({ kind: 'hidden' })}
        />
      ) : null}
    </>
  );
}

function SuccessToast({
  vendorName,
  onDismiss,
}: {
  vendorName: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-success-300/60 bg-cream px-4 py-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-success-700"
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-ink">
            Booking with {vendorName} cancelled.
          </p>
          <p className="text-[11px] text-ink/60">
            We let them know — your date is open again on their calendar.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
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
  const className =
    variant === 'cta'
      ? 'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-warn-300/60 bg-cream px-3 py-2 text-xs font-medium text-warn-900 transition-colors hover:border-warn-400 hover:bg-warn-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn-600'
      : 'inline-flex items-center gap-1.5 rounded-md border border-warn-300/50 bg-cream px-2 py-1 text-xs font-medium text-warn-900 transition-colors hover:border-warn-400 hover:bg-warn-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn-600';
  return (
    <Link href={`/dashboard/${eventId}/disputes`} className={className}>
      <AlertTriangle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      Request refund / dispute
    </Link>
  );
}
