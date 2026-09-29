'use client';

import type { ReactNode } from 'react';
import { DetailsPieceButton, useDetailsPiece } from '@/app/dashboard/[eventId]/launch/_components/details-go';

/**
 * 🧩 THE MOOD BOARD'S PARTS, AS THE MAKER'S NAVIGATOR LISTS THEM (owner
 * 2026-09-29, DECISION_LOG "A TOOL MOVED INTO THE MAKER IS REBUILT INTO THE
 * THREE PARTS"): *"make sure they are just not link to another page but those
 * page are there making use of the 3 parts"*. The same sections the page stacks
 * (`mood-board-editor.tsx`), one at a time: the navigator picks a part, the
 * middle draws it (`MoodPart`), the right holds its controls.
 *
 * Every part stays MOUNTED — only the picked one shows — so the palette
 * provider around the theme, inspiration and palette keeps deriving live, and
 * nothing the couple typed is dropped by switching parts.
 */
export const MOOD_BOARD_PARTS = [
  { key: 'theme', label: 'Theme' },
  { key: 'inspiration', label: 'Inspiration' },
  { key: 'palette', label: 'Palette' },
  { key: 'reception', label: 'Reception' },
  { key: 'colours', label: 'In your colours' },
  { key: 'make-it-real', label: 'Make it real' },
  { key: 'share', label: 'Share & export' },
] as const;
export type MoodBoardPart = (typeof MOOD_BOARD_PARTS)[number]['key'];
const FIRST: MoodBoardPart = 'theme';

function usePart(): [MoodBoardPart, (p: MoodBoardPart) => void] {
  const [piece, setPiece] = useDetailsPiece('mood-board');
  const on = (MOOD_BOARD_PARTS.find((p) => p.key === piece)?.key ?? FIRST) as MoodBoardPart;
  return [on, (p) => setPiece(p)];
}

/** The navigator's rows (a desk) / chips (a phone). "Make it real" is left out where it is not sold. */
export function MoodBoardPieces({ makeItReal }: { makeItReal: boolean }) {
  const [on, pick] = usePart();
  return (
    <>
      {MOOD_BOARD_PARTS.filter((p) => makeItReal || p.key !== 'make-it-real').map((p) => (
        <DetailsPieceButton key={p.key} on={on === p.key} data={`mood-board:${p.key}`} onPick={() => pick(p.key)}>
          {p.label}
        </DetailsPieceButton>
      ))}
    </>
  );
}

/** One part, shown while it is the picked one — hidden (never unmounted) otherwise. */
export function MoodPart({ part, children }: { part: MoodBoardPart; children: ReactNode }) {
  const [on] = usePart();
  return (
    <div data-mood-part={part} hidden={on !== part} className={on === part ? 'block' : 'hidden'}>
      {children}
    </div>
  );
}

/** The right column for a part whose controls are the part itself (the theme, the inspirations…). */
export function MoodPartNote() {
  const [on] = usePart();
  if (on === 'palette' || on === 'reception' || on === 'share') return null;
  const note: Record<string, string> = {
    theme: 'Describe your look or pick a starting theme — your main colours set the whole palette.',
    inspiration: 'Your photos feed your palette and your renders. Drag one onto another slot to reorder.',
    colours: 'A quick look at your palette on real things. Change a colour under Palette and this follows.',
    'make-it-real': 'Photo-real renders of your look, from your palette, reception and inspirations.',
  };
  return <p className="text-[13px] text-ink/70" data-mood-part-note={on}>{note[on]}</p>;
}
