/**
 * lib/studio-mood-board-saves.ts — WHAT STUDIO › MOOD BOARD & DRESS CODE SENDS, as pure functions (2026-10-09, "the remaining
 * Studio pages wear the templates", Mood Board second after E-Gifts).
 *
 * The page writes in two places: the couple's DRAFT (the five colours, the room, a role's colours and each role's outfit —
 * `hubDraftAction`, published by ✓ Apply) and LIVE (a photo into a part, a photo out, a supplier's colour change undone). Moving its
 * controls onto the templates must not change one byte of what is posted, so the fields each press sends are built HERE, once, and
 * `mood-board-studio.tsx` posts exactly these — which lets `studio-mood-board-posts-the-same.test.ts` hold them against the payloads
 * recorded from the page as it stood before any control moved, instead of describing them.
 *
 * Pure: no React, no I/O, no server import (this file rides the lazy Mood Board chunk with its caller, never the Maker's first load).
 */

/** The draft door's two fields (`hubDraftAction(eventId, fd)`): the intent and the patch. */
export type DraftFields = { intent: 'save'; patch: string };

/** The five main colours, the room's parts and a role's colours — the WHOLE painted board goes in as `role_palette`. */
export function paletteDraftFields(palette: unknown): DraftFields {
  return { intent: 'save', patch: JSON.stringify({ events: { role_palette: palette } }) };
}

/** A role's outfit — the WHOLE dress code goes in as `dress_code_config` (the writer keeps every other part as sent). */
export function dressCodeDraftFields(next: unknown): DraftFields {
  return { intent: 'save', patch: JSON.stringify({ events: { dress_code_config: next } }) };
}

/** A photo into a part (`uploadMoodboardSlot`): the part, the first free place, the photo itself and the six colours read from it. */
export function slotUploadFields(a: { eventId: string; slot: string; pos: number; swatches: readonly string[] }): Record<string, string> {
  return { event_id: a.eventId, slot_key: a.slot, slot_position: String(a.pos), palette_json: JSON.stringify(a.swatches) };
}

/** A photo out of a part (`removeMoodboardSlot`). */
export function slotRemoveFields(a: { eventId: string; slot: string; pos: number }): Record<string, string> {
  return { event_id: a.eventId, slot_key: a.slot, slot_position: String(a.pos) };
}

/**
 * The words a refused or dropped write is told in. A server action that is refused returns the database's own message about as
 * often as a sentence meant for a person (`plainRefusal` shows only the latter); a dropped connection throws and has no words at all.
 */
export const MOOD_BOARD_NOT_SAVED = {
  palette: 'Your colours did not save to your draft. Nothing changed — please try again.',
  wear: 'That did not save. Nothing changed — please try again.',
  upload: 'That photo did not upload — please try again.',
  remove: 'That photo did not come off the board — please try again.',
  undo: 'That did not undo. Nothing changed — please try again.',
  lists: 'Your do’s and don’ts did not save. Nothing changed — please try again.',
  look: 'That did not save. Nothing changed — please try again.',
} as const;
