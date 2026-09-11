import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * HIDE A REPORTED PHOTOGRAPH — whichever of the two capture tables holds it.
 *
 * ── WHAT WAS TRUE BEFORE THIS FILE (found by the Story's step-8 drive, 2026-09-11) ──
 * A guest who asks, from the story, for a photograph of themselves to come down
 * (`askToTakeMyPhotoDown`) files a `user_reports` row whose `target_id` is the
 * capture's id — from EITHER `papic_photos` (a seat camera: every photograph the
 * Story's pages are built from) or `papic_guest_captures` (the guest camera). The
 * moderator's "Hide" only ever updated `papic_guest_captures`. So for a seat
 * photograph — the only kind the story shows — Hide matched NO row, the report was
 * stamped `actioned` with *"Content hidden by Setnayan moderator."*, and the
 * photograph stayed on the story, the recap, both prints and the share card.
 * No error anywhere: the only symptom was an absence.
 *
 * 🔑 THE ID DECIDES, NOT THE REPORT'S NOTE. The reporting action writes the table
 * name into `details`, but that is free text a person reads, older reports carry
 * none, and a note is not a key. Capture ids are random UUIDs in two tables, so
 * the photograph is found by looking in both — each look bound to the report's
 * own event, so an id from another celebration matches nothing.
 *
 * ⚖ SEAT PHOTOS FIRST, because they are what the story prints; the order cannot
 * change the answer (an id lives in one table), only which read comes first.
 *
 * Returns WHICH table held it, or `null` when neither did — so the caller can say
 * "nothing was hidden" instead of claiming a hide that never happened. Hiding
 * something already hidden keeps its original moment (`hidden_at` is not moved).
 * A rejected query THROWS: an unanswered question must never read as "not found".
 */
export type ReportedPhotoTable = 'papic_photos' | 'papic_guest_captures';

const TABLES: ReadonlyArray<{ table: ReportedPhotoTable; id: 'photo_id' | 'capture_id' }> = [
  { table: 'papic_photos', id: 'photo_id' },
  { table: 'papic_guest_captures', id: 'capture_id' },
];

export async function hideReportedPhoto(
  admin: SupabaseClient,
  eventId: string,
  photoId: string,
  at: string = new Date().toISOString(),
): Promise<ReportedPhotoTable | null> {
  if (!eventId || !photoId) return null;
  for (const { table, id } of TABLES) {
    const found = await admin
      .from(table)
      .select(`${id}, hidden_at`)
      .eq(id, photoId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (found.error) throw new Error(`[hideReportedPhoto] ${table}: ${found.error.message}`);
    if (!found.data) continue;
    if ((found.data as { hidden_at: string | null }).hidden_at == null) {
      const hid = await admin
        .from(table)
        .update({ hidden_at: at })
        .eq(id, photoId)
        .eq('event_id', eventId)
        .is('hidden_at', null);
      if (hid.error) throw new Error(`[hideReportedPhoto] ${table}: ${hid.error.message}`);
    }
    return table;
  }
  return null;
}
