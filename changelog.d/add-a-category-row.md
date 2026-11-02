## 2026-10-26 · feat(suppliers): "Add a category" is the category list's last row

Owner, verbatim, on `prototypes/suppliers_add_category_row_2026-10-26/index.html`: *"yes. this will apply to the
inspiration board as well"* (DECISION_LOG 2026-10-26 "ADD A CATEGORY IS THE LIST'S LAST ROW"). Suppliers half only.

- `shortlist-categories.tsx`: the "Need something else? ＋ Add to your event" sentence and ▾ pill under Find's list
  are now ONE full-width row in the flat category row's own shape (56 px, the 36 px disc, 12 px gap, 15 px name over
  the form-row second line): a ＋ outlined in the accent · **Add a category** · the first three categories not on the
  event, in the list's order ("Food trucks, photo booth, fireworks…") · ›. The whole row is the button of the SAME
  grouped dropdown (`PickMenu`, `stickyGroups`, same options, same `addTileToPlan`); the `planError` line stays under
  it; `data-add-to-event` / `data-add-category` kept. A dashed edge, because the row is pressable.
- `PickMenu` gains `trigger` (types + notes in `pick-menu-types.ts`): drawn inside the button in place of the pill's
  words, arrow and look. One comment moved out of `pick-menu.tsx` to stay under its inline-size line (9,754 B ≤ 9,800).
- Copy (`lib/explore-info-copy.ts`): `ADD_CATEGORY_TITLE`, `addCategoryPreview` (acronyms keep their capitals);
  `ADD_TO_EVENT_ASK` and `ADD_TO_PLAN_HEADING` retired — they named only this control.
- Guard: `app/dashboard/[eventId]/vendors/add-category-row.test.ts` (R1–R4; sabotage — the old sentence put back
  beside the row — went red). `find-rows.test.ts` T4 and `explore-in-plan.test.ts` follow the new words.

SPEC IMPACT: None — the decision row and prototype are already in the corpus (`DECISION_LOG.md`, commit 7d6c5553).
