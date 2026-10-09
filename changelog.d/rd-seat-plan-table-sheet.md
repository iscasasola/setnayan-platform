## 2026-10-09 · fix(seat-plan): the table sheet's blank black button is "Done" in the accent, with its word

The solid black oval beside "Delete this table" was the sheet's own "Done" (it closes the table's sheet): drawn `phoneBtn` + `bg-ink text-cream`, and `phoneBtn` already carried `text-ink/80`, which won the stylesheet's order — ink words on an ink fill
(measured in Chromium on the compiled sheet: color rgba(44,42,41,.8) on rgb(44,42,41)). Written 2026-10-02 (f4a147c01), older than the chrome change. It is now THE ActionButton — the row's one filled step, brand terracotta, ✓ and "Done", same handler; "Unlink" (same
two-colour clash, `text-ink/80` + `text-mulberry`) is the neutral ActionButton. Guard `a-sheet-button-always-shows-its-word.test.ts`: no seat-plan element carries two text colours, and no seat-plan `<button>` lacks a name or something drawn.
SPEC IMPACT: None.

## 2026-10-09 · feat(seat-plan): the table's sheet on a phone wears the templates (Form row · dropdown row · Action button · the centred confirm box), handlers untouched

The sheet moved whole into `PhoneTableDock` (`seat-plan-phone.tsx`) — every handler is the editor's own, handed in. The table's name is the Form row's typed answer (kept when it is left, as the box saved on blur;
`renameTable` unchanged) and the shape is the dropdown row; Rotate · Edit chairs… · Link… (the brand tone while it waits for the next table) · Unlink · Done are the ONE ActionButton in one row, Done the single filled step;
"Delete this table" is the danger ActionButton, and the delete's confirm is the centred confirm box (`GuestPopup kind="confirm"`: dark and blurred behind, Cancel first) with the same two answers; a seated guest's "Unseat" is the
quiet ActionButton. Not moved: the seats stepper (− 10/10 +: the app has no counter template), "Seat people" and the Seat-removed Undo strip (the editor's own nodes), "tap · move" and the P1 pill. Saves: each press calls the
same handler (golden recorded before the change, Chromium). No lab draws the seat plan.
SPEC IMPACT: None.

## 2026-10-10 · fix(seat-plan): Unseat is the icon-only ActionButton (the name keeps its room); Delete reads as danger

In a seated guest's row "Unseat" was a 40 px labelled pill that cut the guest's name; it is now the templates' icon-only ActionButton (`iconOnly`, same icon, named "Unseat <guest>", 44 px wide and tall) — the name has 2 px MORE room than before the sheet moved onto the templates. "Delete this table" lost its `quiet` flag (which strips the tone): it is the danger ActionButton's red outlined look, below the verbs, same words and confirm. Handlers unchanged.
SPEC IMPACT: None.
