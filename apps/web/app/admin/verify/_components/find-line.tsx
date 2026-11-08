import { ConfirmForm } from '@/app/_components/confirm-form';
import { InfoTip } from '@/app/_components/info-tip';
import { SubmitButton } from '@/app/_components/submit-button';
import { findLockAdminLine, type FindLockState } from '@/lib/findable-shop';
import { liftFindLock } from '../actions';

/**
 * 🔎 WHETHER COUPLES CAN FIND THIS SHOP — and the lift (DECISION_LOG 2026-11-07
 * "AN UNVERIFIED SHOP IS FINDABLE UNTIL ITS FIRST INQUIRY", ruling (7)).
 *
 * One line from `findLockState` (lib/findable-shop.ts, the same rule every
 * couple-facing list asks), details in the ⓘ. A locked shop gets ONE green
 * confirm pill, "Lift the lock", behind the house confirm dialog: it saves in
 * place and the next inquiry locks the shop again.
 */
export function FindLine({
  vendorProfileId,
  state,
  liftedAt,
}: {
  vendorProfileId: string;
  state: FindLockState;
  liftedAt: string | null;
}) {
  const since = state.state === 'locked' ? formatShortDate(state.since) : null;
  const lifted = liftedAt ? formatShortDate(liftedAt) : null;
  const tone =
    state.state === 'locked'
      ? 'text-warn-900'
      : state.state === 'not_findable'
        ? 'text-ink/55'
        : 'text-success-800';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-find-line={state.state}>
      <div className={`min-w-0 text-xs ${tone}`}>
        <InfoTip
          label={`${findLockAdminLine(state)}${since ? ` · ${since}` : ''}`}
          labelClassName="text-xs"
          align="start"
        >
          {state.state === 'locked'
            ? `A shop Setnayan has not verified yet is shown to couples until its first inquiry. This one ${
                state.reason === 'import' ? 'brought in its first customer through its own invite' : 'had its first inquiry'
              } on ${since}, so it is out of search, Suppliers › Find and suggestions until it is verified. Its own page link and QR codes still open. Lift the lock if the ${
                state.reason === 'import' ? 'import' : 'inquiry'
              } was a mistake — the next inquiry locks it again.`
            : state.state === 'findable_until_first_inquiry'
              ? `Not verified yet, so couples find it only until its first inquiry. That inquiry — or a customer it imports — takes it out of Find until it is verified.${
                  lifted ? ` A lock was last lifted on ${lifted}.` : ''
                }`
              : state.state === 'verified'
                ? 'Verified shops are always found, with the badge.'
                : 'Rejected, demoted, archived or frozen — couples cannot find it for that reason, not because of a lock.'}
        </InfoTip>
      </div>
      {state.state === 'locked' ? (
        <ConfirmForm
          action={liftFindLock}
          title="Lift the lock?"
          confirmLabel="Lift the lock"
          destructive={false}
          message="Couples will find this shop again in search and Suppliers › Find. Its next inquiry locks it again until it is verified."
        >
          <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
          <SubmitButton
            pendingLabel="Lifting…"
            className="inline-flex min-h-[44px] items-center rounded-full bg-success-600 px-4 text-xs font-semibold text-white dark:text-cream hover:bg-success-700"
          >
            Lift the lock
          </SubmitButton>
        </ConfirmForm>
      ) : null}
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
}
