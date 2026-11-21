import { Check, ChevronDown, Eye, FileText, Info, Share, X } from 'lucide-react';
import { OpenFileLink } from '@/app/_components/open-file-link';
import { actionButtonClass } from '@/components/action-button-class';
import { formatFileSize, statusLabel, type VendorContractRow } from '@/lib/contracts';
import { SubmitButton } from '@/app/_components/submit-button';
import { cancelContract, publishContractToCouple } from '../actions';
import { formatCalendarDate } from '@/lib/events';
import { StayForm } from '@/app/_components/stay-form';
import { PostedFieldRow } from '@/app/admin/_components/posted-field-row';
import { ShopPill } from '../../_components/kit';
import {
  PartFoot,
  PartList,
  PartNote,
  PartPage,
  PartPin,
  PartRow,
  PartSec,
  PartText,
  PartTop,
  setTwo,
} from '../../_components/set-two/parts';
import { ReadFailedBody } from '../../_components/set-two/read-failed';

const ROUTE = '/vendor-dashboard/contracts/[contractId]';
const PUBLISH_FORM = 'contract-publish';

/** The read failed: the shell and the title stay, and say so (Try again re-runs the read). */
export function ContractReadFailed({ contractId }: { contractId: string }) {
  return (
    <PartPage column="mx-auto w-full tab:max-w-3xl" mark="contract">
      <PartPin route={ROUTE} params={{ contractId }} title="Contract" />
      <ReadFailedBody mark="contract">We couldn&rsquo;t load this contract right now.</ReadFailedBody>
    </PartPage>
  );
}

/** The opened contract — drawn from the page's reads, nothing fetched here (the lab draws it from fixtures). */
export function ContractBody({
  contract,
  event,
  eventFailed,
}: {
  contract: VendorContractRow;
  event: { display_name: string | null; event_date: string | null } | null;
  eventFailed: boolean;
}) {
  const contractId = contract.contract_id;
  const isDraft = contract.status === 'draft';
  const isVisible = contract.status === 'sent_for_signature' || contract.status === 'fully_signed';
  const isCancelled = contract.status === 'cancelled';

  return (
    <PartPage column="mx-auto w-full tab:max-w-3xl" mark="contract">
      <PartPin
        route={ROUTE}
        params={{ contractId }}
        title="Contract"
        end={
          <>
            <ShopPill tone={isVisible ? 'success' : isCancelled ? 'danger' : 'ink'}>{statusLabel(contract.status)}</ShopPill>
          </>
        }
      />

      <PartTop title={contract.title}>
        <p>
          For{' '}
          <strong>
            {eventFailed ? 'an event we couldn’t load just now' : (event?.display_name ?? 'Unknown event')}
          </strong>
          {event?.event_date
            ? ` · ${formatCalendarDate(event.event_date, { year: 'numeric', month: 'short', day: 'numeric' })}`
            : null}
        </p>
      </PartTop>
      {contract.description ? <PartNote>{contract.description}</PartNote> : null}

      <PartSec>Contract file</PartSec>
      <PartList>
        <PartRow
          icon={FileText}
          title={contract.file_name}
          sub={`${formatFileSize(contract.file_size_bytes)} · PDF`}
          end={
            <OpenFileLink
              href={contract.file_url}
              target="_blank"
              rel="noreferrer"
              className={actionButtonClass('info', { extra: '!min-h-9 !text-[13px]' })}
            >
              <Share aria-hidden strokeWidth={1.75} />
              <span>View / download</span>
            </OpenFileLink>
          }
        />
      </PartList>

      {/* Hosting-only disclosure */}
      <PartNote icon={Info}>
        Setnayan hosts this PDF for the couple to reference — we do not facilitate signing. Handle signatures externally
        (email, in-person, your own e-sig tool) and keep the signed copy with your records.
      </PartNote>

      {isDraft ? (
        <>
          <PartSec>Share with the couple</PartSec>
          <PartText>
            Right now only you can see this. Make it visible so the couple can view and download it from their
            dashboard.
          </PartText>
        </>
      ) : null}

      {isVisible ? (
        <PartNote tone="ok" icon={Check} role="status">
          The couple can see this contract in their dashboard.
        </PartNote>
      ) : null}

      {/* Cancel — available except when already cancelled. A closed row in the danger word; it opens in place. */}
      {!isCancelled ? (
        <PartList className="mt-3">
          <details className={setTwo.fold} data-contract-cancel="">
            <summary className={setTwo.row}>
              <span aria-hidden className={`${setTwo.rowIcon} ${setTwo.rowIconDanger}`}>
                <X strokeWidth={1.75} />
              </span>
              <span className={setTwo.rowBody}>
                <b className={`${setTwo.rowTitle} ${setTwo.danger}`}>Cancel this contract</b>
              </span>
              <ChevronDown aria-hidden className={`${setTwo.go} ${setTwo.foldChevron}`} strokeWidth={1.75} />
            </summary>
            <div className={setTwo.foldBody}>
              <p className="mb-3 text-[13px] text-[color:var(--m-slate-2)]">
                Removes the contract from the couple&rsquo;s view. The file stays in our records for audit but is not
                shown anywhere else.
              </p>
              <StayForm door="svContracts.cancelContract" action={cancelContract} className="space-y-2">
                <input type="hidden" name="contract_id" value={contract.contract_id} />
                <PostedFieldRow
                  name="Reason (optional, ≤500 characters)"
                  fieldName="reason"
                  empty="Couple changed terms / pricing renegotiated / etc."
                  long
                  maxLength={500}
                />
                <div className="flex justify-end">
                  <SubmitButton className={actionButtonClass('danger')} pendingLabel="Cancelling…">
                    <X aria-hidden strokeWidth={2} />
                    <span>Cancel contract</span>
                  </SubmitButton>
                </div>
              </StayForm>
            </div>
          </details>
        </PartList>
      ) : null}

      {isCancelled && contract.cancelled_at ? (
        <PartNote tone="danger" icon={X}>
          Cancelled on{' '}
          {new Date(contract.cancelled_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
          {contract.cancelled_reason ? ` — ${contract.cancelled_reason}` : '.'}
        </PartNote>
      ) : null}

      {/* Make visible — the one main button, in the thumb zone (from 701, the right of the pinned bar). */}
      {isDraft ? (
        <StayForm id={PUBLISH_FORM} door="svContracts.publishContractToCouple" action={publishContractToCouple}>
          <input type="hidden" name="contract_id" value={contract.contract_id} />
          <PartFoot mark="contract-publish" label="Contract actions">
            <SubmitButton form={PUBLISH_FORM} className={actionButtonClass('brand', { main: true, extra: 'w-full tab:w-auto' })} pendingLabel="Sharing…">
              <Eye aria-hidden strokeWidth={1.75} />
              <span>Make visible to couple</span>
            </SubmitButton>
          </PartFoot>
        </StayForm>
      ) : null}
    </PartPage>
  );
}
