'use client';

import { TypedRow } from '@/app/_components/form-row';

/**
 * The house typed row (`TypedRow`, app/_components/form-row.tsx) for a field that is simply POSTED with its `<form>`
 * (`fieldName`) — nothing is saved on keep, so `onKeep` does nothing. A server component cannot hand a function
 * across, so this one-line client shell owns it. Used by Catalogue › Plan contents and the Person page's Account hold
 * (owner 2026-11-13).
 */
export function PostedFieldRow(props: {
  name: string;
  fieldName: string;
  empty?: string;
  long?: boolean;
  maxLength?: number;
  inputMode?: 'text' | 'numeric';
}) {
  return (
    <TypedRow
      name={props.name}
      value=""
      empty={props.empty}
      fieldName={props.fieldName}
      long={props.long}
      maxLength={props.maxLength}
      inputMode={props.inputMode}
      onKeep={() => undefined}
    />
  );
}
