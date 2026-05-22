'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Loader2, X } from 'lucide-react';
import { revertVendorToConsidering } from '../vendors/actions';

// Switch Vendor confirmation modal — finalized-vendor-photo-card
// (2026-05-22, owner directive PR D).
//
// High-stakes action: the host is locked in with a vendor (status at
// or past 'contracted' per CONFIRMED_VENDOR_STATUSES in lib/events.ts).
// Switching means:
//   - releasing the existing locked vendor (any deposit risk is on the
//     host — Setnayan doesn't model deposit-recovery here)
//   - starting Compare again with fresh considering picks
//
// Implementation reuses the existing revertVendorToConsidering server
// action (apps/web/app/dashboard/[eventId]/vendors/actions.ts). The
// modal is a calm confirmation step; pressing "Yes, switch vendor"
// reverts the row to status='considering' which (a) collapses the
// LockedCard back to the normal compare-and-add card variant on the
// next render and (b) keeps the vendor on the event so the host's
// research isn't lost — they can re-lock the same or a different
// vendor from compare.
//
// PostHog `vendor_unlocked` event fires on confirm so the team can
// track unlock rate during pilot (per [[reference_setnayan_owner_email]]).
//
// Brand voice: amber for caution, NOT red. Hint at the irreversibility
// without scolding the host. Per [[feedback_setnayan_no_dev_text_post_launch]]
// no engineering jargon, no all-caps urgency. Cormorant-italic-display
// for the headline, Manrope body, terracotta accent on the destructive
// confirm button.

type Props = {
  eventId: string;
  vendorId: string;
  vendorName: string;
  groupLabel: string;
  trigger?: React.ReactNode;
};

export function SwitchVendorConfirm({
  eventId,
  vendorId,
  vendorName,
  groupLabel,
  trigger,
}: Props) {
  const [isOpen, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // Focus the cancel button on open — calmest default, host has to
  // deliberately move to the destructive action.
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

  const handleConfirm = () => {
    setErrMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      const result = await revertVendorToConsidering(fd);
      if (result.status === 'ok') {
        // PostHog vendor_unlocked event. Loaded dynamically so the
        // import doesn't bloat the home-page bundle — PostHog SDK
        // already lazy-loaded by PostHogProvider, the singleton lives
        // on `posthog.default` after first init. Safe no-op when
        // analytics is disabled (env var missing → mod returns
        // undefined/null).
        try {
          const mod = await import('posthog-js');
          const client = (mod.default ?? mod) as unknown as {
            capture?: (event: string, props?: Record<string, unknown>) => void;
          };
          client.capture?.('vendor_unlocked', {
            event_id: eventId,
            vendor_id: vendorId,
            group_label: groupLabel,
          });
        } catch {
          // PostHog optional — never block UX.
        }
        setOpen(false);
        // No client-side state mutation needed — revalidatePath on the
        // server action refreshes the dashboard, the LockedCard
        // disappears, the normal compare-and-add card variant takes
        // its place.
      } else if (result.status === 'not_signed_in') {
        setErrMsg('Please sign in again to continue.');
      } else if (result.status === 'not_found') {
        setErrMsg('This vendor is no longer on your event.');
      } else if (result.status === 'not_locked') {
        // Already unlocked — close the modal, the page will re-render
        // with the unlocked state and the host won't see the modal
        // again. This is a race that's safe to absorb silently.
        setOpen(false);
      } else if (result.status === 'error') {
        setErrMsg(result.message ?? 'Something went wrong. Please try again.');
      }
    });
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} role="presentation">
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-rose-700/80 transition-colors hover:bg-rose-50/60 hover:text-rose-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
        >
          Switch vendor →
        </button>
      )}

      {isOpen ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-vendor-headline"
          aria-describedby="switch-vendor-body"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === dialogRef.current) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-amber-200/60 bg-cream p-5 shadow-xl sm:p-6">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>

            <h2
              id="switch-vendor-headline"
              className="font-display text-2xl italic tracking-tight text-ink"
            >
              Switch vendor?
            </h2>

            <div
              id="switch-vendor-body"
              className="mt-3 space-y-3 text-sm text-ink/75"
            >
              <p>
                You&rsquo;re locked in with{' '}
                <strong className="font-medium text-ink">{vendorName}</strong>{' '}
                for {groupLabel.toLowerCase()}.
              </p>
              <p>Switching means:</p>
              <ul className="ml-4 list-disc space-y-1 text-ink/70">
                <li>
                  Releasing your current vendor (any deposit you&rsquo;ve
                  paid stays between you and them)
                </li>
                <li>
                  Starting Compare again with fresh considering picks
                </li>
              </ul>
              <p className="text-amber-900">
                This is a high-stakes change. Are you sure?
              </p>
            </div>

            {errMsg ? (
              <p
                role="alert"
                className="mt-3 rounded-md border border-rose-300/50 bg-rose-50/60 px-3 py-2 text-xs text-rose-900"
              >
                {errMsg}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 transition-colors hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2
                      aria-hidden
                      className="h-4 w-4 animate-spin"
                      strokeWidth={2}
                    />
                    Switching…
                  </>
                ) : (
                  'Yes, switch vendor'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
