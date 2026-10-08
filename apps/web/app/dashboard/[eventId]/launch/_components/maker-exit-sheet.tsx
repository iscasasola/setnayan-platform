'use client';

import { useEffect } from 'react';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import { MakerSheet } from './stages-studio-parts';

/**
 * ✕ THE MAKER'S WAY OUT — TWO DOORS, TWO TAPS (owner, live at 896 px, verbatim: *"why can't i go back to
 * events?"* → told his options: *"Okay, fix the three step."*).
 *
 * The Maker is a full-screen layer over the app's own top bar and rail, so the "Events" link they hold is covered;
 * ✕ went to this event's page, and Events was two more taps from there — three, against "everything in less than
 * 3 taps". ✕ now opens the Maker's ONE bottom sheet (`MakerSheet`, the sheet every pop-up of the new Maker uses)
 * with exactly two doors: **Back to this event** — where ✕ always went — and **All events**.
 *
 * Nothing here writes, and leaving loses nothing: the draft is on the server. When it has changes that are not
 * applied yet, one line says they are kept — from the draft bar's own count (`MakerDraftDoor.count`), never a
 * number of this sheet's making. Escape and a tap on the dimmed page close the sheet; neither leaves the Maker.
 *
 * Lazy (`details-lazy.tsx`): the Maker's first load carries the button and its open/closed state, nothing more.
 */

/** The line that says the draft is kept — null when there is nothing unapplied to keep. */
export function makerExitDraftLine(changes: number): string | null {
  if (!Number.isFinite(changes) || changes < 1) return null;
  const n = Math.floor(changes);
  return n === 1 ? 'Your 1 change is saved as a draft.' : `Your ${formatCount(n)} changes are saved as a draft.`;
}

/** Where each door goes. `eventId` is the Maker's own (already a checked route segment). */
export function makerExitDoors(eventId: string): ReadonlyArray<{ key: 'event' | 'events'; label: string; href: string }> {
  return [
    { key: 'event', label: 'Back to this event', href: `/dashboard/${eventId}` },
    { key: 'events', label: 'All events', href: '/dashboard' },
  ];
}

export function MakerExitSheet({ eventId, changes, onClose }: { eventId: string; changes: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const line = makerExitDraftLine(changes);
  return (
    <MakerSheet label="Leave the Maker" onClose={onClose} everyWidth>
      <div data-maker-exit="" className="flex flex-col gap-2 px-2 pb-1">
        {line ? (
          <p data-maker-exit-draft="" className="px-1 pb-1 text-[13px] leading-snug text-ink/70">
            {line}
          </p>
        ) : null}
        {makerExitDoors(eventId).map((d) => (
          <ActionButton key={d.key} tone="neutral" icon={d.key === 'event' ? ArrowLeft : LayoutGrid} label={d.label} href={d.href} className="w-full justify-start" data-testid={`maker-exit-${d.key}`} />
        ))}
      </div>
    </MakerSheet>
  );
}
