/**
 * papic-exhaustion-truth.ts — WHAT A SPENT CAMERA IS ALLOWED TO SAY.
 *
 * 🛑 THE SENTENCE THIS FILE EXISTS TO DELETE, measured against production on
 * 2026-09-16 and shipped live in `app/api/upload/route.ts`:
 *
 *     "This camera has used today's shots — it refills tomorrow."
 *
 * IT IS FALSE, AND NOT BY A LITTLE. Read out of production, the whole ceiling is:
 *
 *   papic_capture_points_available = papic_seat_dedicated_points(seat)
 *                                  − papic_seat_point_usage.points_used
 *                                  + papic_event_pool_status(event).remaining_points
 *
 * Not one of those four functions carries a date, a day boundary, a reset or a
 * `now()`; `papic_seat_point_usage` has no period column to hold one (its
 * columns are seat_id · points_used · created_at · updated_at). Of every
 * function in the schema that touches that table, exactly three REDUCE
 * `points_used` — `papic_release_camera_points`, `papic_release_capture_split`,
 * `papic_release_event_points` — and all three are RELEASE paths (a failed
 * capture, a returned split). None is scheduled: `cron.job` is empty and none
 * of the 22 job keys in `cron_job_runs` touches seat usage. **Nothing refills a
 * seat, anywhere.** The ceiling is CUMULATIVE.
 *
 * 🔑 AND A FALSE REASSURANCE IS WORSE THAN A REFUSAL. A guest hits the ceiling
 * at a wedding, reads "it refills tomorrow", and STOPS ASKING. She does not
 * tell the couple, does not buy more, does not mention it — she waits. The
 * wedding ends that night. A refusal gets escalated; a reassurance ends the
 * conversation.
 *
 * ── WHY THE TWO CAUSES MUST STAY DISTINGUISHABLE ──────────────────────────
 * A guest out of HER OWN credits and an event out of ITS SHARED POOL need
 * different next steps: she can add more to her own camera (and the host can
 * hand shots to one camera — `papic_dedicate_shots`); only the host can top up
 * the pool everyone draws from. One sentence for both would be a smaller lie in
 * place of a bigger one.
 *
 * ⚠ THE OLD BRANCH CONDITION DID NOT ACTUALLY ASK THAT QUESTION. The route
 * branched on `seatGate === 'exhausted'`, but `papic_capture_points_available`
 * already ADDS the pool in, so that verdict means "her own balance AND the pot
 * together are short" — true for a pool guest who never owned a credit. The
 * honest discriminator is the OTHER probe the route already makes:
 * `papic_event_points_remaining_for_seat` returns `PAPIC_POOL_NOT_BINDING`
 * (2147483647) if and only if `papic_seat_dedicated_points(seat) > 0`, i.e.
 * this camera holds a balance of its own. That is the question.
 *
 * PURE by design, and that is load-bearing: `app/api/upload/route.ts` is
 * `server-only`, so a guard that imported it could only ever grep it. The
 * decision lives here where a test can EXECUTE it.
 */

/** Cause of a refusal — which budget actually ran out, from the guest's side. */
export type PapicExhaustionCause = 'own_camera' | 'event_pool';

/**
 * The sentinel `papic_event_points_remaining_for_seat` returns when the shared
 * pool does not bound this camera because the camera has a balance of its own
 * (migration 20271019231590, owner-locked 2026-07-29). It is `INT4_MAX`.
 */
export const PAPIC_POOL_NOT_BINDING = 2147483647;

/**
 * Which budget ran out, from the ONE probe that can tell them apart.
 *
 * @param poolRemainingForSeat the value of
 *        `papic_event_points_remaining_for_seat(event, seat)`, or null when the
 *        RPC could not be read.
 *
 * A camera the pool does not bound is a camera with its own balance, so a
 * refusal there is HER credits being spent. Anything else — including an
 * unreadable probe — is the shared pot, which is both the commoner case and the
 * more conservative thing to say: it never tells a guest she has a camera of
 * her own to top up when she may not.
 */
export function resolveExhaustionCause(
  poolRemainingForSeat: number | null | undefined,
): PapicExhaustionCause {
  return poolRemainingForSeat === PAPIC_POOL_NOT_BINDING ? 'own_camera' : 'event_pool';
}

/**
 * The refusal, in one sentence, for the API body and the screen.
 *
 * ⛔ NEITHER SENTENCE MAY PROMISE A REFILL, because there is none. Both say what
 * is true — the credits are spent and stay spent — and then differ on the ONE
 * thing that differs: who can do something about it.
 */
export function exhaustionHeadline(cause: PapicExhaustionCause): string {
  return cause === 'own_camera'
    ? 'This camera’s shots are all spent.'
    : 'This celebration has run out of shots.';
}

/**
 * The next step. `buyOffered` must be the SAME boolean that decides whether the
 * "add more shots" panel is actually mounted (NEXT_PUBLIC_PAPIC_GUEST_BUY via
 * `papicGuestBuyEnabled`) — naming a remedy that is not on the screen is its own
 * small lie, and a dead control makes working code look broken.
 */
export function exhaustionDetail(
  cause: PapicExhaustionCause,
  opts: { buyOffered: boolean },
): string {
  if (cause === 'own_camera') {
    return opts.buyOffered
      ? 'They don’t refill. Add more shots below to keep shooting, or ask the couple to top up this camera.'
      : 'They don’t refill. Ask the couple to add more shots to this camera.';
  }
  return opts.buyOffered
    ? 'Everybody here shares one set of shots and they’re all spent. They don’t refill — the couple can add more at any time, or you can add your own below.'
    : 'Everybody here shares one set of shots and they’re all spent. They don’t refill — only the couple can add more.';
}

/**
 * PAP-13 · THE ARRIVAL HAS TO TELL HER, PER PHOTO.
 *
 * Credits are spent when a capture ARRIVES, not when the shutter fires (the
 * reserve runs server-side in the presign + record seams, and a shot sitting in
 * the offline queue has spent nothing yet). So a guest can shoot more offline
 * than she has credits for, and the ceiling decides which of them LAND.
 *
 * 🛑 THE DEFECT THIS REPLACES. The roll drew a `capped` shot with no badge at
 * all — no spinner, no retry arrow, no cloud, not even the tick a saved shot
 * gets — a bare thumbnail, indistinguishable from a photograph that was kept.
 * Over it the panel read *"That's everything you can shoot — every photo and
 * clip is in the host's gallery."* WITH FIVE OF THEM NOT IN IT. A photograph
 * that vanishes with no message is the disease this project keeps paying for.
 *
 * Returns null when nothing was refused — the celebratory copy is correct then,
 * and only then.
 */
export function arrivalTally(
  landed: number,
  refused: number,
): { headline: string; detail: string } | null {
  if (refused <= 0) return null;
  const total = landed + refused;
  return {
    headline: `${refused} of these ${total} didn’t land.`,
    detail:
      `Your credits ran out partway through. ` +
      `${landed} ${landed === 1 ? 'is' : 'are'} in the gallery; ` +
      `the other ${refused} ${refused === 1 ? 'was' : 'were'} not saved.`,
  };
}
