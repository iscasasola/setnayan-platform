## 2026-10-23 · fix(supplier page, thumb row): Look opens and shuts wherever it sits; its colour circle opens the one colour picker

Owner, on a screenshot of Shop › Your page › Look: *"pressing on look does not expand. press the color circle will show
color picker we have designed"*.

**Cause of the dead press (reproduced in the lab, Chromium and WebKit, 375 × 812).** The one thumb row
(`components/thumb-row.tsx`, "no band", shipped 22 Oct) spans the full screen width, and its `.row` set
`pointer-events: auto`. So a strip about 36 px tall, just above the dock, took every press, even though the only
controls are the two rounds at the right. A row scrolled into that strip (Look, Your web address, or a guest or supplier
on the other list screens) would not open or close, whichever word you pressed. Now the row passes the press to the page
everywhere except its controls (`.row[data-thumb-row] { pointer-events: none }`, with its children taking presses back).
The attribute makes this rule beat a host's `.lower > * { pointer-events: auto }`. It applies on every screen that
draws the one row.

**The circle.** The Look row's colour circle is now a button of its own, placed beside the row's head through the shared
`Fold`'s new `leadPress` slot (no button inside a button). Pressing it opens the Mood Board's `ColourPickerSheet`, the
same picker every Studio colour opens, loaded only when pressed. A colour picked there goes into the page draft the same
way the dropdown does. A preset's own swatch is stored as that preset's key (Champagne stays as `''`, meaning no
override). Any other colour is stored as `#RRGGBB` in `vendor_profiles.microsite_accent` (a text column with no CHECK
constraint, so no migration is needed). `isValidAccentKey` now accepts a hex code. `micrositeAccentVars` builds the
public page's 3-stop ramp from a hex code using the champagne ramp's own ratios. The dropdown adds a "Your own colour ·
#…" option, so the dropdown and the circle always agree.

Every other row on Your page was walked: all nine folds open and close on their head. The two link rows are links, and
"Awards and badges" is a plain statement with no arrow. Guard:
`app/vendor-dashboard/website/the-look-circle-opens-the-one-picker.test.ts`.

SPEC IMPACT: A shop's Look can now be any colour, not only one of the six presets. Before this change the code comment
(and the 2027-04 migration's column comment) said "curated set, not free hex". The owner's request for the designed
picker, which has a Custom row, is the basis for the change. Flagged for owner sign-off in the PR. No corpus file named
the preset-only rule, so no corpus edit was made.
