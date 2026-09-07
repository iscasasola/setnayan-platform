## 2026-09-07 · feat(moodboard): the side walls get their drawings, all five families

`walls` becomes the ninth of `renderVenueSvg`'s thirteen zones to carry generated
artwork — and **the first zone that occupies more than one box**.

`wallsDecorLayer` draws two 56-wide bands, one down each edge of the room, with
the backdrop, the stage and the couple between them. A single rect spanning both
would paint over all of it. So `DECOR_SLOTS` values become "a rect OR an array of
rects", and the same drawing composites into each band — exactly what the flat
layer already does. **The first box keeps the bare `decor-<zone>` clip id**, so
all eight one-box zones emit exactly the markup they emitted when a slot could
only be one rect; suffixing that first id turns the pre-change byte hashes red.

**A panel zone, not a scene zone.** Like `backdrop`, `ceiling` and `photo_wall`,
a wall drawing fills its band and its ground *is* the wall — absent from
`SCENE_DECOR_ZONES`, and now covered by the panel-knockout guard. Adding it turns
three tests red.

**Yield: 5 keepers / 5 generations** — a 1:1 round, and the clearest evidence
that the session's findings compound. Every lesson went into the first prompt:
full-bleed rather than object-on-a-field, warm-cream neutrals, "no tonal
variation of any kind from one fold to the next", one colour in `colors`. The
same `modern minimalist` family that was unseedable three times on `program` at
3.01 measures **70.07** here.

Tolerances: elegant 15 · bridgerton 30 · editorial 30 · tropical 30 · modern 30.
**Four sit at the CHECK ceiling and the guard says why:** these are
near-monochrome full-bleed panels whose nearest neighbours are 42.60, 22.02, 4.06
(its own edge) and 70.07, so nothing a wider tolerance can reach exists, the
measurement runs clean to 30, and it stops only because the CHECK stops it. None
is bounded by a cliff. `elegant` is the one file with a real neighbour close
enough to bound it (5.89), and it carries the harness's eyesight proof for the
set — at tolerance 30 it *must* bleed, and the guard asserts that it does.

**🪤 The gate in its third shape.** `feast` shipped gated on "did the flat layer
draw anything", and a plated-service couple got a buffet. `walls` has the same
trap in different clothes: `uplighting_only` is spelled in the taxonomy as one of
the two options meaning *no wall dressing* — but unlike `bare` it **draws**, four
ellipses per band. So the gate is the three treatments that actually dress a wall,
and uplighting is drawn *over* the image, because a couple who ticked both a drape
and uplighting chose both.

**Two more sampled hexes are not the colour asked for** (`#5643A0`, `#519374`).
Across this session the seed has been wrong on 6 of 25 files — about one in four.

Six sabotages run, six red.

SPEC IMPACT: None. `reception_design` is unchanged; this seeds artwork rows,
switches an existing zone on, and widens `DECOR_SLOTS` to admit multi-box zones
without changing any existing zone's output.
