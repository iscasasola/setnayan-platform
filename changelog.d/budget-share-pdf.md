## 2026-10-29 · feat(budget): one Share button hands the phone a real PDF of the budget

Owner, from the iPhone app: *"Print Budget can be just a share button if it has the print and share there as well? and
maximize every other method to share that file? Buttons not shown on design template. fix how that pdf file/page looks"*.

- Budget's **Print budget** link (an HTML print page with "‹ Done" and a print button inside it) is replaced by ONE
  **Share** — the house `ActionButton`, through the shared save (`usePrintSave`): on a phone or tablet (app or browser)
  the system share sheet (Print · Save to Files · AirDrop · Messages · Mail · Viber · Messenger…); on a computer the PDF
  downloads and a quiet **Print** opens it in the browser's PDF viewer (never inside the app). The spreadsheet and the
  calendar file move onto the same template and save. `PrintBudgetLink` is deleted.
- New `lib/budget-pdf.ts`: an A4 PDF drawn with the shipped `pdf-lib` pipeline in the house type (Jost + Fraunces
  outlines from `public/logo-fonts`, each glyph written once as a form XObject; an invisible text layer keeps it
  searchable), warm paper, terracotta rules, the Setnayan mark. Head (event · date as precise as the Hub holds it ·
  the Hub's venues), Target · Agreed · Paid · Owed with one meter, each category as a section with its lines and its
  total, planned-only categories, and "Generated … · Page n of N" on every page. Rows never split across pages.
- 🛑 Honest reads: `budgetPdf` refuses when any money read was refused, and the export route now refuses a PARTIAL
  resolver too (before, only a missing one) — for the CSV as well. An absent target prints "—", never ₱0.
- The export route serves the PDF (default / `?format=pdf`) or the CSV; the HTML page is gone.
- `PrintSaveState`'s `saved` keeps the `file` (for the computer's Print).
- Guard: `lib/budget-share-is-one-file.test.ts` (sabotaged twice, red, restored); `lib/budget-export.test.ts` updated.

SPEC IMPACT: None — implements the owner's 2026-10-29 instruction on an existing surface; no locked decision changes.
