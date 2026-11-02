## 2026-10-29 · fix(print): a guest's name is never cut with "…" on any printout

Owner, on the printouts: *"same goes to the print outs where some names get the ..."* · *"we do not want that"*.

- New `lib/print-name-fit.ts` (`fitName`): ONE name fitter for every print backend (the print op pipeline, pdf-lib's
  standard fonts): one line → shrink → wrap at the largest size → at the print minimum (`PRINT_MIN_BODY_PT`) wrap into
  as many lines as it takes, a too-long word broken between letters. Never "…"; the lines give the name back whole.
- Seat plan (`lib/seating-pdf.ts`): the legend and the unseated box wrap a name under itself (indented) instead of
  cutting it; a name's lines stay in one column. The in-shape table/element labels keep their shortening (not guest
  names; the full table name heads its legend entry) — docblock says why.
- Place cards (`lib/print-seating-pack.ts`): the name wraps and the card makes room (it used to overflow the card).
- `fitWords(…, { name: true })` (`lib/print-layout.ts`): the passes' guest names and the couple's names never get the
  "…" fallback; other text keeps its last-resort rule.
- `lib/print-fit-measure.ts`: a name ending in "…" is now a `clipped` failure; "whole" = a run of drawn lines spells
  the name letter for letter.
- **Full names, the nickname beside them** (`guestPrintName`, `lib/guests.ts`): the seat plan, place cards (+ the
  "Pick guests" list), and the entrance chart print `Ninong Ramon Francisco Dela Cruz-Villanueva “Monching”`; the A to Z
  registry rule (`surnameFirst`) prints the full name surname-first with the nickname beside it and files it by surname
  (the nickname used to REPLACE the name and file under itself). An unnamed "+1 · TBA" seat reads as before.
- Guard: `lib/names-are-never-cut.test.ts` (the long-name fixture through seat plan, entrance chart by table + A–Z,
  place cards + directory, `fitName`, `fitWords`) — sabotaged once (the old legend cutter back → RED), restored.

SPEC IMPACT: None — applies the owner's 2026-10-29 instruction; "Shown as" now prints BESIDE the full name on these
prints, consistent with DECISION_LOG "THE INVITATION PRINTS A GUEST'S FULL NAME — SHOWN AS NEVER REPLACES IT".
