'use client';

/**
 * The fields of the claim-word editor on /admin/repost-watch, drawn by the house templates: a typed answer is the ONE
 * Field template (`TypedRow`, posting under `fieldName`), a set of choices is ONE dropdown (`PickMenu`, posting through
 * a hidden input). The server component around them holds the forms.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TypedRow } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export function PostedText({
  name,
  fieldName,
  maxLength,
  placeholder,
  required = false,
  data,
}: {
  name: string;
  fieldName: string;
  maxLength: number;
  placeholder: string;
  required?: boolean;
  data: string;
}) {
  const [value, setValue] = useState('');
  return (
    <TypedRow
      name={name}
      value={value}
      required={required}
      maxLength={maxLength}
      empty={required ? 'Add' : 'Optional'}
      placeholder={placeholder}
      fieldName={fieldName}
      onKeep={(t) => setValue(t)}
      data={data}
    />
  );
}

export function PostedPick({
  label,
  fieldName,
  empty,
  options,
  data,
}: {
  label: string;
  fieldName: string;
  empty: string;
  options: { key: string; label: string }[];
  data: string;
}) {
  const [value, setValue] = useState('');
  const current = options.find((o) => o.key === value);
  return (
    <>
      <input type="hidden" name={fieldName} value={value} />
      <PickMenu
        label={label}
        value={value}
        options={options}
        onPick={(k) => setValue(k)}
        dataAttr={`data-${data}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink/[0.06] px-4 text-sm text-ink"
        trigger={
          <>
            <span className="truncate">{current?.label ?? empty}</span>
            <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
          </>
        }
      />
    </>
  );
}
