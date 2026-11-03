## 2026-11-03 · feat(guests): the List's ≡ is a "Show & sort" sheet; its actions move to their own places

Owner, 3 Nov: approved `docs/prototypes/guests_filter_popup_2026-11-03.html` (PR #7211), then "so fix their locations" —
the filter only filters.

- New `guests/_components/guests-filter-sheet.tsx`: a `GuestPopup` from the bottom — "Show & sort · N applied"; Who you
  see (Show ▾ · +1s ▾ when the list has +1s) · How it is laid out (Group by ▾ · Sort ▾), each the shipped `ChosenRow`
  (one PickMenu, title + one line, ⓘ); Clear all + "Show N guests". Options and rules unchanged (`lib/guests-filter.ts`;
  "Asking to join" stays in Show; a new Group by still clears +1s via `pickFilter`). `lib/guests-filter.ts` gains
  `guestsFilterApplied`.
- ＋ Add ▾ on the List's thumb row: Type a name (focuses the field — still the add) · From your people · Import a file
  (the shipped `ADD_WAYS` / `openAddWay`). `ThumbRow`'s right seats now take a `ThumbNode`.
- ☑ Select on the List's top row (same select mode and bulk bar).
- Guests ⚙ › "Download as Excel" (the shipped `useGuestsExcel` save, handed in by `GuestsExcelContext`; not on a failed copy).
- The Map's ≡ is unchanged.
- 🔒 `the-filter-sheet-only-filters.test.ts` (new); re-anchored to the new places: `search-or-add`, `the-fable-card-and-rows`,
  `the-guest-list-sheet-is-calm`, `thumb-row-order-and-field-share`, `a-simple-event-has-no-sides`, `lib/guest-export-file`.

SPEC IMPACT: Reverses the 2026-10-25 "remove the +" on the List (owner 3 Nov, relayed) — ＋ Add ▾ is a menu, not the old
bare round. DECISION_LOG row needed for the ≡ → "Show & sort" sheet and the four moved actions.
