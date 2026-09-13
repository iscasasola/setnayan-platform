/**
 * CHALLENGES ARE PAUSED — the moments everybody must be watching.
 *
 * Owner, 2026-09-01, verbatim: *"instead of just stop. let us also allow pause
 * for the challenge. so challenges can all be not available on moments
 * everybody must be watching."*
 *
 * ── 🛑 PAUSE IS NOT STOP, AND NEITHER IS HIDE ──────────────────────────────
 *   HIDE   `papic_missions.is_active = false` — one challenge leaves every
 *          guest's board for good.
 *   STOP   `papic_stop_challenge()` — ends the ONE armed prompt; every
 *          challenge stays answerable.
 *   PAUSE  THIS. The whole board goes quiet, for every guest, until somebody
 *          resumes it — and comes back untouched.
 *
 * Pause is the only one that is TEMPORARY and EVENT-WIDE, which is why neither
 * of the others can express it: hiding ten challenges to quiet a room, then
 * un-hiding them, is ten destructive writes to undo a two-minute silence.
 *
 * ── 🔴 IT CLOSES PROMPTS. IT DOES NOT CLOSE THE SHUTTER. ───────────────────
 * The first kiss is the most photographed second of the day. Nothing in this
 * module may ever be consulted on a capture path — the same standing rule as
 * `papic-challenge-clock.ts`, and for a sharper reason: a pause that stopped
 * the camera would silence the challenges by throwing away the pictures the
 * product exists to collect.
 *
 * ── AND THE BOARD IS NOT EMPTIED ───────────────────────────────────────────
 * Owner's ruling on what a paused guest sees: the board STAYS, with a notice
 * over it. `papic_guest_missions` is untouched and keeps returning the same
 * rows. An empty board is byte-identical to a celebration that never set any
 * challenges up, and shipping "not available" as an ABSENCE is this project's
 * signature defect — the one the guest-read guards exist to keep out.
 *
 * ⚠ THERE IS NO CLOCK HERE AND THERE MUST NEVER BE ONE. Manual only (owner):
 * nothing derives an end from `papic_challenges_paused_at`, there is no
 * duration, and a pause ends when somebody resumes it. A `Date.now()` against
 * that timestamp would be a second, invented rule about when a room may play
 * again.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * ⚠ `measured: false` MEANS "WE DO NOT KNOW", NOT "NOT PAUSED".
 *
 * Same contract as `fetchArmedChallenge` and `fetchGuestsByEventMeasured`. The
 * coordinator's screen must be able to say "we couldn't check" rather than
 * telling somebody their challenges are running when they may be paused.
 */
export type PauseReading =
  | { measured: true; pausedAt: string | null }
  | { measured: false; pausedAt: null };

/** Is this celebration's challenge board quiet right now? */
export function isPaused(reading: PauseReading): boolean {
  // 🔑 FAILS TO "RUNNING", AND THE DIRECTION IS DELIBERATE. An unreadable pause
  // state resolving to PAUSED would silence every guest's board on a network
  // blip, at a party, for a reason nobody could see. Resolving to RUNNING costs
  // at worst a few guests playing through a moment — a courtesy missed, not a
  // celebration broken. This is the same direction as "closes the prompt, never
  // the shutter": when in doubt, do not take something away.
  return reading.measured && reading.pausedAt !== null;
}

export async function fetchPauseState(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PauseReading> {
  const { data, error } = await supabase
    .from('events')
    .select('papic_challenges_paused_at')
    .eq('event_id', eventId)
    .maybeSingle();

  // A rejected read resolves with `{ error }` and null data — it never throws.
  // A missing ROW is also not a measurement of this event.
  if (error || !data) {
    if (error) {
      logQueryError('fetchPauseState', error, { event_id: eventId }, 'graceful_degrade');
    }
    return { measured: false, pausedAt: null };
  }

  const raw = (data as { papic_challenges_paused_at: string | null }).papic_challenges_paused_at;
  return { measured: true, pausedAt: raw ?? null };
}
