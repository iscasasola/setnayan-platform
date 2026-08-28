'use client';

/**
 * BenchVendorActions — the three actions under a bench vendor card
 * (Explore Replan slice D · spec §3 PR-D, §12.1, decision #9).
 *
 * ⚠ EVERY leg here is a PORT of shipped machinery, never a second copy of it:
 *
 *  1. **＋ Add to build** → `setBuildPick` / `removeBuildPick`, the SAME actions
 *     the legacy accordion's `AccordionBuildButton` calls. Hard-single groups
 *     hold one candidate and adding swaps — that rule lives server-side in
 *     `replacesSiblingsOnPin` (`lib/build-pick-rules.ts`), so this component
 *     never reimplements it.
 *  2. **Inquire / 💬 Check inquiry** → the shipped `ContactShortlistVendorButton`
 *     (which delegates to `startServiceInquiry` and dedupes on the UNIQUE
 *     (event_id, vendor_profile_id) thread) for a fresh inquiry, and a plain
 *     `<Link>` to the existing thread when one is live. `InquiryComposer` is
 *     deliberately NOT mounted here: it is a pure prop consumer needing seven
 *     props the bench does not load, and the contract forbids a second composer.
 *  3. **Lock this** → the shipped `AccordionLockButton`, so the hard-single
 *     conflict gate, the date-lock modal, the reservation-terms and downpayment
 *     gates, the milestone toast and undo ALL carry unchanged. There is exactly
 *     one lock path in this app and this is not a new one.
 *
 * Copy lives in `lib/explore-info-copy.ts` (§11 rule 3 — no strings in JSX) and
 * the decision of WHICH legs render lives in `lib/bench-card-actions.ts`. This
 * file is presentation only, wearing the bench's own scoped `.slcat` classes.
 *
 * The lock label is "Lock this", never "it's final": per the §7 handshake
 * amendment a lock is a REQUEST until the vendor accepts the payment.
 *
 * PR-G1 adds ONE more state to leg 1: a SOFT schedule clash (no free day left
 * inside the build's shared-date window) replaces the Add CTA with a note that
 * names the clashing candidate and the fix. It does NOT touch leg 2 — "Ask
 * anyway" is deliberate (decision #3) — and leg 3 is withheld upstream by the
 * resolver returning a null `lockGroupId`. Nothing here is a hard block: the
 * couple removes the clashing candidate and every leg comes straight back.
 */

import Link from 'next/link';
import { useTransition } from 'react';
import { CalendarX2, Check, Clock, Hammer, Hourglass, MessageCircle } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { useSaveLoader } from '@/components/sd-loader';
import type { BenchCardActions } from '@/lib/bench-card-actions';
import { DOESNT_FIT_ACTION, doesntFitReason } from '@/lib/build-date-window';
import {
  CARD_ADDING,
  CARD_ADD_TO_BUILD,
  CARD_CHECK_INQUIRY,
  CARD_IN_BUILD,
  CARD_INQUIRE,
  CARD_LOCK,
  CARD_LOCKING,
  CARD_NEEDS_PRICE,
  CARD_REMOVE_FROM_BUILD,
  CARD_ASK_SENT,
  cardCheckInquiryLabel,
  cardInquireLabel,
  waitingOnSupplier,
} from '@/lib/explore-info-copy';
import type { PlanGroupId } from '@/lib/wedding-plan-groups';
import { removeBuildPick, setBuildPick } from '../build-pick-actions';
import { AccordionLockButton } from './accordion-lock';
import { ContactShortlistVendorButton } from './contact-shortlist-vendor-button';
import { WithdrawAskButton } from './withdraw-ask-button';

