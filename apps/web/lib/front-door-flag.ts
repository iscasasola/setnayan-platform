/**
 * New front door rollout flag — a ROLLOUT switch, not a legal gate.
 *
 * WHAT IT SWITCHES. `/` currently renders `HomeReskin` — the ELN cinematic
 * no-scroll gate + 5-pillar dock, owner-approved 2026-06-29. Redesign Session 4
 * replaces it with the YouTube-shaped front door drawn in
 * `prototypes/front_door_and_seam_2026-08-12.html`.
 *
 * 🔒 WHY A FLAG AT ALL, WHEN THE OWNER ALREADY SAID RETIRE IT.
 * He did, explicitly, on 2026-08-13 ("yes we want the new website" → "Retire it
 * completely"), and that ruling is recorded in `DECISION_LOG.md`. The flag is
 * not hedging on the decision — it is about ORDER. Deleting a finished,
 * owner-approved page before its replacement has been looked at on a real
 * screen is the one step in this change that cannot be undone, and this project
 * has a standing rule that the owner LOOKING beats every automated check.
 *
 * So: the new door is built behind this flag, `HomeReskin` stays untouched
 * until the flip, and the June design is retired IN THE FLIP — one commit, once
 * somebody has actually seen what replaces it.
 *
 * ⚠ THE VALUE MUST BE EXACTLY `'1'`. `true` reads as OFF. This is the same trap
 * that made `NEXT_PUBLIC_LIFE_STORY` look inert on 2026-08-12, and a
 * `NEXT_PUBLIC_*` inlines at BUILD time — so flipping it in Vercel requires a
 * rebuild WITHOUT build cache or the old value stays compiled in.
 *
 * Kept as a function rather than a module const so it is re-read per request
 * rather than captured at import — same convention as `lifeStoryEnabled()`.
 */
export function newFrontDoorEnabled(): boolean {
  return process.env.NEXT_PUBLIC_NEW_FRONT_DOOR === '1';
}
