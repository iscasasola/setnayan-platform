## 2026-10-22 · feat(prints): every print carries Setnayan — the free line, the Pro mark, once per piece

Owner, 2026-10-21, verbatim: *"i want the prints branded with setnayan"*. He chose option A.

- 🏷 **FREE (plain white) prints**: one small line, **"Made with Setnayan · setnayan.com"**, on the FRONT's bottom edge. It is set in
  small caps in the house sans, neutral grey `#6b6b6b` (5.3 : 1 on white), at 6 pt (8 pt on the A3 posters). If the ground under
  it is ever not light enough for the grey, it takes the least change of the grey that reads (`legibleInk`).
- 🏷 **PRO (Hub-look) prints**: a tiny Setnayan mark (7 pt, 12 pt on A3) in the Hub's own ink at 38 %. It goes on the BACK when
  the piece has one; otherwise it sits at the very edge of the one side, so the design stays clean. The mark is the shipped artwork
  itself (`SETNAYAN_MARK_PATH`, verbatim `public/brand/setnayan-mark.svg`), flattened once through `flattenSvgMark`. It is not a redraw.
- **Once per piece, and its place is measured, never assumed** (`brandPiece` / `brandSpot`, `lib/print-layout.ts`). The stamp
  runs after the layout. It goes inside the safe area of the sheet's own die cut (scallop, arch, deckle included) and stays clear
  of every word, logo, plate, frame, tear line and QR. It tries the bottom edge first, then the corners; the mark may also use
  the top corners. Covers all nine set pieces at every size (5 × 7, A5, index cards, A3 posters, every pass format) and every
  guest's ticket (each ticket on the ganged sheet carries its own).
- **A free front keeps its own room for the line** (`brandFoot`). `wordsFloor`, the Finer Details' Event Hub address and the
  pass's words and NFC spot all stop above it, so the line sits UNDER the card's words and never on them.
- **The printed phone card** draws the line as the lowest line of its own foot, inside its frame, because there is no room below
  a frame that sits on the safe line. It never also carries the saved picture's "● SETNAYAN" foot mark. The picture a guest saves
  is unchanged.
- **The plain utility sheets carry the free line on every page**: the QR sheet, the guest list registry, the seating pack
  (directory, table signs, place cards — on the card pages the line sits in the margin below the cut lines, so no card carries
  it), the caterer meal counts and the entrance seating chart. The report foot used to say "Printed from Setnayan · page n of N".
  It now says "Page n of N", so Setnayan is named once.
- `PrintLook.brand` (`'line' | 'mark'`): `plainPrintLook` → line; `printLooksFor(…).pro` and `printLookFromHub` → mark (theme
  samples too). `printBrandOf` reads a look that names none by its theme (Classic = the free face).
- Guard `lib/every-print-carries-setnayan.test.ts` measures the drawn sheets: 1,008 set pieces (free · every theme's Pro · two Hub
  looks, print / screen / white ink, light and two-sided weddings), 260 tickets and 20+ utility pages. Each must carry the brand
  exactly once, on the right side, inside the die's safe area, touching nothing drawn. The line must say the owner's words at
  ≥ 6 pt and ≥ 4.5 : 1. The mark must be the shipped path, in the Hub's ink, and quiet. Sabotage, 9 of 9 caught: every side
  stamped · the spot ignores what is drawn · the spot ignores the die · free prints the mark · the QR sheet drops the line · the
  free front keeps no room · the mark is loud · a report names Setnayan twice · the Pro mark goes on the front of a two-sided piece.
  The existing `every-print-fits` and `the-printed-pass-fits` guards also caught two placements during the build: a scallop's
  cusps, and a hairline frame.
- `the-pass-card-is-a-card.test.ts`: "the print and the picture are one drawing" now compares the same function drawing the same
  card, with the paper's brand in place of the picture's foot mark.

Not changed (flagged): the browser print-dialog HTML pages for the seating pack and caterer counts (the PDF files carry the line;
a per-page footer in HTML print is not reliable across browsers). Also unchanged: the older seat-plan PDF (`lib/seating-pdf.ts`,
which already credits Setnayan) and the saved digital pass PNG (free keeps its "● SETNAYAN" foot mark, Pro carries none — it is
not a print).

SPEC IMPACT: DECISION_LOG.md 2026-10-21 "EVERY PRINT CARRIES SETNAYAN — A LINE ON THE FREE FRONT, A TINY MARK ON THE PRO BACK"
(corpus f71d2dd5, pushed alone).
