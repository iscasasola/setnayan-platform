import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readEventPoolStatus } from '@/lib/papic-event-pool';

/**
 * WHERE A CELEBRATION STANDS IN PAPIC — read ONCE, for every part of the page
 * that reports it.
 *
 * ── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────
 * The four facts strip used to do these reads itself, and that was right while
 * it was the only thing that needed them. The stage — the dark library panel
 * that now opens the page — needs the SAME answer to a question it cannot avoid
 * asking: is the library empty, so do I draw the waiting roll or the photographs?
 *
 * 🔑 TWO COMPONENTS COUNTING THE SAME THING IS A DEFINITION, TWICE. This project
 * has paid for that shape repeatedly — most recently a page that resolved "which
 * row is lit" in two components that could not see each other, and lit two. One
 * reader, one answer, published down.
 *
 * ⚠ AN UNREAD COUNT IS NOT ZERO. Every field is `number | null`, and null means
 * "we could not read this", never "there is none". A failed read that renders
 * "0 photos" tells a couple their gallery is empty — the single most alarming
 * thing this page could say, produced by a network blip. Supabase resolves with
 * `{ error }` rather than throwing, so a try/catch around one is decoration and
 * `?? 0` is how the zero gets invented.
 */
export type PapicStandings = {
  /** Photos + guest captures that are not hidden. null = not measured. */
  inLibrary: number | null;
  /** Every live camera on the event — seats, counted once. null = not measured. */
  cameras: number | null;
  /** Credits left in the shared pot. null = not measured, or no pot applies. */
  credits: number | null;
};

export async function readPapicStandings(
  admin: SupabaseClient,
  eventId: string,
): Promise<PapicStandings> {
  const [seatRes, photoRes, guestRes, pool] = await Promise.all([
    admin
      .from('paparazzi_seats')
      .select('seat_index', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('revoked_at', null),
    admin
      .from('papic_photos')
      .select('photo_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('hidden_at', null),
    admin
      .from('papic_guest_captures')
      .select('event_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('hidden_at', null),
    readEventPoolStatus(admin, eventId),
  ]);

  // ⚠ `{ count }` is a DIFFERENT SHAPE from `{ data }` — a guard written for
  // `data` cannot see a count read fail. Each is checked on its own terms.
  if (seatRes.error)
    logQueryError('PapicStandings.seats', seatRes.error, { eventId }, 'graceful_degrade');
  if (photoRes.error)
    logQueryError('PapicStandings.photos', photoRes.error, { eventId }, 'graceful_degrade');
  if (guestRes.error)
    logQueryError('PapicStandings.guestCaptures', guestRes.error, { eventId }, 'graceful_degrade');

  return {
    cameras: seatRes.error ? null : (seatRes.count ?? 0),
    // ⚠ EITHER read failing makes the TOTAL unmeasured. Adding a good count to a
    // failed one produces a number that looks like an answer and is not — and
    // this particular number decides whether the stage draws an empty roll or a
    // gallery, so a wrong zero would show a couple with photographs a screen
    // that says their library is empty.
    inLibrary:
      photoRes.error || guestRes.error ? null : (photoRes.count ?? 0) + (guestRes.count ?? 0),
    credits: pool.ok && pool.status.applies ? pool.status.remainingPoints : null,
  };
}
