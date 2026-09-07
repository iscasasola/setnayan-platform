## 2026-09-07 · feat(moodboard): the program zone gets its drawings, four of five families

`program` becomes the sixth of `renderVenueSvg`'s thirteen zones to carry
generated artwork. Four Recraft V4.1 vectors, one measured colour range each on
the performance riser's floor-length draped skirt.

**Yield: 4 keepers / 7 generations (1 per 1.75).** Tolerances, measured at 520px
through the real `recolorRGBA` against four unrelated targets with NO area floor:
elegant 11 · bridgerton 8 · editorial cream 12 · tropical 18. All four are
bounded by a genuine cliff and all four sit inside `tolerance_de`'s CHECK.

**⚠ `modern minimalist` ships UNCOVERED, and that is a measurement.** Two
generations, two ways: `#4A3B45` sat 3.01 from the drawing's grey line work,
`#6E5A68` (a mid slate plum, with everything else asked for in pure black and
white) sat 3.08 from its mid greys. Both under the CHECK floor of 5, so no legal
tolerance isolates the skirt. **The diagnosis is about the zone, not the wording:**
this drawing is a band — instruments, amps, cymbals, mic stands — and Recraft
renders all of it in grey at every value however the neutrals are named, so a
family whose colour *is* a desaturated grey-violet has no gap to sit in. The
"NO OUTLINES AT ALL" wording that solved the identical-looking problem on `feast`
did nothing here, because on this zone the greys are the subject rather than the
line work. The cell renders flat, byte for byte. Nothing was widened.

**Finding 3 again, on `tropical heritage`:** Recraft ignored the `#9CB29A` sage in
`colors`, invented a bright mint dominant (39% of the frame) and spent the sage on
a minor fill 18.10 away — which is also what bounds this file's tolerance. The
seeded hex is `#66DEBA`, measured off the pixels. Tagging the seed would have
tagged almost nothing and left the visible skirt stock. A guard asserts this
specific hex so a future "correction" back to the seed goes red.

**The `feast` lesson applied before it could repeat.** `program` is the second
zone whose flat drawing holds two independently chosen objects — the line-up on
its riser, and, from a separate attribute, the host's spot. So the image is gated
on the BAND (a couple who booked only an emcee must not be given a generated band)
and the HOST SPOT is drawn after the image rather than swallowed by it.

`program` joins `PILOT_DECOR_ZONES`, `SCENE_DECOR_ZONES` and `DECOR_SLOTS`
(624..944 × 242..392) in the same change. The artwork-count guard, which asserted
"5 files per zone", now pins the count PER ZONE — `program` is the first zone to
cover fewer than five families, and a file quietly missing looks identical to a
deliberately uncovered cell unless the number is written down. Seven sabotages
run, seven red.

SPEC IMPACT: None. `reception_design` is unchanged; this seeds artwork rows and
switches an existing zone on. Findings recorded in
`apps/web/scripts/reception-decor-pilot-prompts.ts` alongside every prompt run,
including the two that failed.
