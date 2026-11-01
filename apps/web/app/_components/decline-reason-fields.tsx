'use client';

import { useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FormRows, TypedRow } from '@/app/_components/form-row';

/**
 * WHY YOU ARE TURNING A BOOKING DOWN — one dropdown and one line (simpler supplier dashboard step 4; prototype
 * `SHEETS.decline`: "Why ▾ · Note · Optional · one line for them").
 *
 * 🔑 IT STILL POSTS ONE FIELD, `reason` — the one `vendorDeclineLock` has always read and the couple reads back. The
 * dropdown's words and the note are joined here ("Fully booked — we have two weddings that day"); "Something else"
 * contributes only the note, so the couple never reads a placeholder as a reason. No new column, no new action.
 *
 * ⚠ NO UNDO. The couple is told at once (`vendorDeclineLock` notifies), and an undo cannot un-tell them — the
 * 2026-10-14 checklist (X7) struck the prototype's Undo for exactly that reason.
 */
export const DECLINE_REASONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'not_available', label: 'Not available that day' },
  { key: 'fully_booked', label: 'Fully booked' },
  { key: 'not_right_fit', label: 'Not the right fit' },
  { key: 'other', label: 'Something else' },
];

/** The words the couple reads — the picked reason, then the note; "Something else" is the note alone. */
export function declineReasonText(key: string, note: string): string {
  const why = key === 'other' ? '' : (DECLINE_REASONS.find((r) => r.key === key)?.label ?? '');
  const line = note.trim();
  if (why && line) return `${why} — ${line}`.slice(0, 240);
  return (why || line).slice(0, 240);
}

export function DeclineReasonFields() {
  const [why, setWhy] = useState('not_available');
  const [note, setNote] = useState('');
  return (
    <span className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center" data-decline-reason="">
      <input type="hidden" name="reason" value={declineReasonText(why, note)} />
      <PickMenu
        label="Why you are turning it down"
        value={why}
        options={DECLINE_REASONS}
        onPick={setWhy}
        dataAttr="data-decline-why"
        className="min-h-11"
      />
      {/* ✍ The note is a row of the ONE Field template (`TypedRow`, owner 1 Nov 2026). It posts nothing itself: what it
          holds joins the reason above, as typed (`onType`), so a Decline pressed with the note still open carries it. */}
      <div className="min-w-0 sm:flex-1">
        <FormRows width="wide">
          <TypedRow
            name="Note"
            value={note}
            empty="Optional · one line"
            maxLength={200}
            onType={setNote}
            onKeep={(t) => setNote(t)}
            data="decline-note"
            pillAttrs={{ 'data-decline-note': '' }}
          />
        </FormRows>
      </div>
    </span>
  );
}
