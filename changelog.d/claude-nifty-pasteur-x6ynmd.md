## 2026-11-14 · style(suppliers): T09 — the couple's Suppliers page follows the design template

Batch T09 of `design_template_full_audit_2026-11-14.md` (Setnayan-specs). Every fact and action kept; shared pieces only.

- **Cancel booking** — the hand-drawn overlay is the app's one confirm box (`ConfirmDialog`), "it worked" is the app's one toast (`useToast`), the trigger and "Report a problem" wear the shared button classes (rules 3 · 9 · 14).
- **Replace on your build?** — the hand-rolled sheet is the house pop-up (`ScheduleSheet` + `SheetFoot`), its two choices equal-width `ActionButton`s; the In-build / Remove pair and "Add to build" are `ActionButton`s (rules 3 · 9).
- **Waiting for quotes** — plain hairline rows (no card per row), the wait as the shared amber chip (`Badge`), a terracotta ›, tokens only; the 9 px typewriter captions are gone (rules 2 · 5 · 13 · 14).
- **Book a past supplier again** — no card; the two native dropdowns are ▾ `PickMenu`s posting through hidden inputs (same server action); the stored status code is a word chip; Accept / Cancel / Request are `ActionButton`s; the explaining line sits behind ⓘ (rules 2 · 4 · 5 · 7).
- **Quotes are in** — the one framed next step on the warm surface; the result and the marketplace fallback are plain rows; every button is `ActionButton` (rules 2 · 3).
- **Coordinator proposed booking** — a section label and gold-edged rows that need you, `ActionButton`s (rules 2 · 3 · 11).
- **Watch guard** — a coloured edge and plain rows instead of a card holding cards (rules 2 · 11).
- **Team controls · Compare plans** — Clear candidates, Rename and Load are `ActionButton`s; no `sn-tile` boxes; saved plans are 56 px rows; one plain empty line; the compare legend behind ⓘ (rules 2 · 3 · 6 · 7).
- **Type** — no 9–11 px words anywhere in the batch (12 px floor; the category search's 8–9 px typewriter captions are 12 px plain text); no serif-italic headings or money; typewriter section captions are the template's grey capitals; money is bold in the body face with even digits; quick view's status is the shared chip (rules 1 · 13 · 14).
- **Motion** — the category search rises at the one motion speed (`--sn-dur-rise` / `--sn-ease-rise`) instead of its own 0.25–0.3 s (rule 15).
- Guards re-pointed, not weakened: `drawn-in-place.baseline.txt` drops cancel-booking-button (it no longer draws a full-screen dialog in the page — the baseline only shrinks); `the-panel-is-440` drops accordion-build (it no longer hand-rolls a sheet — the guard's own "re-point if rebuilt"); `gold-is-not-text` bill shrinks by the two gold icons that were removed; the port baseline is regenerated (the hand toast and a ref type left the vendors route).

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`); no decision changed.
