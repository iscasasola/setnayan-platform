import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { manualUploadsClosedFrom } from '@/lib/papic-uploads-open-rule';
import { PAPIC_UPLOADS_CAMERA_INDEX } from '@/lib/papic-cameras';

/**
 * "MAY PHOTOS BE ADDED BY HAND TO THIS CELEBRATION?" — asked on the SERVER.
 *
 * Owner 2026-08-26: *"a toggle will set if they will allow people to upload
 * photos manually as well."* The switch shipped governing the studio SCREEN: the
 * page reads `events.papic_uploads_open` and hides the file picker when it is
 * off. That was honest while the couple's own picker was the only manual-upload
 * path in the product and the couple was the only person the switch could stop —
 * the guard that pins it says so in its own words.
 *
 * 🚨 HIDING A CONTROL IS NOT CLOSING A DOOR. The live photo wall mirrored to
 * every guest's phone for a whole celebration while the only "off" the product
 * offered closed the venue screens; a couple who had switched the wall off would
 * reasonably believe it was off, and it was still in a hundred hands. A hidden
 * button is one `fetch` away from not being hidden, and a server action is a
 * public endpoint.
 *
 * So the switch is read here, on the write path, before a credit is spent.
 *
 * ── WHAT COUNTS AS A MANUAL UPLOAD ──────────────────────────────────────────
 *
 * 🔑 THE SEAT ANSWERS IT, WHICH IS WHY THIS IS A GATE AND NOT A BUTTON. The
 * couple's file picker is not a separate capture path — it presigns through the
 * same `/api/upload` and records through the same `recordSeatCapture` as every
 * camera in the product. What distinguishes it is the SEAT it shoots on: the
 * Uploads camera, `seat_index = PAPIC_UPLOADS_CAMERA_INDEX`. That is a fact
 * about the row in the database, not a claim the client makes, so it holds for
 * any future surface pointed at that seat — including one nobody has written.
 *
 * ⛔ IT MUST NOT GATE ORDINARY CAMERA CAPTURES. The switch is about adding
 * photographs by hand. Turning it off must never stop a paparazzo photographing
 * a wedding, so every other seat passes through untouched, and the OFF copy says
 * exactly that: *"Only what your cameras capture."*
 *
 * ── DIRECTION OF FAILURE ────────────────────────────────────────────────────
 *
 * ⚠ AN UNREADABLE SWITCH MEANS OPEN, matching the page's `?? true` and the
 * column's `DEFAULT TRUE`. The column lands in a migration; on a database that
 * predates it PostgREST refuses the query, and failing closed there would take
 * uploading away from every couple on the platform with no explanation and no
 * error. An upload costs a credit exactly like a shot, so an open door is not a
 * free one — the cost of failing open is bounded and the cost of failing closed
 * is not.
 *
 * ⚠ ITS OWN ROUND TRIP, NEVER A NAME ON A BIGGER SELECT. Naming an unknown
 * column makes PostgREST refuse the WHOLE query, so folding this into an event
 * read that something else depends on turns a missing migration into a live
 * celebration rendering as missing. That is a mistake this Papic surface has
 * already made once.
 *
 * 🔑 THE DECISION ITSELF IS IN `papic-uploads-open-rule.ts`, which is pure and
 * unit-tested. This file is the round trip and nothing else — the same split
 * `event-accepts-captures.ts` has, and for the same reason: a `server-only`
 * module cannot be imported by a test in this repo, so a rule living in one is
 * a rule nothing measures.
 */
export async function papicManualUploadsClosed(
  admin: SupabaseClient,
  eventId: string,
  seatIndex: number | null | undefined,
): Promise<boolean> {
  // Not the Uploads camera → not a manual upload → the switch has no opinion.
  // Asked before the round trip, so an ordinary capture never pays for a read
  // whose answer it would ignore.
  if (seatIndex !== PAPIC_UPLOADS_CAMERA_INDEX) return false;
  if (!eventId) return false;

  try {
    const { data, error } = await admin
      .from('events')
      .select('papic_uploads_open')
      .eq('event_id', eventId)
      .maybeSingle();
    // ⚠ Supabase RESOLVES with { error } rather than throwing, so passing the
    // error in explicitly is the only way the rule can see it. A refused read is
    // not "closed".
    return manualUploadsClosedFrom(
      seatIndex,
      data as { papic_uploads_open?: boolean | null } | null,
      Boolean(error),
    );
  } catch {
    // An unavailable admin client is a config error, not an answer.
    return false;
  }
}
