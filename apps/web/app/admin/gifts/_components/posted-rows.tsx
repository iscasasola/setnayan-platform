'use client';

/**
 * The gifts page's posted Form rows (admin clean port, owner "ok" 19 Nov 2026 — reposition only).
 *
 * Every grant form on /admin/gifts is a plain server-action `<form>`; these two shells let the house rows
 * (`TypedRow`, `ChosenRow` — app/_components/form-row.tsx) sit in it and POST exactly what the old raw boxes, selects
 * and radio sets posted: the same `name`, the same values. A server component cannot hand a row its `onKeep` /
 * `onPick`, so each shell owns its own state (the same move as `take-back-reason-field.tsx` and
 * `app/admin/_components/posted-field-row.tsx`, which has no placeholder — the old boxes' hint words are kept here).
 */
import { useState } from 'react';
import { ChosenRow, TypedRow, type FormRowAbout } from '@/app/_components/form-row';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';

/** A typed answer posted as `fieldName` (its hint words kept as the field's placeholder). */
export function PostedTypedRow({
  name,
  fieldName,
  placeholder,
  about,
  long = false,
  maxLength,
  required = false,
  data,
}: {
  name: string;
  fieldName: string;
  placeholder?: string;
  about?: FormRowAbout;
  long?: boolean;
  maxLength?: number;
  required?: boolean;
  data?: string;
}) {
  const [value, setValue] = useState('');
  return (
    <TypedRow
      name={name}
      about={about}
      value={value}
      placeholder={placeholder}
      long={long}
      maxLength={maxLength}
      required={required}
      fieldName={fieldName}
      onKeep={(t) => setValue(t)}
      data={data}
    />
  );
}

/**
 * A set of choices as ONE dropdown, posted as `fieldName` — what a `<select>` or a radio set posted.
 * `blankKey`: the option that posts an EMPTY value (a select's `<option value="">`).
 */
export function PostedPickRow({
  name,
  fieldName,
  options,
  initial,
  about,
  blankKey,
  data,
}: {
  name: string;
  fieldName: string;
  options: readonly PickOption[];
  initial: string;
  about?: FormRowAbout;
  blankKey?: string;
  data?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ChosenRow name={name} about={about} value={value} options={options} onPick={setValue} data={data} />
      <input type="hidden" name={fieldName} value={blankKey !== undefined && value === blankKey ? '' : value} />
    </>
  );
}
