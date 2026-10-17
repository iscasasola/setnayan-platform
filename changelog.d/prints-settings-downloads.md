## 2026-10-17 · feat(studio-prints): one settings sheet, one Download per piece, View as ▾ on guest prints, All guests ◆, Everything ◆

Owner, verbatim: *"ok on prints"* — DECISION_LOG 2026-10-17 "APPROVED — PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ ON
GUEST PRINTS, ALL GUESTS ◆, EVERYTHING ◆"; prototype `prototypes/prints_settings_and_downloads_2026-10-17.html`.

- **⚙ Print settings** heads Studio › Prints: one row that opens one sheet holding every switch and field that sat inside a piece row
  (On every print · The invitation · The Finer Details · Passes · Our Story poster · Seat plan & the door) with the print words form's one
  Save. The SAME switches, posting the SAME form by `form=`; the sheet is hidden while shut, never unmounted (`studio-prints-settings.tsx`).
- **One Download per piece**: picture · name · size line · size ▾ · Download. The 2D seat plan's "Colours ▾" and the caterer's "File ▾"
  are one dropdown + one Download; the Menu keeps "Edit menu" (the shipped editor, in place). The entrance chart's layout moved into the sheet.
- **Guest prints** — Event pass · Digital ticket (a row of its own now) · Guest QR codes · Table signs & place cards — share ONE View as ▾
  (coming, not replied, maybe): Download is that guest's file (free), All guests ◆ the all-in-one file (Event Hub Pro, the zip's pattern).
  "Pass for ▾" and "Sample (PDF)" are retired. The Event card is not per guest.
- **Routes**: the Guest QR sheet's PDF and the place-card pack's PDF ask the event's Event Hub Pro (their pictures, the chart and one guest's
  file stay free); `/seating/print?guest=<id>` draws one guest's place card; `/api/hub-print/pass?mode=screen&pass_guest=<id>` draws that
  guest's pass; `/api/hub-print/everything` is the set + every guest's pass + the registry, the QR sheet, the pack, the chart, the caterer's
  counts and the 2D seat plan in one PDF (Pro). `isAllInOnePrint` grows to say so.
- **The bar**: "Print settings" first, "Download everything" last under "Everything", and ⬇ opens This piece · Everything ◆.
- The ◆ note's buttons read "Not now" · "Event Hub Pro" (prototype `.note-pro`).
- Guard: `apps/web/lib/prints-settings-and-downloads.test.ts` (6 sabotages, each red); the prints guards follow the ruling.

SPEC IMPACT: None — the ruling is already recorded in the corpus DECISION_LOG (2026-10-17). Open owner questions the prototype itself
flagged are named in the PR body (the QR sheet as the free way out; the seating page's printable HTML pack).
