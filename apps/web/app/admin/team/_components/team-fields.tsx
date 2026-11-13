'use client';

import { useState } from 'react';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';

/**
 * The fields the 2026-11-13 admin-team screens use (Team · Admin log ·
 * Approvals), drawn with the house templates: the ONE Field template
 * (`TypedRow`, posting under `fieldName` exactly as a raw box would) and
 * `PickMenu` in place of a raw <select>. Server pages stay server components
 * and drop these in.
 */

export function NoteField({
  fieldName,
  name,
  empty,
  placeholder,
  required = false,
  long = false,
  maxLength = 2000,
  initial = '',
  data,
}: {
  fieldName: string;
  name: string;
  empty: string;
  placeholder?: string;
  required?: boolean;
  long?: boolean;
  maxLength?: number;
  initial?: string;
  data: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <FormRows width="wide">
      <TypedRow
        name={name}
        value={value}
        required={required}
        long={long}
        boxed={long}
        empty={empty}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        fieldName={fieldName}
        onKeep={(t) => setValue(t)}
        data={data}
      />
    </FormRows>
  );
}

export function PickField({
  fieldName,
  label,
  options,
  initial,
  data,
}: {
  fieldName: string;
  label: string;
  options: readonly PickOption[];
  initial: string;
  data: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <input type="hidden" name={fieldName} value={value} />
      <PickMenu
        label={label}
        value={value}
        options={options}
        onPick={setValue}
        dataAttr={`data-${data}`}
        className="w-full !min-h-11"
      />
    </div>
  );
}
