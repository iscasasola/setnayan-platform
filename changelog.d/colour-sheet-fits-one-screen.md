## 2026-10-17 · feat(colour-picker): the one colour sheet fits one phone screen — Mood Board + Recently used, no scroll

Owner, on the Attire › Shirt colour sheet: *"maybe there is a better way to arrange this scroll free. so color
code box can be viewed easily. Just have the Moodboard and Recently Used 5 colors."* The ONE picker
(`colour-picker-sheet.tsx`, every caller: Attire parts, Style › Colour wells, Look colours, Studio colour rows,
the Mood Board's swatches) now draws: the AA line (when the caller hands a ground) · **Your Mood Board** as one
row of five dots (name under each, the code on the one chosen now) · **Recently used** — up to five this person
last picked in the picker on this event, newest first, never a Mood Board colour, hidden when empty
(`lib/colour-picker-recent.ts`, this browser only, keyed by account + event via `LastSeenScope`, every storage
call wrapped) · **Custom** (wheel + name/code + ✓ Use) · the caller's quiet row. "Goes with your Mood Board",
"From your photos" and the sixteen Swatches are gone (with `PICKER_SWATCHES` / `pickerSuggestions` /
`PICKER_GOES_WITH`). Same pick behaviour, saves and Pro rules. The dev Maker lab gets a lab `LastSeenScope` so
Recently used works there too.

Guards: `tests/e2e/the-colour-sheet-fits-one-screen.spec.ts` (rendered at 375×812 and 390×844 in the Maker
sheet and the centred panel: no scroll, Custom on screen, one row of five each, ≥44 px dots, no removed shelf);
`lib/colour-picker-recent.test.ts` (≤5, newest first, deduped, never a Mood Board hex, per account + event,
storage failure → empty); `every-studio-colour-opens-the-one-picker.test.ts` A/B and two neighbours updated.

SPEC IMPACT: DECISION_LOG needs a row for the owner's 2026-10-17 picker ruling (supersedes the picker shelves
of the 2026-10-06 "AUTO PALETTE BESIDE SAVED" row and the 2026-10-08 "mood board colors, then the complementing
colors" order). Not applied by this builder (controller instruction: do not edit the corpus checkout) —
flagged for the controller.
