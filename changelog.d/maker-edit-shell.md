## 2026-11-13 · feat(maker): the Edit shell — a locked tab says Problem → Solution in the rows; the Camera keeps one style

Owner, 13 Nov 2026: *"maker shell approved"* (prototype `prototypes/approved_2026-11-13/maker-toolbar-fable.html` v3) and *"camera one style only."*

Step 1 of the Maker Edit shell. The toolbar's four tabs (Edit · Style · Background · Animate) are the same on every part; a tab with nothing to set on the picked part used to answer a tap with a toast over rows left blank. Now:

- the tab wears 🔒 (drawn by the toolbar's rule set, so the button is still only its word) and a tap opens **Problem → Solution in rows 1–3** (`stage-panel/tool-lock.tsx`) — the part's existing line as the problem, where it IS set as the solution (`makerPartToolLock` in `lib/maker-parts.ts`). A cover word's Background ends in the one tap that selects the Cover Scene. The work area's body stands aside while the lock is up (`data-stage-locked`, also watched by the style cards' sight check).
- **the Camera's Style tab is locked** with the one-style ruling: "The camera has one style." No style picker was added.
- help answer `maker-locked-tab` (Event Hub), a sentence on the Maker tour's `maker-tools` stop, and an ⓘ on the lock's Problem line.

Guards: new `lib/a-locked-tab-says-problem-then-solution.test.ts`; re-aimed (claim unchanged — a grey tool's tap answers with its line and sets no tool) `a-tool-with-nothing-to-do-says-so`, `a-fixed-block-has-its-own-motion`, `the-preview-only-selects`; the anchor and the word "lock" registered in `spotlight-anchors-exist` and `the-couple-books-never-locks` (a locked tab is not a booking).

SPEC IMPACT: None (implements the approved prototype; DECISION_LOG 2026-11-13 rows "Maker Edit shell approved" and "Maker — Camera style" already record it).

## 2026-11-13 · feat(maker): the Edit shell — the Countdown and the cover's Date show the event date and open the date sheet in place

Step 2 (prototype frames 1 and 4; DECISION_LOG 2026-11-13 "MAKER › COUNTDOWN EDIT = THE EVENT DATE, NOT 'OPEN INFO'"). The Countdown's Edit was a door to Info and the cover's Date a link out to Suppliers. Both now show **Event date** — "Sat, 12 December 2026 · Final · 29 days to go", or "Not final yet" with the dates being weighed — and ONE button, "Change date" / "Pick your final date", that opens the SHIPPED date sheet (`FactSheet which="date"`, #7583) over the Maker. One writer (`updateEventDate`); no new date write was added. Row 4: "Suppliers and Home use this date too." The date is the sheet's own read, asked when the part is picked; a failed read says so with Try again.

- `stage-panel/date-edit.tsx` (the rows, loaded on first pick through `date-edit-lazy.tsx`), `lib/maker-date-edit.ts` (the words, pure), `makerPartEditsTheDate` in `lib/maker-parts.ts`.
- `/dev/maker-lab` now answers the date sheet from the Suppliers lab's fixtures (`LabFactSheets`), so the lab opens the real sheet.
- help answer `maker-event-date`.
- the date sheet's two "Help me choose" saves now catch a request that never answers (`fact-sheets.tsx`) — the sheet is reachable from the Maker now, where an uncaught rejection replaces the whole Maker.
- Guard: `lib/the-date-part-edits-the-date-in-place.test.ts`.

Not in this step (still to build from the same prototype): the countdown's own line typed in Edit (it has no stored field today — "Until we say 'I do'" is drawn by `countdown.tsx`), RSVP's reply settings as rows on every stage, E-Gifts' settings in the shell, the March/Seats headings, the Event name field + mark styles, Style sketches, Background tiles, Animate rows, the stage switcher on the caption line, the new styles and the eleven art kits.

SPEC IMPACT: None (implements the approved prototype frames; no corpus change).
