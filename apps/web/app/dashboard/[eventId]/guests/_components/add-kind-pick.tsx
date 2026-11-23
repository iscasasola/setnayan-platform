'use client';

import { ChevronDown } from 'lucide-react';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/**
 * 👉 THE BOX'S "Guest ▾ / Walk ▾" PICK (Guests redesign drawing § 2, owner 20 Nov 2026 pick 2: *"While adding, the box's
 * right end is a small 'Guest ▾ / Table ▾ / Walk ▾' pick that holds the other ways to add"*). ONE piece for every view
 * whose thumb-row box adds (`ThumbField.dragAdd.kind`): the List's "Guest ▾" (From your people · Import a file) and
 * March's "Walk ▾" (New group · the "Not walking" names). The first option is the word itself — picking it changes
 * nothing; every other option is the caller's own shipped door.
 */
export function AddKindPick({
  word,
  options,
  onPick,
  dataAttr,
}: {
  /** What the box adds — "Guest", "Walk". */
  word: string;
  /** The other ways to add, each a shipped door. */
  options: readonly PickOption[];
  onPick: (key: string) => void;
  dataAttr: `data-${string}`;
}) {
  const self = word.toLowerCase();
  return (
    <PickMenu
      label="What to add"
      value={self}
      options={[{ key: self, label: word, group: 'Add' }, ...options]}
      onPick={(k) => {
        if (k !== self) onPick(k);
      }}
      dataAttr={dataAttr}
      buttonText={word}
      trigger={
        <span data-kind-face="">
          {word}
          <ChevronDown aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      }
    />
  );
}
