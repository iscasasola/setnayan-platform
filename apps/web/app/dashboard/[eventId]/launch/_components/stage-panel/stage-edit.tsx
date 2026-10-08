'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SP_ROWS, SP_ROWS_ROW } from '@/lib/maker-stage-room';
import { QuietBar } from './kit';

/**
 * ✏️ EDIT — the toolbar's first tool (owner 2026-10-09, `TOOLBAR-SPEC-2026-10-09.md` § EDIT), the prototype's
 * `rowsFor(part, 'edit')`:
 *
 *   row 1   the part's ONE door — "Edit the E-Gifts", "Edit in Studio › Info", "Change the date in Suppliers" — or,
 *           for a part with no door, its name with its sentence behind ⓘ (`QuietBar`, the shipped row)
 *   row 2   —
 *   row 3   —
 *   row 4   ↑ Earlier · ↓ Later · Remove — ALWAYS the last row (owner: *"always set this as the last row"*), on
 *           every part: a part that cannot move or cannot be taken off keeps the button, grey (`waiting`)
 *
 * The toolbar's OWN rows: nothing here is the work area's, so Edit is the same on a part the work area has no tools
 * for (the Reveal, the Camera, a reply page's masthead). The moves are the frame's own writes (`usePartEdits`,
 * `add-part-sheet.tsx`) — one order write a step, the one confirm before a remove.
 */
/** A button of the last row: a third of it, 44 px, its word never wrapped. */
const EDIT_STEP = '!h-11 min-w-0 !flex-1 !px-2 [&>.lbl]:truncate';

export function StageEdit({
  earlier,
  later,
  remove,
  removeWord,
}: {
  /** One place earlier / later on the page — null: nowhere to go (the button is grey). */
  earlier: (() => void) | null;
  later: (() => void) | null;
  /** Ask to take the part off (it asks first) — null: a part that stays (the button is grey). */
  remove: (() => void) | null;
  removeWord: string;
}) {
  return (
    <div className={SP_ROWS} data-stage-edit="">
      <div className={`${SP_ROWS_ROW} row-start-1 [&>*]:min-w-0 [&>*]:flex-1`} data-stage-edit-row="door">
        <QuietBar />
      </div>
      <div className={`${SP_ROWS_ROW} row-start-4`} data-stage-edit-row="place">
        {/* A step with nowhere to go is still a button — grey, its pill kept (`waiting`, the approved gallery § 9). */}
        <ActionButton tone="neutral" icon={ArrowUp} label="Earlier" waiting={!earlier} onClick={earlier ?? undefined} className={EDIT_STEP} />
        <ActionButton tone="neutral" icon={ArrowDown} label="Later" waiting={!later} onClick={later ?? undefined} className={EDIT_STEP} />
        <ActionButton tone="danger" icon={Trash2} label={removeWord} waiting={!remove} onClick={remove ?? undefined} className={EDIT_STEP} />
      </div>
    </div>
  );
}
