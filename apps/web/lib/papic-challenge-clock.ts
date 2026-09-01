// lib/papic-challenge-clock.ts
//
// THE CELEBRATION'S ARMED CHALLENGE — read through the ONE resolver.
//
// Owner ruling 2026-09-01 (DECISION_LOG.md): a Papic challenge's window is
// RELATIVE. It opens when the challenge is ARMED, one at a time per
// celebration; arming the next closes the previous; and the last one closes
// when the capture window ends (`events.papic_window_end`). No duration column
// and no default duration number.
//
// 🔴 EXPIRY CLOSES THE PROMPT, NEVER THE SHUTTER. Nothing in this file may ever
// be consulted on a capture path — a guest is never refused a photo for
// lateness.
//
// ── WHY THERE IS NO PREDICATE IN THIS FILE ─────────────────────────────────
// `papic_challenge_is_open()` in the database is the ONE place "is this
// challenge live right now?" is decided, the way `papic_guest_spend_ceiling()`
// is the one place a ceiling is. This module CALLS it and shapes the answer for
// a screen; it does not re-derive it. A `Date.now() >= endsAt` here would read
// as a harmless convenience and would be a second decider — the exact class of
// drift item 3 spent six sessions removing, and the reason the couple's board
// once told a couple their challenges reached nobody.
//
// ⚠ SO: NEVER ADD A COMPARISON AGAINST `armedAt` TO THIS FILE. If a screen
// needs a countdown, it needs a number FROM the database, not a rule about one.
//
// 🔑 AND "ARMED" HERE IS THE CELEBRATION'S, NOT THE GUEST'S. `ArmedChallenge`
// in `papic-challenge-panel.tsx` is a different thing that shares the word:
// one guest's phone, React state, never persisted, meaning "the next shutter
// press on THIS handset attaches to THIS mission". Nothing here touches it.

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/** The challenge the room is being asked, as the database answered. */
export type ArmedChallenge = {
  missionId: string;
  /** UNRESOLVED — {who}/{host}/{hosts}/{event} tokens intact. Render through
   *  `displayChallengePrompt`, or per guest through `papic_guest_missions`. */
  prompt: string;
  armedAt: string;
  source: string;
  captureKind: string | null;
  boardSlot: number | null;
};

/**
 * ⚠ `measured: false` MEANS "WE DO NOT KNOW", NOT "NOTHING IS ARMED".
 *
 * A refused read and a celebration between challenges are the same shape in
 * every naive reader — an empty result — and a screen that collapses them tells
 * a couple mid-reception that no challenge is running when one is. This is the
 * same rule as `fetchGuestsByEventMeasured` and
 * `vendor-dashboard/reads-are-honest.test.ts`; a caller that treats
 * `measured: false` as "none" has reintroduced the defect.
 */
export type ArmedChallengeReading =
  | { measured: true; armed: ArmedChallenge | null }
  | { measured: false; armed: null };

type Row = {
  mission_id: string;
  prompt: string;
  armed_at: string;
  source: string;
  capture_kind: string | null;
  board_slot: number | null;
};

export async function fetchArmedChallenge(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ArmedChallengeReading> {
  const { data, error } = await supabase.rpc('papic_armed_challenge', {
    p_event_id: eventId,
  });

  if (error) {
    logQueryError('fetchArmedChallenge', error, { event_id: eventId }, 'graceful_degrade');
    return { measured: false, armed: null };
  }

  // The function returns at most one row (the partial unique index guarantees
  // at most one open arming; the LIMIT 1 makes it true of the query too).
  const row = (data as Row[] | null)?.[0];
  if (!row) return { measured: true, armed: null };

  return {
    measured: true,
    armed: {
      missionId: row.mission_id,
      prompt: row.prompt,
      armedAt: row.armed_at,
      source: row.source,
      captureKind: row.capture_kind,
      boardSlot: row.board_slot,
    },
  };
}
