/**
 * papic-credit-need.ts — "HOW MANY DO I NEED?" in the Add more sheet (owner 2026-10-23: *"make it easier to purchase
 * more. with the choice to compute how many to add and a button to purchase"*).
 *
 *   guests coming × credits per guest − credits left = "You need about N more"
 *   → the stepper jumps to the SMALLEST catalogue rung that covers N; above the top rung it lands on the top one and
 *     says so ("the biggest pack; add again after").
 *
 * 🔑 "DON'T GUESS" ON MONEY (owner, 2026-08-31): every input is the event's own — the head count the allotment rule
 * divides by (a refused read is said, never 0), and the per-guest number only when the couple has typed one. With no
 * per-guest number the helper ASKS; it never invents one. Pure — `papic-credit-need.test.ts`.
 */

/** Credits still needed, or null when an input is unknown (then the helper says which one, and computes nothing). */
export function creditsNeeded(i: { coming: number | null; perGuest: number | null; left: number | null }): number | null {
  if (i.coming === null || i.perGuest === null || i.left === null) return null;
  if (!(i.coming >= 0) || !(i.perGuest >= 0)) return null;
  return Math.max(0, Math.ceil(i.coming * i.perGuest) - Math.max(0, i.left));
}

/**
 * The rung that covers `need`: the smallest whose points reach it. `top` = even the biggest does not (then the top rung).
 * `enough` = nothing more is needed (the first rung stays, the words say so). Rungs arrive smallest first.
 */
export function rungForNeed(rungs: readonly { points: number }[], need: number): { index: number; top: boolean; enough: boolean } {
  if (rungs.length === 0) return { index: 0, top: false, enough: need <= 0 };
  if (need <= 0) return { index: 0, top: false, enough: true };
  const at = rungs.findIndex((r) => r.points >= need);
  if (at < 0) return { index: rungs.length - 1, top: true, enough: false };
  return { index: at, top: false, enough: false };
}
