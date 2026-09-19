/**
 * papic-exhaustion-truth.ts — WHAT A SPENT CAMERA IS ALLOWED TO SAY.
 *
 * 🛑 THE SENTENCE THIS FILE EXISTS TO DELETE, shipped live in
 * `app/api/upload/route.ts`:
 *
 *     "This camera has used today's shots — it refills tomorrow."
 *
 * ⚠ AND THE FIRST CORRECTION IS TO THE REASON, NOT THE VERDICT. A per-day
 * budget DOES exist in this schema, and an earlier pass of this work asserted
 * "nothing refills a seat, anywhere" — which is false as stated.
 * `papic_tier_config.points_per_day` minus `papic_seat_day_usage.points_used
 * WHERE usage_date = CURRENT_DATE` is a genuine daily allowance, read by
 * `papic_camera_points_remaining` and once enforced by `papic_reserve_camera_points`
 * (dropped 2026-09-18, 20271234330879 — it had no caller).
 * It resets with no job at all: tomorrow is simply a different row.
 * 🔑 SEARCHING FOR A SCHEDULED JOB AND FINDING NONE IS NOT EVIDENCE THAT
 * NOTHING RESETS. That was the wrong mechanism, and its absence proved nothing.
 *
 * ── WHY THE SENTENCE IS STILL FALSE FOR EVERY GUEST WHO EXISTS ────────────
 * Measured in production 2026-09-16, and the first three lines were re-measured
 * independently after the correction above:
 *
 *   tier         points_per_day   is_active   seats
 *   free              NULL          true        23   ← every seat in production
 *   mini              NULL          false        0
 *   ltd                70           false        0
 *   roll              200           false        0
 *   unlimited         500           false        0
 *
 *   · `papic_seat_day_usage` holds ZERO rows. It has never recorded anything.
 *   · `papic_camera_points_remaining` and `papic_reserve_camera_points` — the
 *     only two functions that read the daily budget — have NO caller anywhere:
 *     0 in `apps/`, 0 in RLS policies, 0 in views, 0 in CHECK clauses, 0 in
 *     other functions. (`papic_reserve_camera_capture` appears once inside
 *     `papic_record_guest_capture` — in a COMMENT. A code comment is not a call
 *     site, and `position('…(' in …)` returns 0 for it.)
 *   · What `api/upload` actually resolves is `papic_capture_points_available`
 *     (= dedicated − used + pool) and `papic_event_points_remaining_for_seat`.
 *     Neither carries a date, a day boundary, a reset or a `now()`, and
 *     `papic_seat_point_usage` has no period column to hold one. The dedicated
 *     bucket is, in the live SQL's own words, "a lifetime bucket, not a daily
 *     one".
 *
 * So the budgets that actually refuse a capture today do not refill, and the
 * one that would refill belongs to tiers nobody holds and nothing enforces.
 *
 * ⛔ WHICH IS EXACTLY WHY THE HONEST SENTENCE IS NOT HARDCODED EITHER.
 * "It refills tomorrow" is TRUE on a tier with a non-null `points_per_day`, and
 * `ltd`/`roll`/`unlimited` are one `is_active` flip away. Replacing one
 * hardcoded claim with the opposite hardcoded claim is the same defect facing
 * the other way. `exhaustionDetail` therefore takes `dailyBudget` — read from
 * this seat's own tier row — and says the thing that is true for THIS camera.
 *
 * 🔑 AND A FALSE REASSURANCE IS WORSE THAN A REFUSAL. A guest hits the ceiling
 * at a wedding, reads "it refills tomorrow", and STOPS ASKING. She does not
 * tell the couple, does not buy more, does not mention it — she waits. The
 * wedding ends that night. A refusal gets escalated; a reassurance ends the
 * conversation. So every sentence here must also name WHO CAN ACT: she cannot
 * top up a pool she shares with everybody — the couple can.
 *
 * ── WHY THE TWO CAUSES MUST STAY DISTINGUISHABLE ──────────────────────────
 * Out of HER OWN dedicated credits and the EVENT POOL being dry are different
 * situations with different next steps. With one shared pool (owner, verbatim:
 * "the guests or anyone connected to the papic app via event hub except vendors
 * share the same pool") the POOL is the common case, not the edge.
 *
 * ⚠ THE OLD BRANCH CONDITION DID NOT ASK THAT QUESTION AT ALL. The route
 * branched on `seatGate === 'exhausted'`, but `papic_capture_points_available`
 * already ADDS the pool in, so that verdict means "her own balance AND the pot
 * together are short" — true for a pool guest who never owned a credit. The
 * honest discriminator is the OTHER probe the route already makes:
 * `papic_event_points_remaining_for_seat` returns `PAPIC_POOL_NOT_BINDING`
 * (2147483647) if and only if `papic_seat_dedicated_points(seat) > 0`.
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
 * The same question, asked from the RECORD seam, where the refusal carries no
 * cause of its own.
 *
 * ⚠ AND THAT SEAM IS NOT A RARE RACE. The presign deliberately gates a clip at
 * `PAPIC_CLIP_COST_MIN` — the cheapest band, so a shooter with 3 credits is not
 * refused a URL for a two-second clip she can plainly afford — so a LONG clip
 * routinely passes the presign and is refused by `papic_record_seat_capture`.
 * The camera therefore latches `ownCamera` from every successful presign and
 * answers from that, rather than defaulting a guest with a camera of her own to
 * "the celebration ran out".
 *
 * Unknown (null/undefined) falls to the pot, the same conservative direction as
 * `resolveExhaustionCause`.
 */
