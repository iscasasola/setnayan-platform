'use client';

/**
 * "Choose one of your cards" — the ONE dropdown (PickMenu), posting `vendor_service_id` from a hidden input so the
 * request page's form (a stay door) sends it exactly as the raw select did.
 *
 * The same shape serves any one-field pick that replaced a raw `<select>` (design template rule 4): `fieldName`,
 * `label`, `placeholder` and `initial` default to the request page's own values, so that call is byte-for-byte as it
 * shipped. `contracts/new` passes its event pick through it.
 */
import { useState } from 'react';

import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export function CardPick({
  cards,
  fieldName = 'vendor_service_id',
  label = 'Choose one of your cards',
  placeholder,
  initial = '',
}: {
  cards: ReadonlyArray<{ id: string; title: string }>;
  fieldName?: string;
  label?: string;
  /** What the button says before anything is picked (defaults to `label`). */
  placeholder?: string;
  /** A pre-picked value (a deep link's `?event=`). */
  initial?: string;
}) {
  const [picked, setPicked] = useState(initial);
  return (
    <>
      <input type="hidden" name={fieldName} value={picked} />
      <PickMenu
        label={label}
        value={picked || null}
        buttonText={picked ? cards.find((c) => c.id === picked)?.title : (placeholder ?? label)}
        options={cards.map((c) => ({ key: c.id, label: c.title }))}
        className="w-full border border-[color:var(--m-line)]"
        onPick={setPicked}
      />
    </>
  );
}
