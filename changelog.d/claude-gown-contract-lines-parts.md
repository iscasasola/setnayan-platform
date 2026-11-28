### Gown maker contract: her own lines (v209) and colour per piece (v210)

- **The design now carries her own lines**, so the send and the quote can use them before the drawing tools land:
  - `neckLine`: 10 handle numbers.
  - `backLine`: 4 handle numbers.
  - `armhole`: cm cut in, 0 to 12.
  - `hemLine`: 5 handle numbers.
  - `hemEdge`: plain, scalloped, handkerchief or curved.
- **The lines follow the prototype's own rules:**
  - null keeps the named line.
  - A look carries the lines, as v209 does.
  - The check is the prototype's: exact lengths, finite numbers under 400.
- **The order's `lines`** (v209 `lnMeasured`) have their own type and check: `GownOrderLines` and `sanitizeGownOrderLines`. The send passes them beside the design.
- **The design now carries `parts`** (v210 colour and fabric per piece), as one entry per changed piece. Each entry can set:
  - fabric
  - colour (`main`, `accent` or a hex)
  - dip-dye fade
  - border band
  - pattern
- **The server checks each piece:**
  - The fabrics must be ones the shop works in, including a border's fabric.
  - A printed fabric must be one of the shop's own fabrics.
  - Fade, border and fabric go only on the pieces that take them.
  - At most one patterned piece.
  - An empty entry is dropped.
  - A look never carries `parts`.

SPEC IMPACT: None (types and checks from prototype v209/v210 in the specs corpus; the drawing and the per-piece shader come with the v209 and v210 steps).
