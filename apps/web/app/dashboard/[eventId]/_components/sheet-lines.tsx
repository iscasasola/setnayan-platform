/**
 * THE ADD SHEET'S LINES — one drawing for its three lists (services · inclusions · payments), copied from the approved
 * prototype `prototypes/makers_match_2026-11-07/makers-match.html` § 1 (`.lines` · `.line` · `.grip`, which are the
 * sign-up door's lines): ONE bordered box, a hairline between lines, a grip column on the left, 48px lines. Each line is
 * a `SwipeToDelete` row — swipe left to remove, Undo in the toast; there are no row buttons.
 */
import { GripVertical } from 'lucide-react';

/** The box the lines sit in. */
export const LINES_BOX_CLASS =
  'divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/15 bg-cream'; // no-card-ok: the lines editor's own box (prototype `.lines`)

/** A field inside a line — borderless; the line's box and hairlines are its frame (prototype `.line input`). */
export const LINE_INPUT_CLASS =
  'h-12 w-full min-w-0 border-0 bg-transparent px-1 text-[15px] text-ink placeholder:text-ink/45 focus:outline-none focus:ring-0 disabled:opacity-60';

/** The grip column — the swipe's handle, drawn; the whole line swipes. */
export function LineGrip() {
  return (
    <span aria-hidden className="inline-flex min-h-12 w-7 shrink-0 items-center justify-center self-stretch text-ink/45">
      <GripVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
    </span>
  );
}
