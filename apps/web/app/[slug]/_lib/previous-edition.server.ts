/**
 * "PREVIOUSLY · No. 1" — the pointer at the top of the NEXT edition.
 *
 * `01` §3.9 · `08` step 4.3: **No. 2 OPENS with it.** It points BACK, at the
 * story this one follows — which is the opposite direction from the back cover,
 * and the two are easy to confuse. The back cover of No. 1 looks forward and
 * announces No. 2; this line sits on No. 2 and looks back at No. 1. (The first
 * cut of the back cover printed this sentence on itself, pointing at the story
 * the reader was already inside.)
 *
 * ⚖ IT EXISTS ONLY WHERE THE HOST MADE IT EXIST. `events.previous_event_id` is
 * written on ONE tap — "Start it now" in the Story Maker — and the owner's lock
 * on `event-anchor.ts` is that an event exists only on the user's go-signal.
 * Nothing here derives a link; it reads one the host created.
 *
 * 🔒 IT SHOWS ONLY WHAT THE READER COULD ALREADY OPEN. The previous story is
 * named only when it is PUBLISHED. An unpublished predecessor is silently
 * absent — a line saying "Previously · No. 1" that leads to a locked page would
 * disclose that a private story exists and what it is called.
 *
 * ⚠ FAIL-QUIET, like every optional load on this Server Component: a throw here
 * would take the whole published story with it, so every failure answers `null`
 * and the line is simply absent.
 */
import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export type PreviousEdition = { href: string; label: string };

export async function loadPreviousEdition(eventId: string): Promise<PreviousEdition | null> {
  try {
    const admin = createAdminClient();

    const { data: self, error: selfError } = await admin
      .from('events')
      .select('previous_event_id')
      .eq('event_id', eventId)
      .maybeSingle();
    // A refused read is not "no predecessor" — but for a read-only line both
    // resolve to the same safe answer: draw nothing.
    if (selfError || !self?.previous_event_id) return null;

    const { data: prev, error: prevError } = await admin
      .from('events')
      .select('slug, display_name')
      .eq('event_id', self.previous_event_id)
      .maybeSingle();
    if (prevError || !prev?.slug) return null;

    const { data: prevStory, error: storyError } = await admin
      .from('event_editorial')
      .select('status, edition_no')
      .eq('event_id', self.previous_event_id)
      .maybeSingle();
    if (storyError || prevStory?.status !== 'published') return null;

    /*
      THE NUMBER IS THE STAMPED ONE, NEVER A RECOMPUTED ONE. `edition_no` is
      written once, on the first transition to published, and a trigger refuses
      to move it — so "No. 1" here is the number that story actually carries.
      Recomputing it would re-run a count that has since changed, and the whole
      point of stamping was that "No. 1, theirs forever" be true.
      ⚠ An older story published before stamping existed has none; it is named
      by its own name rather than by a number invented for it.
    */
    const label =
      typeof prevStory.edition_no === 'number'
        ? `Previously · No. ${prevStory.edition_no}`
        : `Previously · ${prev.display_name ?? 'their last story'}`;

    return { href: `/${prev.slug}`, label };
  } catch {
    return null;
  }
}
