'use client';

/**
 * The new event type's Name in Admin › Work › Event types › Add — a row of the ONE Field template (`TypedRow`, owner
 * 1 Nov 2026: every field follows it), so the server-drawn Work row gets the template without a raw box. Keeping the
 * words only holds them on screen; `fieldName` posts them as `label_en` with the row's form, exactly as the raw box did.
 */
import { useState } from 'react';
import { FormRows, TypedRow } from '@/app/_components/form-row';

export function EventTypeNameRow({ initial }: { initial: string }) {
  const [label, setLabel] = useState(initial);
  return (
    <FormRows width="wide">
      <TypedRow
        name="Name"
        about={{ words: 'As people will see it. Its supplier coverage opens here next.' }}
        value={label}
        required
        maxLength={80}
        fieldName="label_en"
        onKeep={(t) => setLabel(t)}
      />
    </FormRows>
  );
}
