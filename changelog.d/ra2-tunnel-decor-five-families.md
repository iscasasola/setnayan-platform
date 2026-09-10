## 2026-09-07 · feat(moodboard): the entrance tunnel gets its drawings, all five families

`tunnel` becomes the tenth of `renderVenueSvg`'s thirteen zones to carry
generated artwork. The tagged surface is the blooms, leaves or hoops on the
arches.

**The first zone whose composition had to match a PERSPECTIVE, not just a shape.**
Every other zone in this feature is an object seen flat-on. `tunnelLayer` draws
three arches receding down the aisle in one-point perspective, so the prompt names
exactly that — "a large arch nearest, a medium one behind it, a small one
furthest" — and all five came back with the recession reading correctly against
the aisle. First `4:3` sources in the feature.

**Yield: 5 keepers / 6 generations.** Tolerances: elegant 14 · bridgerton 11 ·
editorial 6 · tropical 5 · modern minimalist 30. Budget 40 px (0.02% of 199,160).

**🔎 Finding: on a perspective zone, forbid depth-shading explicitly.**
`tropical heritage`'s first attempt was unseedable at 3.37 — a slightly darker
sage used for the leaves on the arches *further back*. The prompt had already
said "no second green, no darker green"; the model read that as a rule about each
leaf and still shaded by depth. What worked was naming the mechanism: "THE ENTIRE
PICTURE CONTAINS EXACTLY ONE SHADE OF GREEN … Depth is shown ONLY by the size of
the arches, never by colour." That is the third form of one lesson this session —
"one flat colour" is heard per *shape*: not across the wall (`photo_wall`), not
across the row (`booths`), not across depth (here). Say which axis you mean.

**Two of the five have a nearest neutral under 5 and ship anyway**, which is the
plan's 2026-09-07 correction working rather than a contradiction: "nearest
neutral" is a *colour* distance, and the rule that decides is *positional*. Those
sub-5 colours are the arches' own antialiased edges, inside the 2px dilation; what
counts is the 18 and 37 px moving outside it, both under budget. Judging by colour
distance alone would have thrown away two good files.

**🪤 The gate in its fourth shape, and the sharpest yet.** `cold_spark` is a
walkway of spark *fountains* with **no arches at all**, and the tunnel catalog's
realism rule (2026-07-08) says its sparks are **never palette-tinted**. A gate of
"did the flat layer draw anything" would hand that couple a generated arch tunnel
— inventing a structure they did not book *and* tinting what must not be tinted.
So the gate is the arch styles, and a `cold_spark` they also chose is drawn over
the image, machine boxes and untinted sparks intact.

**The zone where the knockout matters most.** The aisle runner, the petals and the
mirror floor are drawn beneath the arches and must show through their openings.
Composited opaque, this rect blanks the whole lower centre of the room — the
couple's walk included.

Five sabotages run, five red.

SPEC IMPACT: None. `reception_design` is unchanged; this seeds artwork rows and
switches an existing zone on.
