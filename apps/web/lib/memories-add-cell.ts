/**
 * THE ＋ ADD CELL'S WORDS — the first tile of the Memories grid, hosts only (owner 2026-10-31, "Build both": the
 * keepsake row, and a cell that lets them upload a photo in trade of a Papic credit).
 *
 * The cell is a SECOND DOOR TO THE SAME UPLOADER — the thumb row's ＋ Add photos sheet (`AddToLibrary`, the same pot,
 * the same Add more; or the same turn-on choice when adding by hand is off; or the same "the other host's" line). Only
 * its words are its own: "Add photo", one short line, and the rest in the ⓘ (house rule, details go inside the ⓘ).
 *
 * 🪙 THE PRICE IS NEVER TYPED HERE — the line is `papicCaptureCost('photo', null, 'upload')`, the function the presign
 * gate charges with (owner 2026-08-31, "don't guess"; the sheet's own line is `photoCostLine()` from the same ladder).
 *
 * Pure — no React, no I/O.
 */
import { papicCaptureCost } from '@/lib/papic-cameras-pure';
import { UPLOADS_TAKEN_LINE } from '@/lib/uploads-seat-claim';
import { costInfoLine, creditsCount, type UploadPot } from '@/app/dashboard/[eventId]/studio/papic/_lib/upload-credits';

/** Which of the thumb-row door's three faces the page drew: the uploader · the turn-on choice · the other host's. */
export type AddCellState = 'open' | 'off' | 'taken';

export function addCellWords(state: AddCellState, pot: UploadPot): { line: string; tip: string } {
  if (state === 'off') {
    return { line: 'Turned off', tip: 'Adding photos by hand is off for this event. Press to turn it on.' };
  }
  if (state === 'taken') return { line: 'Other host’s', tip: UPLOADS_TAKEN_LINE };
  if (pot === 'unmetered') {
    return { line: 'Your pass covers it', tip: 'From your phone or laptop, into Your uploads. Your Papic pass covers every photo you add.' };
  }
  return {
    line: `${creditsCount(papicCaptureCost('photo', null, 'upload'))} each`,
    tip: `From your phone or laptop, into Your uploads, spent from your Papic credits. ${costInfoLine()}`,
  };
}
