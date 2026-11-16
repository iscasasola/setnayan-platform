import { InfoTip } from '@/app/_components/info-tip';
import { findLockAdminLine, type FindLockState } from '@/lib/findable-shop';

/**
 * 🔎 WHETHER COUPLES CAN FIND THIS SHOP — DECISION_LOG 2026-11-15 "AN UNVERIFIED SHOP HAS THE SAME WEBSITE AS A
 * VERIFIED ONE" + the owner's "Verified only" (supersedes 2026-11-07 "findable until its first inquiry", and with it the
 * "Lift the lock" pill: no lock decides anything any more, so there is nothing to lift).
 *
 * One line from `findLockState` (lib/findable-shop.ts, the same rule every couple-facing list asks), details in the ⓘ.
 */
export function FindLine({ state }: { vendorProfileId?: string; state: FindLockState; liftedAt?: string | null }) {
  const tone = state.state === 'not_findable' ? 'text-ink/55' : state.state === 'until_verified' ? 'text-warn-900' : 'text-success-800';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-find-line={state.state}>
      <div className={`min-w-0 text-xs ${tone}`}>
        <InfoTip label={findLockAdminLine(state)} labelClassName="text-xs" align="start">
          {state.state === 'until_verified'
            ? 'Not verified yet, so it is not in Discover, Suppliers › Find or suggestions. Its own page link and QR codes open, and couples there can message and book it (the booking fee applies).'
            : state.state === 'verified'
              ? 'Verified shops are found in Discover and Suppliers › Find, with the badge.'
              : 'Rejected, demoted, archived or frozen — couples cannot find it, and its page does not open.'}
        </InfoTip>
      </div>
    </div>
  );
}
