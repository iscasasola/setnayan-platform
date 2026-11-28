### Gown maker A7b: place by hand, and the lace designer (prototype v202)

- **Four hand tools** (the owner's v194 set): Beads, Lace, Scissors, Eraser.
  - Pick a tool and draw on the gown; tap once for a single piece. Tap the tool again, or Done, to stop.
  - Line places pieces one width plus the gap apart, turned along the stroke; Scatter dabs inside the brush.
  - Scissors: a tap cuts a round hole; a line drawn all the way round takes the shape out. The closure strip and the band under the bust are never cut. A strip too thin to hold opens through the hem; a wide hole asks for illusion mesh.
  - The eraser takes away what was placed by hand under it and wipes the ready-made beads and lace there.
  - Mirror draws and rubs out both sides. Undo steps back. Clear asks first, and Undo brings it back.
  - One finger draws and two fingers still turn her (right-drag on a computer).
- **The design carries the hand work** to the designer: `handBeads` (at most 4,000), `handLace` (400), `handCuts` (60, round holes or drawn shapes), `handHoles` (400). Each tool stops at its cap with one line. The server refuses anything over a cap or off its range, never repairing it. The hand lists have their own byte cap, so the design itself stays within 8 KB.
- **Beads sewn on the lace** ("Beads on the lace": a few or rich) land only where the motif is drawn, at most 4 mm, mirrored.
- **The lace designer:** the lace designs as pictures, then where they go, their colour, their width, the beads on them and a raised finish.
- **Lazy loading:** the hand tools and the lace designer load on their own, and a guard keeps them out of the maker's first load.
- **Checked against prototype v202:** the beads placed by hand (every set, its colour, count and where each sits), the eraser over beads and lace, motifs placed by hand, the scissors' note, and the screen's lines word for word.

SPEC IMPACT: None (ports prototype v202 from the specs corpus, specs c1fbf3a; the hand-work fields were approved by the coordinator 2026-11-28).
