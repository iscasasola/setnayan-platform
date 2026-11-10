/**
 * 🏷 THE SETNAYAN MARK FOLLOWS THE EVENT'S PLAN — ONE HELPER (DECISION_LOG 2026-11-04 "SETNAYAN MARKINGS BY PLAN:
 * FREE = THE WATERMARK · PLUS = MINIMAL · PRO = NONE"; Build 6 Lane L).
 *
 *   · Free        → `watermark` — "Powered by Setnayan · setnayan.com", as today; the free print's line.
 *   · Event Plus  → `quiet`     — the watermark comes off; ONE small, quiet "Made with Setnayan" stays (the Event Hub's
 *                                foot; on paper, the tiny low-contrast mark). ⚠ Placement shown to the owner in the PR's
 *                                Now-beside-Proposed shots (build-notes/shots/b6-lane-l/) — his OK before it ships.
 *   · Event Pro   → `none`      — no Setnayan mark anywhere: the Event Hub, its doors, prints and passes.
 *
 * Pure and client-safe: the plan is READ by the server from the shipped entitlement readers
 * (`eventSetnayanMark`, lib/setnayan-mark-by-plan.server.ts) — never a new flag, never a prop a browser sent.
 * Held per plan by `lib/setnayan-mark-by-plan.test.ts`.
 */
export type SetnayanMark = 'watermark' | 'quiet' | 'none';

/** What the event's plan allows. `pro` = Event Pro (everything); `plus` = Event Plus. */
export function setnayanMarkFor(plan: { pro: boolean; plus: boolean }): SetnayanMark {
  if (plan.pro) return 'none';
  if (plan.plus) return 'quiet';
  return 'watermark';
}

/** The free watermark's words (unchanged). */
export const SETNAYAN_WATERMARK_WORDS = 'Powered by Setnayan · setnayan.com';
/** Event Plus's one quiet mark. */
export const SETNAYAN_QUIET_WORDS = 'Made with Setnayan';

/** The words a surface prints for this mark, or null for none. */
export function setnayanMarkWords(mark: SetnayanMark): string | null {
  return mark === 'watermark' ? SETNAYAN_WATERMARK_WORDS : mark === 'quiet' ? SETNAYAN_QUIET_WORDS : null;
}

/**
 * The print's brand for this mark, never LOUDER than the look's own (a Prints-part print already carries the quiet
 * mark, not the line): watermark → the look's own · quiet → the tiny mark · none → nothing.
 */
export function printBrandForMark(mark: SetnayanMark, lookBrand: 'line' | 'mark' | 'none'): 'line' | 'mark' | 'none' {
  if (mark === 'none' || lookBrand === 'none') return 'none';
  if (mark === 'quiet') return 'mark';
  return lookBrand;
}
