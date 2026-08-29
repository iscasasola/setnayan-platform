/**
 * papic-crew-roster.ts — what the couple reads next to each crew camera.
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
 * "Your photo crew" rendered `Boolean(claimer_user_id)` and nothing else: a
 * "Claimed" pill and the sentence "A friend has this seat and can shoot."
 * WHICH friend was never said. Every one of the non-test uses of that column
 * app-wide is an authorization check or a count — nothing anywhere joined a
 * seat to a person for display. So a host with five cameras out could see that
 * four were taken and had no way to tell who was holding which, or whether any
 * of them had run out of shots.
 *
 * ── WHY THE SHAPING IS PURE ─────────────────────────────────────────────────
 * Both values arrive from somewhere that can legitimately answer "I don't
 * know": a display name may be unset, and the remaining-shots probe may fail or
 * return a sentinel. Those states are the whole risk here — a blank where a
 * name should be reads as a bug, and a number that is wrong is worse than no
 * number on a screen the host is using to decide whether to hand out another
 * camera. Keeping the decisions pure means they can be tested without a
 * database.
 */

/**
 * `papic_camera_points_remaining` returns INT_MAX when the seat's tier carries
 * no per-day budget at all — its "uncapped" answer, not a count. Printing it
 * would put "2,147,483,647 credits left" in front of a couple.
 */
export const PAPIC_UNCAPPED_REMAINING = 2147483647;

/**
 * Anything at or above this is the sentinel or an absurd budget; treat as
 * uncapped rather than trusting the digits. A real event pool is thousands.
 */
const UNCAPPED_FLOOR = 1_000_000;

/**
 * The name to print for whoever is holding a camera.
 *
 * Returns null when there is genuinely nothing to show, so the caller can keep
 * its existing sentence rather than rendering an empty gap. A claimed seat
 * whose holder never set a display name is a real state (a seat can be claimed
 * from an anonymous session), and "Someone" is the honest word for it — it is
 * still strictly more than the screen said before.
 */
export function crewHolderName(displayName: string | null | undefined): string {
  const trimmed = typeof displayName === 'string' ? displayName.trim() : '';
  return trimmed.length > 0 ? trimmed : 'Someone';
}

/**
 * How many shots this camera has left, as a sentence — or null when the number
 * is not knowable, in which case the caller says nothing rather than guessing.
 *
 * ⚠ NULL AND ZERO ARE DIFFERENT ANSWERS AND MUST STAY THAT WAY. A failed probe
 * is null: say nothing. Zero is a real, important state — that camera has
 * stopped — and it is the one the host most needs to see.
 */
export function crewShotsLeftLabel(remaining: number | null | undefined): string | null {
  if (typeof remaining !== 'number' || !Number.isFinite(remaining)) return null;
  if (remaining >= UNCAPPED_FLOOR) return null;
  const n = Math.max(0, Math.trunc(remaining));
  if (n === 0) return 'Out of shots';
  return `${n.toLocaleString('en-PH')} ${n === 1 ? 'shot' : 'shots'} left`;
}
