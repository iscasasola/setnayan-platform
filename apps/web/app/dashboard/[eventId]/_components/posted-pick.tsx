'use client';

/**
 * A ▾ pick that POSTS — the house `PickMenu` plus one hidden input, so a server-action form keeps the exact field it
 * always read (design template 14 Nov 2026, rule 4: a pick is the ▾ that opens its choices, never a native dropdown).
 * The same shape as T09's `vendors/_components/reuse-request-form.tsx`, for a form that stays a server component.
 * An option's `group` draws the heading a native `<optgroup>` drew. `many` is the native `<select multiple>`: the list
 * gets checkmarks (PickMenu's `picked`) and each ticked value posts as its own hidden input under the same name, which
 * is exactly what a multiple select posted (`formData.getAll(name)` reads both the same).
 */
import { useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';

export function PostedPick({
  name,
  label,
  options,
  initial = '',
  many = false,
  initialMany = [],
  className = '',
}: {
  /** The form field the server action reads. */
  name: string;
  /** The ▾'s accessible name, and its words while nothing is chosen. */
  label: string;
  options: PickOption[];
  initial?: string;
  /** Tick several (a native `<select multiple>`). */
  many?: boolean;
  initialMany?: readonly string[];
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [ticked, setTicked] = useState<readonly string[]>(initialMany);
  if (many) {
    const words = options.filter((o) => ticked.includes(o.key)).map((o) => o.label);
    return (
      <span className={className}>
        {ticked.map((k) => (
          <input key={k} type="hidden" name={name} value={k} />
        ))}
        <PickMenu
          label={label}
          value={null}
          options={options}
          picked={ticked}
          onPick={(k) => setTicked((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]))}
          buttonText={words.length ? words.join(', ') : label}
          dataAttr={`data-posted-pick-${name}`}
          className="w-full !min-h-12"
        />
      </span>
    );
  }
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
