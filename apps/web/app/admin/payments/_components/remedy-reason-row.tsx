'use client';

import { useState } from 'react';
import { FormRows, TypedRow } from '@/app/_components/form-row';

/**
 * The reason box on "Convert to Papic credits" / "Move to their next event"
 * (Admin › Payments) — the ONE Field template (`TypedRow`), posting `reason`
 * exactly as a raw box would. The server checks the 20 characters again; this
 * only says it sooner.
 */
export function RemedyReasonRow({ placeholder }: { placeholder: string }) {
  const [reason, setReason] = useState('');
  return (
    <FormRows width="wide">
      <TypedRow
        name="Reason"
        value={reason}
        long
        boxed
        required
        maxLength={2000}
        empty="Why — at least 20 characters"
        placeholder={placeholder}
        check={(t) => (t.trim().length >= 20 ? null : 'Write at least 20 characters.')}
        fieldName="reason"
        onKeep={(t) => setReason(t)}
      />
    </FormRows>
  );
}
