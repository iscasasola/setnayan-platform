'use client';

/**
 * The one typed answer of a booking-fee dispute — the supplier's "What happened?" and the admin's note back — drawn
 * with the house Field template (`TypedRow`, owner 1 Nov 2026: every field follows it). Inside the dispute `<form>`
 * it posts its kept words under `fieldName`, exactly as a raw box would. Optional: a blank posts nothing and the
 * dispute still goes (a blank never blocks).
 */
import { useState } from 'react';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { DISPUTE_TEXT_MAX } from '@/lib/booking-fee-dispute';

export function DisputeNoteField({ name, empty, fieldName }: { name: string; empty: string; fieldName: string }) {
  const [text, setText] = useState('');
  return (
    <FormRows width="wide">
      <TypedRow
        name={name}
        value={text}
        empty={empty}
        long
        maxLength={DISPUTE_TEXT_MAX}
        fieldName={fieldName}
        onKeep={(t) => setText(t)}
      />
    </FormRows>
  );
}
