'use client';

/**
 * A ▾ pick that POSTS — the house `PickMenu` plus one hidden input, so a server-action form keeps the exact field it
 * always read (design template 14 Nov 2026, rule 4: a pick is the ▾ that opens its choices, never a native dropdown).
 * The same shape as T09's `vendors/_components/reuse-request-form.tsx`, for a form that stays a server component.
 * An option's `group` draws the heading a native `<optgroup>` drew.
 */
import { useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';

export function PostedPick({
  name,
  label,
  options,
  initial = '',
  className = '',
}: {
  /** The form field the server action reads. */
  name: string;
  /** The ▾'s accessible name, and its words while nothing is chosen. */
  label: string;
  options: PickOption[];
  initial?: string;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <span className={className}>
      <input type="hidden" name={name} value={value} />
      <PickMenu
        label={label}
        value={value}
        options={options}
        onPick={setValue}
        dataAttr={`data-posted-pick-${name}`}
        className="w-full !min-h-12"
      />
    </span>
  );
}
