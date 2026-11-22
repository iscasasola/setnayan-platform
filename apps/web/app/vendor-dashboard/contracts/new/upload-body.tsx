import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { uploadVendorContract } from '../actions';
import { formatFileSize, CONTRACT_MAX_BYTES } from '@/lib/contracts';
import { PartNote, PartPage, PartPin } from '../../_components/set-two/parts';
import { ReadFailedBody } from '../../_components/set-two/read-failed';
import { ContractUploadForm } from './upload-form';
import { pageBackLink } from '@/lib/page-home';

const ROUTE = '/vendor-dashboard/contracts/new';

/** Upload a contract, drawn from the page's reads (the lab draws it from fixtures). `eventOptions: null` = unread. */
export function UploadContractBody({
  eventOptions,
  defaultEventId,
}: {
  eventOptions: ReadonlyArray<{ id: string; title: string }> | null;
  defaultEventId: string;
}) {
  return (
    <PartPage column="mx-auto w-full tab:max-w-3xl" mark="contract-upload">
      <PartPin
        route={ROUTE}
        title={
          <InfoTip label="Upload a contract" align="end">
            {`PDF only, up to ${formatFileSize(CONTRACT_MAX_BYTES)}. After upload you can review it.`}
          </InfoTip>
        }
      />

      {eventOptions === null ? (
        <ReadFailedBody mark="contract-conversations">
          We couldn&rsquo;t load your conversations, so your couples can&rsquo;t be listed yet.
        </ReadFailedBody>
      ) : eventOptions.length === 0 ? (
        <PartNote tone="warn" icon={MessageSquare} mark="contract-no-couple">
          You need to be in conversation with a couple before uploading a contract. Open a chat with a couple from
          your{' '}
          <Link href="/vendor-dashboard/messages" className="font-semibold underline">
            messages
          </Link>{' '}
          first.
        </PartNote>
      ) : (
        <ContractUploadForm
          action={uploadVendorContract}
          events={eventOptions}
          initialEventId={defaultEventId}
          maxSizeLabel={formatFileSize(CONTRACT_MAX_BYTES)}
          cancelHref={pageBackLink(ROUTE)?.href ?? '/vendor-dashboard'}
        />
      )}
    </PartPage>
  );
}