export function exhaustionCauseFromOwnCamera(
  hasOwnCamera: boolean | null | undefined,
): PapicExhaustionCause {
  return hasOwnCamera === true ? 'own_camera' : 'event_pool';
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
 * The next step — and whether what just ran out comes back.
 *
 * @param opts.buyOffered must be the SAME boolean that decides whether the
 *   "add more shots" panel is actually mounted (`papicGuestBuyEnabled`).
 *   Naming a remedy that is not on the screen is its own small lie, and a dead
 *   control makes working code look broken.
 * @param opts.dailyBudget whether THIS seat's tier carries a non-null
 *   `points_per_day`. DERIVED, never assumed — see the docblock: the honest
 *   sentence is as tier-dependent as the false one was, and hardcoding either
 *   direction is the same defect.
 *
 * ⛔ NEITHER SENTENCE MAY SAY THE EXHAUSTED BUDGET COMES BACK, because neither
 * of them does: the dedicated bucket is a lifetime bucket by the live SQL's own
 * words, and the shared pool carries no date at all. When a daily allowance
 * ALSO exists for this camera, that is said — and said alongside which budget it
 * is not, so "tomorrow" can never be read as applying to the one that refused.
 *
 * ⛔ AND BOTH MUST NAME WHO CAN ACT. She cannot top up a pool she shares with
 * every other guest; the couple can. A refusal that is accurate and still a
 * dead end is the same conversation-ender as the lie was.
 */
export function exhaustionDetail(
  cause: PapicExhaustionCause,
  opts: { buyOffered: boolean; dailyBudget: boolean },
): string {
  if (cause === 'own_camera') {
    return [
      'The shots added to this camera are spent, and a camera’s own shots don’t come back.',
      opts.dailyBudget
        ? 'This camera’s daily allowance does reset tomorrow — the shots you added don’t.'
        : null,
      opts.buyOffered
        ? 'Add more shots below, or ask the couple to top up this camera.'
        : 'Ask the couple to add more shots to this camera.',
    ]
      .filter((part): part is string => part !== null)
      .join(' ');
  }
  return [
    'Everybody here shares one set of shots and they’re all spent. The shared set doesn’t refill.',
    opts.dailyBudget
      ? 'A camera’s own daily allowance resets tomorrow — the shared set doesn’t.'
      : null,
    opts.buyOffered
      ? 'Only the couple can add more to it — or you can add your own shots below.'
      : 'Only the couple can add more.',
  ]
    .filter((part): part is string => part !== null)
    .join(' ');
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
  // ⚠ "your", not "these". The visible roll is trimmed to ROLL_MAX, so a
  // sentence anchored on what is on screen would misreport a long night. These
  // two figures are session counters that are never trimmed.
  return {
    headline: `${landed} of your ${total} shots landed.`,
    detail:
      // ⛔ "THE SHOTS", NEVER "YOUR CREDITS". Measured in production: not one
      // of `papic_event_pool_status`, `papic_capture_points_available` or
      // `papic_camera_points_remaining` reads `papic_guest_spend_ceilings` — the
      // pool subtracts `papic_seat_allocations` and nothing else. A guest's
      // ceiling is a LIMIT on what she may take and it holds NOTHING back for
      // her: every credit comes out of one shared pot, first come first served,
      // and a named guest can arrive to find it empty and her number worth
      // nothing. Second person plus a possessive is exactly how a limit reads as
      // a reservation, and this sentence fires at the moment she is most likely
      // to believe it.
      // (A camera's DEDICATED balance IS a real reservation — `papic_seat_
      // allocations` is deducted from the pot by `papic_event_pool_status` —
      // which is why the own_camera copy may say "added to this camera" and this
      // one may not.)
      `The other ${refused} ${refused === 1 ? 'wasn’t' : 'weren’t'} saved — ` +
      `the shots ran out partway through.`,
  };
}
