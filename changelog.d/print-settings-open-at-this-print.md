## 2026-10-31 · feat(prints): the ⚙ sheet opens at the print on screen

Owner, verbatim: *"Yes follow your recommendation"* — the recommendation: when you tap ⚙ on a print, open the same sheet already
scrolled to that print's own section, with "On every print" still above it; nothing hidden or split into separate sheets.

The Prints page's one ⚙ (`StudioPrintSettingsDoor`) still opens the one `StudioPrintSettings` sheet. The carousel now tells the
prints store which print is on screen (`setPrintOnScreen`, `prints-view-store.ts`); as the sheet opens, a layout effect on `open`
scrolls its body instantly, before paint, so that print's section sits at the top (`printSettingsOpenAt`,
`lib/studio-prints-settings.ts`). Only prints whose file a heading's switches change have a section of their own
(`PRINT_SETTINGS_SECTION_OF`: Invitation → The invitation · Finer Details → The Finer Details · Event pass → Passes · Our Story
poster → Our Story poster · Seat plan and the entrance chart → Seat plan & the door); every other print opens at the top. A
section near the end gets just enough blank room under the last section to reach the top. Every section stays drawn and the
fields stay mounted while shut. Guarded by `apps/web/lib/print-settings-opens-at-this-print.test.ts`.

SPEC IMPACT: DECISION_LOG.md row "PRINTS ⚙ OPENS AT THE PRINT ON SCREEN" (2026-10-31) — records the owner's approval; no other spec file changes.
