## 2026-09-27 · fix(monogram): an uploaded logo image keeps every stroke

Owner, on his own 2000px monogram "C" uploaded into the Event Hub Maker's Logo
editor: *"the image is incomplete fix this"*. Measured by tracing his file with
the real tracer and drawing the result back over the original: one whole stroke
(the short bar between the C's bowl and a crossing gap) was deleted — IoU 96.5%,
1.5% of the ink missing, that piece 0% covered. Now IoU 99.0%, no ink missing,
every piece present.

Three ways a stroke vanished, all in `lib/monogram-studio/`:

- **The speck rule deleted real strokes.** Any piece under 0.06% of the canvas
  was treated as dust. A monogram draws its crossings as gaps, so strokes are cut
  into short pieces — his was 0.05%. A small piece is now dropped only when it is
  compact AND far from the rest of the drawing; a piece drawn as a line (long,
  several times longer than thick), or one beside a bigger piece (an "i"'s dot,
  a fragment), is kept (`keptPieces` in `trace.ts`).
- **A thin straight stroke traced to a zero-width path.** Its two sides never
  cross, so both were pinned to one point (`M a L b L a Z`) — a 4px straight
  hairline came back 0%. The tip is now a round cap between the two sides
  (`hairpin` in `trace-fit.ts`).
- **The 1024px trace cap halved every hairline before a blur.** Raised to 2048,
  so a typical logo export is traced at its own resolution. A lone 2px swash came
  back 23% at 1024, 100% now.

Also: the piece cap rose 40 → 80 (`MAX_TRACE_PIECES`), and the upload tips now
print that number from the constant instead of a hard-coded "40".

Existing traced layers are stored as the traced shapes, not the original image,
so a logo uploaded before this must be uploaded again to benefit.

Held by `lib/monogram-studio/trace-keeps-every-stroke.test.ts` (synthetic
2000×2000 mark; each of the four fixes was reverted in turn and the test went
red naming the stroke that disappeared).

SPEC IMPACT: None
