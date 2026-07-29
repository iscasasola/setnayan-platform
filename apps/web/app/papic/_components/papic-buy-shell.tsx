'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { startPapicGuestPurchase } from '../buy/actions';
import type { PapicGuestOffer } from '@/lib/papic-guest-buy';

/**
 * "ADD SHOTS" — the guest's doorway, on the capture screen itself.
 *
 * Two entries, because the two moments are different (owner-locked 2026-07-29):
 *
 *   1. THE STANDING ENTRY — a quiet pill in the corner, always there. Somebody
 *      who WANTS to chip in should not have to run out of shots first.
 *   2. THE EXHAUSTION MOMENT — the sheet opens by itself the first time the
 *      camera refuses a shot for want of points. That is the highest-intent
 *      second of the whole night: they are holding up a phone at something that
 *      is happening right now.
 *
 * ── HOW IT HEARS ABOUT (2) WITHOUT BEING WIRED INTO THE CAMERA ────────────
 * A window CustomEvent, `papic:out-of-shots`. The alternative was threading a
 * callback through the ~1,400-line capture components and hoisting a new piece
 * of page-level state into each — a lot of edits to two of the most
 * safety-critical files in the app, to move one boolean.
 *
 * The event costs nothing when this component is not mounted (flag off): a
 * dispatch nobody listens to is a no-op, so the capture surfaces render
 * byte-identically with NEXT_PUBLIC_PAPIC_GUEST_BUY unset.
 *
 * ── WHAT THIS COMPONENT IS NOT ────────────────────────────────────────────
 * It is not the authority on anything. It paints offers the server resolved and
 * posts a `service_code` CHOICE; every price, every entitlement and the "your
 * own camera only" rule are re-decided server-side in app/papic/buy/actions.ts.
 * Deleting this file would remove the doorway and change no rule.
 */

/** The refusals the buy action can bounce back with. */
const ERROR_COPY: Record<string, string> = {
  unavailable: 'That option is not on sale right now.',
  not_here: "We couldn't tell which camera you're holding. Reopen your QR link and try again.",
  too_fast: 'One moment — try that again in a few seconds.',
  unknown_rung: 'That option is no longer available. Pick another one.',
  no_camera: 'Adding shots to one camera needs a camera of your own.',
  not_your_camera: 'You can only add shots to the camera you are holding.',
  not_reloadable:
    'This camera shoots from the shared pool, so top up the pool instead — those shots work everywhere.',
  already_pending: 'You already have one of these waiting for payment. Finish that one first.',
  order_failed: "We couldn't start that order, so nothing was charged. Please try again.",
};

export function PapicBuyShell({
  offers,
  seatToken,
  returnTo,
  error,
}: {
  offers: readonly PapicGuestOffer[];
  /** Present on the seat camera; absent on the guest camera (cookie identity). */
  seatToken?: string | null;
  /** Where a refusal bounces back to. Re-validated server-side — see safeReturnTo. */
  returnTo: string;
  error?: string | null;
}) {
  const [open, setOpen] = useState<boolean>(Boolean(error));
  // Only ever auto-open ONCE. A camera that keeps refusing shots would
  // otherwise re-open this over the viewfinder every time they pressed the
  // shutter, which turns a helpful offer into a thing to fight with.
  const autoOpened = useRef(false);

  useEffect(() => {
    const onOut = () => {
      if (autoOpened.current) return;
      autoOpened.current = true;
      setOpen(true);
    };
    window.addEventListener('papic:out-of-shots', onOut);
    return () => window.removeEventListener('papic:out-of-shots', onOut);
  }, []);

  if (offers.length === 0) return null;

  const pool = offers.filter((o) => o.kind === 'pool_topup');
  const one = offers.filter((o) => o.kind === 'one_reload');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-2 text-xs font-medium text-white backdrop-blur hover:bg-black/75"
      >
        <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Add shots
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add shots"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        >
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 text-ink shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">Add shots</h2>
                <p className="text-sm text-ink/70">
                  Keep the cameras going. You don&rsquo;t need an account — you&rsquo;ll get a
                  reference code and a QR to pay, and the shots go live once the Setnayan
                  team confirms it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-ink/50 hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700"
              >
                {ERROR_COPY[error] ?? 'Something went wrong, and nothing was charged.'}
              </p>
            ) : null}

            {one.length > 0 ? (
              <section className="mt-5 space-y-2">
                <p className="sn-eye">This camera only</p>
                <p className="text-xs text-ink/60">
                  Shots that stay on the camera in your hand. Nobody else can spend them.
                </p>
                {one.map((o) => (
                  <OfferForm
                    key={o.serviceCode}
                    offer={o}
                    seatToken={seatToken}
                    returnTo={returnTo}
                  />
                ))}
              </section>
            ) : null}

            {pool.length > 0 ? (
              <section className="mt-5 space-y-2">
                <p className="sn-eye">Everyone&rsquo;s pool</p>
                <p className="text-xs text-ink/60">
                  Adds to the shared pool every camera at this event shoots from — a gift to
                  the whole party, not just this phone.
                </p>
                {pool.map((o) => (
                  <OfferForm
                    key={o.serviceCode}
                    offer={o}
                    seatToken={seatToken}
                    returnTo={returnTo}
                  />
                ))}
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function OfferForm({
  offer,
  seatToken,
  returnTo,
}: {
  offer: PapicGuestOffer;
  seatToken?: string | null;
  returnTo: string;
}) {
  return (
    <form action={startPapicGuestPurchase}>
      {/* The CHOICE, and only the choice. No price is posted — the server
          resolves it from the catalog (SEC-4). */}
      <input type="hidden" name="service_code" value={offer.serviceCode} />
      <input type="hidden" name="return_to" value={returnTo} />
      {seatToken ? <input type="hidden" name="seat_token" value={seatToken} /> : null}
      <button
        type="submit"
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink/15 bg-surface px-4 py-3 text-left text-sm text-ink hover:border-terracotta hover:bg-terracotta/5"
      >
        <span>{offer.phrase}</span>
        <span aria-hidden className="text-ink/40">
          &rsaquo;
        </span>
      </button>
    </form>
  );
}
