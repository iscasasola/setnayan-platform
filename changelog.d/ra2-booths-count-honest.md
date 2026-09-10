## 2026-09-07 · fix(moodboard): the room holds the number of booths the couple ticked, not three

`20271212913454` switched `booths` on with the decor image composited **ungated**.
The drawing is a row of exactly **three** bays, so it was wrong in both
directions — measured on the merged code, not inferred:

* a couple who ticked **one** photo booth got a room with **three stalls** in it,
  two suppliers they never booked;
* a couple who ticked **four** got three — the fourth silently dropped, the flat
  row reaching x 404 while the image stops at 320.

**This is the empty-shelf class RV1 already paid for** on the band riser (a fixed
288px bar running off under a lone DJ). `tables` is immune to it because its flat
drawing is *always* four tables at fixed spots, so the drawing and the room can
never disagree about the count. `booths` is the first zone where the count is the
couple's own choice, and a static image cannot follow it.

The image is now gated on the couple's count matching the three bays the drawing
holds. Every other count renders the flat row **byte for byte**, which is what
every uncovered (zone, style) cell already does.

**Clipping the drawing to N of its three bays was measured and rejected:** the
bays do not sit on even thirds — across the five files their boundaries range
5–19% at the left edge and 81–95% at the right — so a fixed clip slices a canopy
in half on some families, and per-file boundary constants would be five more
measured numbers that rot the moment a file is re-cut. If coverage for N ≠ 3 is
wanted, the honest shape is one bay per booth, tiled — a real piece of work, not a
wider constant here.

Two existing probes ticked a single booth and correctly went red on the change;
both now tick three, with the reason in place. Three sabotages run, three red,
including restoring the gate-less line exactly as it shipped.

SPEC IMPACT: None. No schema, no rows, no artwork — a wiring correction to the
zone seeded by `20271212913454`.