export function BenchVendorActions({
  actions,
  eventId,
  vendorId,
  vendorName,
  groupLabel,
  verifiedState,
  lockRequestExpiresAt,
}: {
  actions: BenchCardActions;
  eventId: string;
  /** `event_vendors.vendor_id` — what every action below keys on. */
  vendorId: string;
  vendorName: string;
  /** The category label, for the lock modals' copy ("Caterer", "Florist"…). */
  groupLabel: string;
  /**
   * TRI-state verification (see `ShortlistVendor.verifiedState`). NULL means
   * unknown / off-platform and MUST pass through as `undefined` — coercing it
   * to false would client-block a manual vendor from a lock they are entitled
   * to (spec §9: manual vendors skip the handshake and lock directly).
   */
  verifiedState: boolean | null;
  /** ISO deadline of a still-outstanding ask, read back off the row the DB
   *  stamped. Only meaningful when `actions.withdraw` is non-null. */
  lockRequestExpiresAt?: string | null;
}) {
  const [pending, start] = useTransition();
  const save = useSaveLoader();

  const pin = (planGroupId: string) => {
    haptic('confirm');
    start(async () => {
      await save.run(() => setBuildPick({ eventId, planGroupId, vendorId }), {
        steps: ['Pinning your pick'],
        hint: 'Saving',
      });
    });
  };

  const unpin = (planGroupId: string) => {
    haptic('tick');
    start(async () => {
      // vendorId is REQUIRED: a multi-pick category holds several picks and a
      // vendorless clear would destroy the couple's others.
      await removeBuildPick({ eventId, planGroupId, vendorId });
    });
  };

  const groupId = actions.lockGroupId;

  return (
    <div className="vacts">
      {actions.build && groupId ? (
        actions.build.kind === 'add' ? (
          <button
            type="button"
            className="vact primary"
            disabled={pending}
            onClick={() => pin(groupId)}
          >
            <Hammer size={12} strokeWidth={2} aria-hidden />
            {pending ? CARD_ADDING : CARD_ADD_TO_BUILD}
          </button>
        ) : actions.build.kind === 'in_build' ? (
          <span className="vact-pair">
            <span className="vact on">
              <Check size={12} strokeWidth={2.4} aria-hidden />
              {CARD_IN_BUILD}
            </span>
            <button
              type="button"
              className="vact mini"
              disabled={pending}
              onClick={() => unpin(groupId)}
            >
              {pending ? '…' : CARD_REMOVE_FROM_BUILD}
            </button>
          </span>
        ) : actions.build.kind === 'schedule_clash' ? (
          // SOFT schedule clash (PR-G1). Not an error and not a wall: the
          // reason is named, the fix is named, and the Inquire leg below is
          // still live. Removing the clashing candidate brings this card back.
          <span className="vact note clash">
            <CalendarX2 size={12} strokeWidth={1.9} aria-hidden />
            <span className="vact-note-txt">
              <b>{DOESNT_FIT_ACTION}</b>
              <span>{doesntFitReason(actions.build.clashWith)}</span>
            </span>
          </span>
        ) : (
          <span className="vact note">
            <Clock size={12} strokeWidth={1.9} aria-hidden />
            {CARD_NEEDS_PRICE}
          </span>
        )
      ) : null}

      {/* PR-H · THE ASK IS OUT AND NOBODY HAS ANSWERED.
          This row is what stops the bench lying: without it the card looked
          identical before and after the couple pressed Lock, and went on
          offering Lock — which the one-pending-request-per-group unique index
          would then REJECT, handing the couple an error for doing the only
          thing the screen offered. The deadline is the DB's own stamped value,
          never a recomputed window. */}
      {actions.withdraw ? (
        <span className="vact note">
          <Hourglass size={12} strokeWidth={1.9} aria-hidden />
          <span className="vact-note-txt">
            <b>{CARD_ASK_SENT}</b>
            <span>{waitingOnSupplier(lockRequestExpiresAt ?? null)}</span>
          </span>
        </span>
      ) : null}

      {actions.inquiry?.kind === 'inquire' ? (
        <ContactShortlistVendorButton
          eventId={eventId}
          vendorId={vendorId}
          label={CARD_INQUIRE}
          ariaLabel={cardInquireLabel(vendorName)}
          className="vact ghost"
          wrapperClassName="vact-slot"
          errorClassName="vact-err"
        />
      ) : actions.inquiry?.kind === 'check' ? (
        <Link
          href={`/dashboard/${eventId}/messages/${actions.inquiry.threadId}`}
          prefetch={false}
          className="vact ghost"
          aria-label={cardCheckInquiryLabel(vendorName)}
        >
          <MessageCircle size={12} strokeWidth={1.9} aria-hidden />
          {CARD_CHECK_INQUIRY}
        </Link>
      ) : null}

      {actions.withdraw ? (
        <WithdrawAskButton
          vendorId={vendorId}
          vendorName={vendorName}
          className="vact quiet"
          wrapperClassName="vact-slot"
          errorClassName="vact-err"
        />
      ) : null}

      {groupId ? (
        <AccordionLockButton
          eventId={eventId}
          groupId={groupId as PlanGroupId}
          groupLabel={groupLabel}
          vendorId={vendorId}
          vendorName={vendorName}
          label={CARD_LOCK}
          pendingLabel={CARD_LOCKING}
          className="vact quiet"
          wrapperClassName="vact-slot"
          isVerified={verifiedState ?? undefined}
        />
      ) : null}
    </div>
  );
}
