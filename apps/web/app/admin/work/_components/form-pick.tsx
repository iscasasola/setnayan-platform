'use client';

/**
 * FormPick — the house dropdown (`PickMenu`) carrying ONE posted field (admin supplier slice, 2026-10-28). Any set of
 * choices is one dropdown, never a raw `<select>`. The value rides a hidden input, with `form=` so a dropdown drawn
 * beside two buttons can belong to the second form only (Needs a fix posts the reason; Approve posts none).
 * Same shape as `app/_components/decline-reason-fields.tsx`.
 */
import { useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export function FormPick({
  name,
  form,
  label,
  placeholder,
  options,
  dataAttr,
}: {
  name: string;
  /** The `<form id>` the value belongs to. */
  form: string;
  label: string;
  /** What the button says before anything is picked. */
  placeholder: string;
  options: ReadonlyArray<{ key: string; label: string }>;
  dataAttr: string;
}) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <>
      <input type="hidden" name={name} form={form} value={value ?? ''} />
      <PickMenu
        label={label}
        value={value}
        options={options}
        onPick={setValue}
        buttonText={value ? (options.find((o) => o.key === value)?.label ?? placeholder) : placeholder}
        dataAttr={dataAttr}
        className="min-h-11 max-w-[320px]"
      />
    </>
  );
}
