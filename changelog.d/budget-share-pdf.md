## 2026-10-29 · feat(budget): one Share button hands the phone a real PDF of the budget

Owner, from the iPhone app: *"Print Budget can be just a share button if it has the print and share there as well? and
maximize every other method to share that file? Buttons not shown on design template. fix how that pdf file/page looks"*.

- Budget's **Print budget** link (an HTML print page with "‹ Done" and a print button inside it) is replaced by ONE
  **Share** — the house `ActionButton`, through the shared save (`usePrintSave`): on a phone or tablet (app or browser)
  the system share sheet (Print · Save to Files · AirDrop · Messages · Mail · Viber · Messenger…); on a computer the PDF
  downloads and a quiet **Print** opens it in the browser's PDF viewer (never inside the app). The spreadsheet and the
  calendar file move onto the same template and save (`BudgetFileActions`, which `/dev/budget-lab` also draws, its files
  answered by a dev-only `/dev/budget-lab/file`). `PrintBudgetLink` is deleted.
- **A shared Share-as-PDF engine** (owner 2026-10-29, "each print lives where its data lives"): `lib/share-pdf.ts`
  (`sharePdf(doc)` — head · summary · sections with columns, rows, totals · notes · footer/page numbers, on the shipped
  `pdf-lib` pipeline in the house type: Jost + Fraunces outlines from `public/logo-fonts`, each glyph one form XObject,
  an invisible text layer for search/copy; warm paper, terracotta rules, the Setnayan mark; all vector),
  `lib/share-pdf-papers.ts` (documents A4 default · Letter · Long bond; posters A4 · A3 · A2 · A1 · A0 · Custom W×H;
  portrait/landscape), `app/_components/share-pdf-button.tsx` (`SharePdfButton`) and `app/_components/paper-picker.tsx`
  (`Paper ▾`, remembered per device). Budget is its first view (`lib/budget-pdf.ts` maps the budget to a `SharePdfDoc`). Head (event · date as precise as the Hub holds it ·
  the Hub's venues), Target · Agreed · Paid · Owed with one meter, each category as a section with its lines and its
  total, planned-only categories, and "Generated … · Page n of N" on every page. Rows never split across pages.
- 🛑 Honest reads: `budgetPdf` refuses when any money read was refused, and the export route now refuses a PARTIAL
  resolver too (before, only a missing one) — for the CSV as well. An absent target prints "—", never ₱0.
- The export route serves the PDF (default / `?format=pdf`) or the CSV; the HTML page is gone.
- `PrintSaveState`'s `saved` keeps the `file` (for the computer's Print).
- Guard: `lib/budget-share-is-one-file.test.ts` (7 tests incl. the paper matrix; sabotaged three ways, red, restored);
  `lib/budget-export.test.ts` updated; the details-lab guard now also lists the Budget lab's file stand-in.

SPEC IMPACT: None — implements the owner's 2026-10-29 instruction on an existing surface; no locked decision changes.
