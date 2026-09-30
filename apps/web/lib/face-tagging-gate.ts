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
export async function resolveFaceTagging(
  client: SupabaseClient,
  eventId: string,
): Promise<{ mode: PapicFaceMode; askable: boolean }> {
  try {
    if (!eventId) return { mode: 'mode_b', askable: false };
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
    if (error || !data) return { mode: 'mode_b', askable: false };
    const row = data as {
      papic_face_mode?: string | null;
      event_type?: string | null;
      face_tagging_declined_by_couple?: boolean | null;
      event_date?: string | null;
      event_end_date?: string | null;
      papic_window_end?: string | null;
    };
    const mode = resolveFaceMode(row.papic_face_mode, row.event_type, row.face_tagging_declined_by_couple);
    const papicClosed = papicHasClosed({
      eventDate: row.event_date,
      eventEndDate: row.event_end_date,
      windowEnd: row.papic_window_end,
    });
    return { mode, askable: faceTaggingAskable({ papicActive, mode, papicClosed }) };
  } catch {
    return { mode: 'mode_b', askable: false };
  }
}
