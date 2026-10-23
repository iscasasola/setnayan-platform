/**
 * papic-credit-need.ts — "HOW MANY DO I NEED?" in the Add more sheet (owner 2026-10-23: *"make it easier to purchase
 * more. with the choice to compute how many to add and a button to purchase"*).
 *
 *   the named guests' set numbers + everyone else × each − credits left = "You need about N more"
 *   → the stepper jumps to the SMALLEST catalogue rung that covers N; above the top rung it lands on the top one and
 *     says so ("the biggest pack; add again after").
 *
 * 🔑 "DON'T GUESS" ON MONEY (owner, 2026-08-31): every input is the event's own — the head count the allotment rule
 * divides by (a refused read is said, never 0), and the per-guest number only when the couple has typed one. With no
 * per-guest number the helper ASKS; it never invents one. Pure — `papic-credit-need.test.ts`.
 */

/**
 * Credits still needed, or null when an input is unknown (then the helper says which one, and computes nothing).
 *
 * The per-guest shares that EXIST (owner 2026-10-23, the guest-card ruling): every NAMED guest's set number (`named`,
 * their sum and how many), and one number for everyone else (`each` — the couple's "each guest, at most", or what they
 * type into "How many photos each?"). Need = named sum + the rest × each − credits left.
 */
export function creditsNeeded(i: {
  coming: number | null;
  each: number | null;
  left: number | null;
  named?: { count: number; sum: number } | null;
}): number | null {
  if (i.coming === null || i.each === null || i.left === null) return null;
  if (!(i.coming >= 0) || !(i.each >= 0)) return null;
  const named = i.named ?? { count: 0, sum: 0 };
  const rest = Math.max(0, i.coming - named.count);
  return Math.max(0, Math.ceil(named.sum + rest * i.each) - Math.max(0, i.left));
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
