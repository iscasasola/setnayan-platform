'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { DetailsItemKey } from '@/lib/maker-details-items';

/**
 * 🧭 ONE ITEM OF DETAILS OPENS ANOTHER — in place (owner rule: *"no 'Edit in X
 * ↗' link-outs — the field sits where you are"*). A note like "Build your Mood
 * Board first" used to be a link out of the Maker to `/studio/mood-board`;
 * since Details part 3 the Mood Board is an item of Details, so the note picks
 * that item instead. `DetailsWorkspace` provides the picker; outside Details it
 * is null and the button is not drawn (a door that does nothing is not a door).
 */
export const DetailsSelectContext = createContext<((key: DetailsItemKey) => void) | null>(null);

export function DetailsGoTo({ item, children, className = '' }: { item: DetailsItemKey; children: ReactNode; className?: string }) {
  const select = useContext(DetailsSelectContext);
  if (!select) return null;
  return (
    <button
      type="button"
      data-details-go={item}
      onClick={() => select(item)}
      className={`sn-press inline-flex min-h-11 items-center text-left underline underline-offset-2 ${className}`}
    >
      {children}
    </button>
  );
}
