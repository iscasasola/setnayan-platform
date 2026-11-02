## 2026-10-02 · fix(maker): Details works after Prints; re-tapping the current theme can hand the look back

Two small dead-button fixes found auditing #6242.

- **Details after Prints.** Pressing Prints opens Details on the first print; pressing Details afterwards kept that print as the open item, so the highlight stayed on Prints and Details looked dead. Details now opens on its own first item (`DETAILS_FIRST_ITEM`, the item a fresh press opens; an item the couple is already on stays) and takes the highlight; Prints re-opens a print. Both doors run one pure reducer, `makerPressDoor` (`maker-bar.ts`).
- **Re-tapping the current theme.** Details › Theme dropped a tap on the theme already picked, so a couple with their own page colour, button colour or typeface could not hand the look back to the theme without picking another one first. The re-tap now sends the same one-pick reset (`THEME_OWN_LOOK_RESET`) when any of the three is set (draft over live — `hasOwnLook`), and stays a no-op when nothing is overridden. The three columns ride the existing `mood_feel_key` read on the launch page: no new query, no new server action.

Tests: Prints-then-Details driven through the reducer (Details highlighted, item not a print, Prints re-opens a print); the re-tap sends the reset with an override and not without; each sabotaged once.

SPEC IMPACT: None
