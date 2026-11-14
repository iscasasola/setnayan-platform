'use client';

/**
 * FieldPick — a native `<select>` in a SERVER form, redrawn as the house ▾ dropdown (`PickMenu`). Design template
 * 14 Nov 2026, rule 4: a pick is the ▾ that opens its choices, never a native dropdown.
 *
 * The value rides a hidden input under the same `name`, so the form, its GET filter or its server action read exactly
 * what the `<select>` posted. `required` is kept: an empty pick still stops the submit (a hidden input cannot be
 * required, so a visually hidden twin carries the browser's own check).
 */
import { useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export function FieldPick({
  name,
  label,
  options,
  defaultValue = '',
  placeholder,
  required = false,
  form,
  dataAttr,
  className = 'min-h-11 min-w-[12rem]',
}: {
  name: string;
  /** What the control is, for a screen reader. */
  label: string;
  options: ReadonlyArray<{ key: string; label: string }>;
  defaultValue?: string;
  /** What the button says while nothing is picked. */
  placeholder?: string;
  required?: boolean;
  form?: string;
  dataAttr?: string;
  className?: string;
}) {
  const [value, setValue] = useState<string>(defaultValue);
  const picked = options.find((o) => o.key === value);
  return (
    <>
      <input type="hidden" name={name} form={form} value={value} />
      {required ? (
        <input // field-ok: not a typed box — the invisible twin that carries the browser's required check for the ▾ pick
          tabIndex={-1}
          aria-hidden="true"
          required
          form={form}
          value={value}
          onChange={() => undefined}
          className="sr-only"
        />
      ) : null}
      <PickMenu
        label={label}
        value={value || null}
        options={options}
        onPick={setValue}
        buttonText={picked ? undefined : (placeholder ?? label)}
        dataAttr={dataAttr}
        className={className}
      />
    </>
  );
}
