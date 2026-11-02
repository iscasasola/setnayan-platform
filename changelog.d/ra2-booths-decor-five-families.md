## 2026-09-07 · feat(moodboard): the booth row gets its drawings, all five families

`booths` becomes the seventh of `renderVenueSvg`'s thirteen zones to carry
generated artwork. Five Recraft V4.1 vectors, one measured colour range each on
the booths' awning canopy.

**Yield: 5 keepers / 7 generations (1 per 1.4)** — the best of the session.
Tolerances, measured at 520px through the real `recolorRGBA` against four
unrelated targets with NO area floor: elegant 11 · bridgerton 20 · editorial 12 ·
tropical 5 · modern minimalist 14. **Four of the five move ZERO pixels outside
their canopy at the seeded value** — not "under budget", zero — and every one of
the five turns a measured field one step up.

**🔑 The finding: swap the NEUTRALS out of grey, not the slot colour.**
`modern minimalist` had been unseedable on `program` three times (nearest neutral
3.01, 3.08, 3.01). A desaturated plum and a grey are near-neighbours in
`colorDistance` by construction, so any drawing that uses grey for its line work
puts something inside the CHECK floor of 5. Two levers had failed, and both
changed the *slot*. The one that works changes everything else — "drawn in WARM
CREAM, oatmeal and pale sand only; there are NO GREYS anywhere in the picture".
It landed first attempt at 4.51, and the same line rescued `bridgerton` and
`tropical heritage` on their second attempts. It is **not** universal: re-run on
`program` with the identical wording it still came back 3.01, because that
drawing's subject *is* grey equipment.

**🪤 And a reject no number caught.** `bridgerton`'s first generation measured
perfectly — zero pixels outside the canopy at tolerance 13, a clean cliff at 14 —
and was a reject on sight: its canopy is two stacked panels, a flat top and a
scalloped valance 13.76 apart, so the recolour turned three canopy tops teal and
left three purple valances hanging beneath them. No outside-pixel assertion can
see that, and a dedicated bi-tonal check written this session passed it too
(0.07%) because the second tone forms its own connected region. Rendering the
recolour and looking at it is what caught it, and remains the only reliable test
for this failure.

**The image replaces the whole row, deliberately, unlike `feast` and `program`.**
Those two hold objects chosen through *separate* attributes, so swallowing the
group dropped a supplier the couple booked. Every booth bay comes from the same
multi-select, so the row is one object drawn N times — the `tables` shape. What a
couple loses is *which* booths they ticked; that is the same trade `tables`
already ships, it is flagged in the migration header rather than hidden, and the
zone rail, finalization screen and paid-render brief all still carry their exact
kinds.

`booths` joins `PILOT_DECOR_ZONES`, `SCENE_DECOR_ZONES` and `DECOR_SLOTS`
(20..320 × 120..250) in the same change. The artwork guard additionally checks
every file is named for a style family — a drawing named anything else can never
be resolved, and passes a bare count. Five sabotages run, five red.

SPEC IMPACT: None. `reception_design` is unchanged; this seeds artwork rows and
switches an existing zone on. Findings recorded in
`apps/web/scripts/reception-decor-pilot-prompts.ts` alongside every prompt run,
including the two that failed.
