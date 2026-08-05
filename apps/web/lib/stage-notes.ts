import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * NOTES TO ONE SUPPLIER — the coordinator → emcee channel.
 *
 * ── WHY ADDRESSED, NOT BROADCAST ────────────────────────────────────────────
 * The owner asked for coordinators to be able to message the emcee. The emcee
 * cannot read `coordinator_broadcasts` (member / moderator / admin only), so
 * wiring that would have built a permanently empty card.
 *
 * The obvious fix — give the emcee event-member access — was rejected. A member
 * can read the couple's private notes on their own schedule ("don't mention the
 * surprise yet"), which exist precisely because they are not for saying out
 * loud. Opening the whole event to fix a messaging gap trades away far more
 * than the thing asked for.
 *
 * So a note names ONE supplier, and the read rule is "am I that supplier".
 * Nothing else on the event becomes visible.
 *
 * The client is injected and there is no `server-only` import, so the rules
 * below are reachable by a unit test — the same pattern as
 * `lib/papic-face-mode.ts`.
 */

export type StageNote = {
  noteId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

/** Matches the table's CHECK. Kept here so the form and the DB agree. */
export const STAGE_NOTE_MAX = 240;

/**
 * Is this a note we are willing to send?
 *
 * Trimmed, non-empty, within the length the column accepts. Returning the
 * cleaned string (rather than a boolean) means a caller cannot validate one
 * value and then send a different one.
 */
export function cleanStageNote(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const body = raw.trim();
  if (body.length === 0 || body.length > STAGE_NOTE_MAX) return null;
  return body;
}

/**
 * The notes addressed to this supplier for this event, newest first.
 *
 * ⚠ Scoped by `recipient_vendor_profile_id` in the QUERY as well as by RLS.
 * The policy is the real gate; this makes the intent legible at the call site
 * and means a future policy change cannot silently widen what this returns.
 */
export async function fetchStageNotes(
  supabase: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
): Promise<StageNote[]> {
  const { data, error } = await supabase
    .from('event_stage_notes')
    .select('note_id, body, created_at, read_at')
    .eq('event_id', eventId)
    .eq('recipient_vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false })
    .limit(30);

  // A failed read returns nothing — but the CALLER must not render that as
  // "the coordinator has sent you nothing". See the surface: it says the notes
  // could not be loaded, because on a wedding floor an unread instruction that
  // looks like an empty inbox is the dangerous version.
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((r) => ({
    noteId: String(r.note_id),
    body: String(r.body ?? ''),
    createdAt: String(r.created_at ?? ''),
    readAt: typeof r.read_at === 'string' ? r.read_at : null,
  }));
}

/** How many of these has the emcee not seen? Drives the badge. */
export function unreadCount(notes: ReadonlyArray<StageNote>): number {
  return notes.filter((n) => n.readAt === null).length;
}
