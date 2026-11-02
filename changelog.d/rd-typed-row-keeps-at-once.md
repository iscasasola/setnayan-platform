## 2026-10-09 · fix(forms): a typed row keeps the moment its field is left, not after the fold

`TypedRow` ran its keep (and, inside a form, the hidden carrier's one `input` + `change`) after the field's fold animation: measured in Chromium ~290 ms after the tap-out
(the E-Gifts thank-you words reached the server ~780 ms after it), so a ✓ Apply pressed in that gap published before the words were drafted. The keep now happens in `end` —
tap out, Enter, a tap on another row — with the carrier already holding the kept words, and the fold only shows it (1–15 ms after the tap-out). Still exactly one keep per edit,
none for an unchanged value, none while typing, ✕ leaves it as it was, the Undo's `sn-restore` untouched. Used by Studio › Info, Guests › Setup, the guest card (through `fieldName`) and the toolbar's Edit.
Files: `app/_components/form-row.tsx`; guard `lib/the-typed-row-keeps-at-once.test.ts`.
SPEC IMPACT: None.
