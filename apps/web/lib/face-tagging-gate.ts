import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveFaceMode, type PapicFaceMode } from '@/lib/papic-face-mode';
import { eventPapicGuestActive } from '@/lib/papic-guest';
import { faceTaggingAskable, papicHasClosed } from '@/lib/face-selfie-lifetime';

/**
 * ONE READ, TWO ANSWERS: what runs on this event (`mode`), and may a guest be
 * ASKED "Want to be tagged in the photos?" at all (`askable`).
 *
 * 🔑 MOVED HERE FROM `lib/papic-face-mode.ts` (2026-09-30) BECAUSE IT NOW ASKS
 * PAPIC. That module is isomorphic — four capture components import it into
 * the browser — and "is Papic active" reads orders and the pool through
 * server-side helpers. A server question lives in a server module; the
 * isomorphic one keeps the pure resolvers.
 *
 * `askable` (lib/face-selfie-lifetime.ts `faceTaggingAskable`) is true only when
 * the event's Papic is ACTIVE (`eventPapicGuestActive` — owner 2026-09-30: *"but
 * only register face tagging when papic service is active."*), face tagging runs
 * (`mode_a`, which already carries the couple's decline), and Papic has not
 * CLOSED (twelve hours after the event ends).
 *
 * 🔒 A FAILED READ IS A NO. Of the two ways to be wrong about asking for a face,
 * asking is the worse one. A guest who misses the question on one render sees
 * it on the next.
 */
export type FaceTagging = {
  /** What runs on this event — the capture embedder and the matcher obey it. */
  mode: PapicFaceMode;
  /** May a guest be asked "Want to be tagged in the photos?" right now. */
  askable: boolean;
  /** Face tagging would run here were it not for the couple's own "off". */
  available: boolean;
  /** The couple turned it off for their event. */
  declined: boolean;
};

const OFF: FaceTagging = { mode: 'mode_b', askable: false, available: false, declined: false };

export async function resolveFaceTagging(
  client: SupabaseClient,
  eventId: string,
): Promise<FaceTagging> {
  try {
    if (!eventId) return OFF;
    const [{ data, error }, papicActive] = await Promise.all([
      client
        .from('events')
        .select(
          'papic_face_mode, event_type, face_tagging_declined_by_couple, event_date, event_end_date, papic_window_end',
        )
        .eq('event_id', eventId)
        .maybeSingle(),
      eventPapicGuestActive(client, eventId).catch(() => false),
    ]);
    if (error) console.error('[supabase-error] lib/face-tagging-gate.ts · from:events.select', error);
    if (error || !data) return OFF;
    const row = data as {
      papic_face_mode?: string | null;
      event_type?: string | null;
      face_tagging_declined_by_couple?: boolean | null;
      event_date?: string | null;
      event_end_date?: string | null;
      papic_window_end?: string | null;
    };
    // ⚖ AUTOMATIC (owner 2026-09-30, "automatic"): Papic active turns face
    // tagging on — no admin step; the couple's "off" still wins.
    const mode = resolveFaceMode(row.papic_face_mode, row.event_type, row.face_tagging_declined_by_couple, papicActive);
    // What would run WITHOUT the couple's decline — the couple's own switch is
    // drawn only where there is something to switch off.
    const available = resolveFaceMode(row.papic_face_mode, row.event_type, false, papicActive) === 'mode_a';
    const papicClosed = papicHasClosed({
      eventDate: row.event_date,
      eventEndDate: row.event_end_date,
      windowEnd: row.papic_window_end,
    });
    return {
      mode,
      askable: faceTaggingAskable({ papicActive, mode, papicClosed }),
      available,
      declined: row.face_tagging_declined_by_couple === true,
    };
  } catch {
    return OFF;
  }
}
