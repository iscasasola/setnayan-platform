## 2026-09-28 · fix(prints): every print fits inside its safe area, and the cards print the couple's own logo

Owner, verbatim: *"make sure prints out fit properly"* — showing The Entourage
(5 × 7 in, deckle cut) for a real wedding, whose Bride's Crew & Groom's Crew ran
off the foot of the card past the safe line, the twelve groomsmen starting in
the right column only below where the twelve bridesmaids ended.

- **The Entourage is measured, not estimated.** `layoutEntourage` used to guess
  the height (rows × leading + groups × gap), shrink toward a 5 pt floor and
  draw anyway. It now lays the card out (`planEntourage`, the same widths,
  wrapping and leading the drawing uses) at every size from 8.4 pt down to
  `PRINT_MIN_BODY_PT` (6 pt — the floor 21 CFR 101.9(d)(1)(iii) sets for
  printed text the public must read), straight and flowed into two columns, and
  keeps the largest size on the fewest sides. When a wedding will not fit one
  side at 6 pt it continues on a **back** — a second page of the same PDF,
  shown in the Maker as one "Front · Back" picture. Nobody is dropped.
- **Columns end together.** A real pair keeps its shared line; unpaired halves
  now stack per column side by side (`printedEntourageLines`), and a long
  one-sided list flows into two columns. Long titled names are set a touch
  tighter or broken into two balanced lines, never with a stranded "Jr.".
- **The Finer Details card** is measured the same way and continues on a back
  when the couple ticks everything; the venue and reception lines on the
  invitation are no longer cut at two lines; the invitation's type comes down
  (then a photo band gives room) until it ends above its floor.
- **Die cuts are respected.** The safe area now follows the theme's cut (arch,
  chevron, scallop, deckle, rounded — `safeContains`). The corner QR moves to
  the bottom-right on arch/chevron cards, which cut its old corner away; a
  landscape index card is never arch-cut. The pass's text, stub, QR, tear line
  and NFC ring all sit inside 5 mm; the pass's venue line wraps instead of
  shrinking to 3.5 pt; the poster's QR panel and NFC spot no longer run off a
  Modern poster.
- **The crest is the couple's logo.** Prints now resolve the mark through the
  Event Hub hero's one logo call (`heroMarkSvg`, shared with the invite doors) and flatten a studio logo's
  group transforms into outlines (`lib/print-mark.ts`, even-odd holes kept in
  both the SVG and the PDF); an uploaded picture logo prints as that picture.
  The "I & C" ring remains only for a couple with no logo.
- **Guarded** by `lib/every-print-fits.test.ts`: every piece × every format ×
  every theme, laid out with a cale-ice-sized wedding (invented names, real
  shapes), must keep every inked op inside its die's safe area and clear of
  every QR; the Entourage must print every person; the route must print every
  side.

SPEC IMPACT: DECISION_LOG row 2026-09-28 "EVERY PRINT FITS" (corpus
`DECISION_LOG.md`, commit `a413b78`) — records the owner's line, the 6 pt floor,
the back-side rule, and that on paper unpaired entourage halves stack per column
(a refinement of the 2026-09-14 "keep that line blank" ruling, flagged for the
owner). Also records the arena / movie ticket sizes as PENDING a measured ticket.
