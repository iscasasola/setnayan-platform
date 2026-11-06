'use client';

import { useState } from 'react';

import { FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { MODERATION_REASON_MAX, MODERATION_REASON_MIN } from '@/lib/service-card-moderation';
import { moderateServiceCard } from '../card-actions';

/**
 * A take-down or a photo removal: the reason (the ONE Field template,
 * `TypedRow`, posting `reason`) and the button. A missing or too-short reason
 * shakes into view and nothing is sent; the server checks it again
 * (`parseModerationReason`).
 */
export function CardReasonForm({
  op,
  shopId,
  cardId,
  slot,
  photoKey,
  label,
  note,
  submit,
}: {
  op: 'take_down' | 'remove_photo';
  shopId: string;
  cardId: string;
  slot?: 'cover' | 'showcase';
  photoKey?: string;
  label: string;
  note?: string;
  submit: string;
}) {
  const [reason, setReason] = useState('');
  return (
    <form
      action={moderateServiceCard}
      className="mt-2 space-y-2"
      onSubmit={(event) => {
        if (nudgeFormRows(event.currentTarget) > 0) event.preventDefault();
      }}
    >
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="vendor_profile_id" value={shopId} />
      <input type="hidden" name="vendor_service_id" value={cardId} />
      {slot ? <input type="hidden" name="slot" value={slot} /> : null}
      {photoKey ? <input type="hidden" name="photo_key" value={photoKey} /> : null}
      <FormRows width="wide">
        <TypedRow
          name={label}
          value={reason}
          required
          long
          boxed
          empty="Write the reason"
          placeholder="The supplier reads this word for word."
          maxLength={MODERATION_REASON_MAX}
          check={(t) =>
            t.trim().length < MODERATION_REASON_MIN
              ? `Write at least ${MODERATION_REASON_MIN} characters — the supplier reads this.`
              : null
          }
          fieldName="reason"
          onKeep={(t) => setReason(t)}
          data={`card-reason-${op}`}
        />
      </FormRows>
      {note ? <p className="text-xs text-ink/60">{note}</p> : null}
      <button
        type="submit"
        className="inline-flex min-h-[44px] items-center rounded-lg bg-danger-100 px-4 text-sm font-medium text-danger-900 hover:bg-danger-200"
      >
        {submit}
      </button>
    </form>
  );
}
