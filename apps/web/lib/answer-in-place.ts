/**
 * A PRESS THAT ANSWERS IN PLACE — the field a caller sends when it has already
 * drawn the answer itself (owner 2026-10-08: a press answers at once; owner
 * 2026-10-12: "Save and Remove on a card" must stop refreshing the whole page).
 *
 * 🔑 WHY A FIELD AND NOT JUST "DROP THE router.refresh()". In Next 15 ANY
 * `revalidatePath` inside a server action makes that action's response carry a
 * full render of the page the caller is standing on
 * (`skipFlight: !workStore.pathWasRevalidated` in the action handler). On the
 * couple's Suppliers page that is the whole loader — about 47 reads — for one
 * card, and the caller's own `router.refresh()` then asked for it a second
 * time. Dropping only the refresh would still leave one whole-page render per
 * press.
 *
 * So a caller that drew the answer sends `answer_in_place=1` and the action
 * skips its `revalidatePath` calls. The caller then OWES one `router.refresh()`
 * — paid once, for every press since, when the couple leaves the body that drew
 * the answers (the Build and Booked bodies, and the router cache, catch up
 * then). That debt is `markBenchDirty` / `payBenchDebt` in
 * `vendors/_components/bench-local.ts`. Every other caller sends nothing and
 * gets exactly the behaviour it always had.
 */
export const ANSWER_IN_PLACE_FIELD = 'answer_in_place';

/** True when the caller has drawn the answer itself (see above). */
export function answersInPlace(formData: FormData): boolean {
  return formData.get(ANSWER_IN_PLACE_FIELD) === '1';
}
