'use client';

import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { ActionButton, EqualRow } from '@/components/action-button';
import { actionButtonClass } from '@/components/action-button-class';
import { ChosenRow, FormRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { SubmitButton } from '@/app/_components/submit-button';
import { PartFoot, PartList, setTwo } from '../../_components/set-two/parts';

/**
 * The upload form of `contracts/new`, on the November look (supplier pages set two, frame "Phone · upload a contract"):
 * label left, the answer's pill right — the house form rows (`FormRows` · `ChosenRow` · `TypedRow`). The arrow
 * chooses, the pen types, the up-arrow opens the file picker in place. "Required" is the accent word (the rows' own).
 * Every field, limit and placeholder is the shipped page's: event (required) · title ≤ 200 (required) · description
 * ≤ 2,000 · the PDF (required, PDF only, the size limit). The rows post under the names `uploadVendorContract` reads.
 */
const FORM = 'contract-upload';

export function ContractUploadForm({
  action,
  events,
  initialEventId,
  maxSizeLabel,
  cancelHref,
}: {
  action: (formData: FormData) => void | Promise<void>;
  events: ReadonlyArray<{ id: string; title: string }>;
  initialEventId: string;
  maxSizeLabel: string;
  /** Where Cancel goes — the page's home on the one back map (Customers › Money › Contracts). */
  cancelHref: string;
}) {
  const [eventId, setEventId] = useState(initialEventId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');

  return (
    <form id={FORM} action={action} data-contract-upload="">
      <input type="hidden" name="event_id" value={eventId} />
      <PartList>
        <FormRows width="wide">
          <ChosenRow
            name="For which event?"
            value={eventId || null}
            buttonText={eventId ? undefined : 'Pick an event…'}
            options={events.map((e) => ({ key: e.id, label: e.title }))}
            onPick={setEventId}
            data="contract-event"
            mark={eventId ? undefined : <span className="text-[11px] font-bold text-sn-accent">Required</span>}
          />
          <TypedRow
            name="Contract title"
            value={title}
            required
            empty="Wedding photography package — June 14, 2027"
            placeholder="Wedding photography package — June 14, 2027"
            maxLength={200}
            fieldName="title"
            onKeep={(t) => setTitle(t)}
            data="contract-title"
          />
          <TypedRow
            name="Description (optional)"
            value={description}
            long
            empty="Brief note for the couple (not on the contract PDF)."
            placeholder="Brief note for the couple (not on the contract PDF)."
            maxLength={2000}
            fieldName="description"
            onKeep={(t) => setDescription(t)}
            data="contract-description"
          />
          <FormRow name="Contract PDF" data="contract-file">
            <label className={`${setTwo.fldVal} ${setTwo.fileRow}`}>
              <span>{fileName || 'Choose a PDF'}</span>
              <Upload aria-hidden strokeWidth={1.75} />
              <input
                type="file"
                name="file"
                accept="application/pdf,.pdf"
                required
                aria-label="Contract PDF"
                onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? '')}
              />
            </label>
          </FormRow>
        </FormRows>
        <p className={setTwo.fldSub}>PDF only · max {maxSizeLabel}.</p>
      </PartList>
      <PartFoot mark="contract-upload" label="Upload actions">
        <EqualRow className="w-full">
          <ActionButton href={cancelHref} tone="neutral" icon={<X aria-hidden />} label="Cancel" />
          <SubmitButton form={FORM} className={actionButtonClass('brand', { main: true })} pendingLabel="Uploading…">
            <Upload aria-hidden strokeWidth={1.9} />
            <span>Upload draft</span>
          </SubmitButton>
        </EqualRow>
      </PartFoot>
    </form>
  );
}
