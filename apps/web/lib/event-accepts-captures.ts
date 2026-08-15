import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { rowAcceptsNewCaptures, type ArchivedRow } from '@/lib/event-accepts-captures-rule';

/**
 * event-accepts-captures.ts — a celebration that has been put away stops taking
 * new photographs.
 *
 * Owner, 2026-08-16, asked directly and answered "yes": when a couple puts an
 * event away, **cameras and the photo wall go quiet. Everything already taken
 * stays untouched.**
 *
 * ─── ONE GATE, NOT ONE CHECK PER SURFACE ───────────────────────────────────
 * 🔑 There are TWO capture entry points and they do not share a code path: the
 * paparazzi seat (`app/papic/actions.ts` → `recordSeatCapture`) and the guest's
 * own camera (`app/api/papic/guest-capture/route.ts`). Checking a rule in two
 * places is two chances to forget, and the next capture surface makes three —
 * the exact shape of the live-photo-wall defect (2026-08-12), where three
 * surfaces each asked one half of a question.
 *
 * ⚠ AND THE OBVIOUS SINGLE CHOKEPOINT IS NOT ONE. Both paths converge on the
 * credit reservation `papic_reserve_capture_split`, which looks like the perfect
 * home for this — but `recordSeatCapture` SKIPS that call entirely for an event
 * holding the "Unlock all of Papic" pass (`if (!unlocked)`). A gate placed there
 * would be silently absent on exactly the events that paid the most.
 *
 * ─── WHY THIS FAILS *OPEN* ─────────────────────────────────────────────────
 * A read failure must let the shutter work. The two outcomes are not
 * symmetrical: allowing a few photographs onto a celebration somebody tidied
 * away is a tidiness problem, while blocking capture during a live wedding is
 * the one irreversible failure in this product — the day does not happen twice.
 * Same reasoning the wall's value-narrowing used: an unrecognised state must not
 * silently delete a paid feature.
 *
 * ⚠ This is DELIBERATELY the opposite of the metering gate beside it, which
 * fails CLOSED because it is money. Two adjacent gates, two directions, each
 * chosen by what its own failure costs — do not "make them consistent".
 */
export async function eventAcceptsNewCaptures(
  client: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('events')
    .select('archived')
    .eq('event_id', eventId)
    .maybeSingle();

  // The JUDGEMENT lives in a boundary-free module so it can actually be tested —
  // `server-only` is not installed in this repo, so anything importing it is
  // unreachable from a test. See event-accepts-captures-rule.ts.
  return rowAcceptsNewCaptures(data as ArchivedRow, Boolean(error));
}

/**
 * What a person is told when the shutter is refused for this reason.
 *
 * Names the way back, because the couple can undo it in one press and the
 * photographer standing there cannot. A refusal that does not say what to do
 * instead is half a refusal.
 */
export { EVENT_PUT_AWAY_CAPTURE_COPY } from '@/lib/event-accepts-captures-rule';
