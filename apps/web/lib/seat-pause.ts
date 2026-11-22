/**
 * WHO PAUSES ON A SMALLER PLAN, AND WHO COMES BACK (supplier roles d–h (g); owner 21 Nov, DECISION_LOG "YES TO ALL"
 * item 3 — overturns ruling 5683 "everyone stays"):
 *   · the plan holds `cap` counted seats; the founder never counts and always stays; the free Helper rides free and stays
 *     (`teamSeats`, lib/vendor-free-helper.ts — the one count the invite gate uses);
 *   · the OLDEST counted seats stay and the newest pause first (controller row 7: "if nobody picks, the newest pause
 *     first" — the Shop Manager's own pick is the switch sheet's, on the plan page, which d–h leaves out, row 11);
 *   · a seat a manager locked by hand (deactivated, NOT by the plan) is never touched — it neither counts nor returns;
 *   · when the plan has room again, the plan-paused seats come back, oldest first.
 * PURE — no reads, no clock. 🔒 lib/seat-pause.test.ts
 */
import { FREE_HELPER_SEATS, isFreeHelperSeat } from './vendor-free-helper';

export type PauseMember = {
  memberId: string;
  userId: string;
  role: string;
  duty: string | null;
  createdAt: string;
  deactivatedAt: string | null;
  pausedByPlanAt: string | null;
};

export function seatsToPauseAndResume(
  members: ReadonlyArray<PauseMember>,
  founderUserId: string | null,
  cap: number,
): { pause: string[]; resume: string[] } {
  const inPlay = members
    .filter((m) => m.userId !== founderUserId && (m.deactivatedAt === null || m.pausedByPlanAt !== null))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const freeHelpers = inPlay.filter((m) => isFreeHelperSeat({ role: m.role, duty: m.duty })).slice(0, Math.max(0, Math.floor(FREE_HELPER_SEATS)));
  const freeIds = new Set(freeHelpers.map((m) => m.memberId));
  const counted = inPlay.filter((m) => !freeIds.has(m.memberId));
  const room = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : counted.length;
  const stay = new Set([...freeIds, ...counted.slice(0, room).map((m) => m.memberId)]);
  return {
    pause: inPlay.filter((m) => !stay.has(m.memberId) && m.deactivatedAt === null).map((m) => m.memberId),
    resume: inPlay.filter((m) => stay.has(m.memberId) && m.pausedByPlanAt !== null).map((m) => m.memberId),
  };
}
