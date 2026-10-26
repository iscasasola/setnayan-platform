'use client';

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
  { key: 'share', label: 'Share & export' },
] as const;
export type MoodBoardPart = (typeof MOOD_BOARD_PARTS)[number]['key'];
const FIRST: MoodBoardPart = 'theme';

function usePart(): [MoodBoardPart, (p: MoodBoardPart) => void] {
  const [piece, setPiece] = useDetailsPiece('mood-board');
  const on = (MOOD_BOARD_PARTS.find((p) => p.key === piece)?.key ?? FIRST) as MoodBoardPart;
  return [on, (p) => setPiece(p)];
}

/** The navigator's rows (a desk) / chips (a phone). */
export function MoodBoardPieces() {
  const [on, pick] = usePart();
  return (
    <>
      {MOOD_BOARD_PARTS.map((p) => (
        <DetailsPieceButton key={p.key} on={on === p.key} data={`mood-board:${p.key}`} onPick={() => pick(p.key)}>
          {p.label}
        </DetailsPieceButton>
      ))}
    </>
  );
}
