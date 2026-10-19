/**
 * empty-marketplace.ts — the app hides an empty shop shelf; the web says so.
 *
 * Owner, DECISION_LOG 2026-10-19 "FIVE CONTROLLER RECOMMENDATIONS APPROVED"
 * (2): THE EMPTY MARKETPLACE IS HIDDEN INSIDE THE APP until shops exist. A
 * reviewer opening the iPhone app should not land on "No supplier has opened a
 * shop yet" (App Review 2.1 completeness / 4.2 minimum functionality). The web
 * is unchanged — there the plain line is the honest empty state
 * (`an-empty-shop-shelf-says-so.test.ts`).
 *
 * 🔑 KEYED ON A MEASURED ZERO, NEVER ON "NOT MANY". `count` is the shelf's own
 * count; `null` is a FAILED read, which is not "empty" — it keeps saying
 * "couldn't load" everywhere. The moment one shop is live the count is 1 and
 * the shelf shows again, in the app too, with no switch to flip.
 *
 * `lib/the-app-hides-the-empty-marketplace.test.ts` requires every file that
 * prints an empty-marketplace sentence to ask this function.
 */
export function hidesEmptyShelfInApp(storeShell: boolean, count: number | null): boolean {
  return storeShell && count === 0;
}
