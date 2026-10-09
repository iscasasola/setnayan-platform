## 2026-10-09 · fix(seat-plan): the table sheet's blank black button is "Done" in the accent, with its word

The solid black oval beside "Delete this table" was the sheet's own "Done" (it closes the table's sheet): drawn `phoneBtn` + `bg-ink text-cream`, and `phoneBtn` already carried `text-ink/80`, which won the stylesheet's order — ink words on an ink fill
(measured in Chromium on the compiled sheet: color rgba(44,42,41,.8) on rgb(44,42,41)). Written 2026-10-02 (f4a147c01), older than the chrome change. It is now THE ActionButton — the row's one filled step, brand terracotta, ✓ and "Done", same handler; "Unlink" (same
two-colour clash, `text-ink/80` + `text-mulberry`) is the neutral ActionButton. Guard `a-sheet-button-always-shows-its-word.test.ts`: no seat-plan element carries two text colours, and no seat-plan `<button>` lacks a name or something drawn.
SPEC IMPACT: None.
