'use client';

/**
 * WithdrawAskButton — the couple takes their booking request back.
 *
 * 🔴 THE INVERSE THAT DID NOT EXIST. `cancel_vendor_lock_request` shipped in
 * migration 20271107090000, was re-emitted by 20271143289546, holds an EXECUTE
 * grant to `authenticated` — and had ZERO CALLERS anywhere in the repo. So a
 * couple who asked the wrong supplier could not un-ask: the request held the
 * supplier's slot and both pending indexes until either the supplier answered a
 * question the couple no longer wanted answered, or the 7-day fuse blew.
 *
 * ⚠ THIS IS NOT "Change pick". `revertVendorToConsidering` unwinds a REAL
 * booking — archive restores, thread revivals, a schedule release, a
 * `booking_cancelled` notice. This withdraws a question nobody has answered, and
 * the supplier hears `lock_request_withdrawn` instead. Wiring the two together
 * would fire a cancellation at a supplier who was never booked.
 *
 * One control, one confirm, no modal: a mis-tap here costs the couple nothing
 * (they can ask again the moment it is withdrawn), so a full dialog would charge
 * more attention than the decision is worth. The RPC is idempotent and refuses
 * anything that is not still pending, so a double-press is safe by construction.
 */

import { useTransition, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import {
  CARD_WITHDRAW,
  CARD_WITHDRAWING,
  cardWithdrawLabel,
} from '@/lib/explore-info-copy';
import { withdrawVendorLockRequest } from '../actions';

export function WithdrawAskButton({
  vendorId,
  vendorName,
  className = 'vact ghost',
  wrapperClassName,
  errorClassName = 'vact-err',
}: {
  /** `event_vendors.vendor_id`. The RPC resolves the event from it and returns
   *  the authorized `event_id` — nothing here posts one. */
  vendorId: string;
  vendorName: string;
  className?: string;
  wrapperClassName?: string;
  errorClassName?: string;
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const press = () => {
    haptic('tick');
    setNote(null);
    start(async () => {
      const fd = new FormData();
      fd.set('vendor_id', vendorId);
      const res = await withdrawVendorLockRequest(fd);
      // 'ok' needs no message: the revalidate replaces this whole card with the
      // un-asked state, which says more than a toast could.
      if (res.status === 'not_pending') {
        // The supplier answered (or the fuse blew) between the render and the
        // press. Not an error — the screen is simply behind. Say what is true
        // rather than "failed", which would read as our bug and hide theirs.
        setNote('They already answered — refresh to see it.');
      } else if (res.status === 'error') {
        setNote(res.message);
      } else if (res.status === 'not_signed_in') {
        setNote('Sign in again to withdraw this.');
      }
    });
  };

  const button = (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={press}
      aria-label={cardWithdrawLabel(vendorName)}
    >
      <Undo2 size={12} strokeWidth={1.9} aria-hidden />
      {pending ? CARD_WITHDRAWING : CARD_WITHDRAW}
    </button>
  );

  if (!wrapperClassName && !note) return button;
  return (
    <span className={wrapperClassName}>
      {button}
      {note ? <span className={errorClassName}>{note}</span> : null}
    </span>
  );
}
