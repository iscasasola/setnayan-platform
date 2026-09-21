## 2026-09-20 · fix(monogram): a traced logo comes back with real curves, straight lines and sharp corners

Owner, on a logo traced from a photo: *"the refinement of the svg from the photo
uploaded is not clean. make the curves and the corners clean and the straight
lines."*

**The old tracer could not have been tuned into that — the representation was
wrong.** It made every pixel 0 or 1 (discarding the anti-aliasing that says where
an edge runs between pixels), put every boundary point on a pixel-edge MIDPOINT
(a smooth diagonal becomes a staircase), simplified with RDP (which keeps the
staircase corners as vertices — the wobble), and emitted `L` segments only. Not
one curve in any file it ever produced.

**Rebuilt, Potrace-style, still dependency-free:**

- a CONTINUOUS ink field, lightly blurred against sensor noise; the binary mask
  survives only to decide which pixels are ink, and each boundary point is placed
  where the field actually crosses the threshold, between two pixels;
- `trace-fit.ts` finds corners; a stretch between two corners that is straight
  becomes one least-squares line; a straight that flows smoothly into a curve (a
  stem into its bowl) is found on its own, told apart from a gentle arc by
  whether its direction is the same at both ends;
- near-vertical/horizontal lines snap exactly to the axis; a corner between two
  lines is their INTERSECTION, so it is sharp;
- everything else is fitted with cubic Béziers (Schneider 1990), tangent-matched
  where a curve meets a line so the join has no kink.

**Measured against the true letter**, a Didone "IC" like the owner's, mean
distance of the traced outline from the real one (trace px):

| | old | new |
|---|---|---|
| clean PNG | 0.56 | **0.08** |
| photo of print | 0.74 | **0.12** |

11 lines + 33 curves where the old output was 85 straight facets. An overlay of
the true outline at 8× zoom sits on the traced shape.

**Four real defects found on the way, each now held by a test:** a line grower
that walked through corners (split a square into 20 curves); straights rejected
whole when their end eased into a curve (a letter's stem came out bowed); a line
allowed to creep into a serif bracket (a ~1px notch at the join); and a PHOTO
threshold that put every edge out into the paper — first a fixed "luminance
200", then Otsu taking the first of a flat maximum. A photographed 200px square
came back 201px wide; it now comes back at exactly 100.00/300.00 on all four
edges, noise or not.

`lib/monogram-studio/trace.test.ts` — 7 cases against shapes with KNOWN geometry
(square, rotated square, circle, stadium, noisy photo of a circle, separate
pieces, photographed square). **The old tracer fails 6 of the 7**; the one it
passes is "separate pieces stay separate", the property it already had.

⚠ **An existing traced mark does NOT improve by itself.** The upload flow never
kept the original photo — only the traced SVG — so a mark traced before this
change stays as it was until the couple uploads the photo again.

SPEC IMPACT: None.
