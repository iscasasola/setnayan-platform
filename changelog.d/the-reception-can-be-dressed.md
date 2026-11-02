## 2026-09-06 · feat(moodboard): the reception room can be dressed for the celebration

Owner, 2026-09-06: *"after a ceremony venue like church, they transfer to a
place to eat and celebrate the wedding. that is the reception venue. this is
what is supposed to be created with the stylist and everyone else, catering,
food, wall, ceiling, etc… it is a place not where the bride walks but a time to
celebrate and eat thus having booths, hosts, bands, etc."*

The room could already be **decorated** — ceiling, walls, backdrop, the couple's
stage, the guest tables — but it could not be **celebrated in**. A couple could
book a live band, an emcee, a mobile bar and a perfume booth in the marketplace
and not one of them had a place in the drawing, in the zone rail, or in the
brief that drives their paid photoreal render.

Three new reception zones, each exactly one marketplace **parent** from
`lib/taxonomy.ts` — so what a couple dresses and what they book are the same
noun, and a later change can light a zone from a real booking without inventing
a second mapping between the two vocabularies:

- **`feast`** → the `feast` parent (catering · stations · cake). How dinner is
  served, plus cake/dessert/mobile bar/mocktail/coffee/food-cart stations.
- **`program`** → the `program` parent (live_band · dj · orchestra · host_mc ·
  wedding_singer · choir). Who plays, the host's spot, the dance floor.
- **`booths`** → the `booths` parent (photo_booth · arcade_games · henna_tattoo ·
  massage_chair · mini_nail_bar · perfume_bar · tarot · caricature · engraving).

All three feed `renderVenueSvg`, the zone rail, `sanitizeReceptionDesign` and
`buildPrompt` — so they reach the paid render, not just the sketch.

🔑 **All three default to `none`, and that is load-bearing.** `sel()` falls back
to `DEFAULT_DESIGN` for any part a stored `reception_design` has no key for —
which is every event that existed before these zones did. A default of `buffet`
would have put a buffet line, a band and a booth row into every couple's room
overnight, in the drawing *and* in the brief they pay to render, without one of
them choosing it. A guard asserts the byte-identity directly.

🪤 **Three defects the renders caught that no type or test would have.** The
dance floor was drawn last and painted straight over the right-hand guest
tables; the booth bays were plain outlined rects and read as framed pictures
hung on the wall; the band riser was a fixed 288px bar that ran off to the
corner as an empty shelf under a lone DJ. All three are fixed and pinned.

Two of this file's own guards also failed on correct code before landing — a
bounding-box overlap test (the aisle is a trapezoid, so the boxes overlap where
the shapes never touch) and a point-in-polygon test against a table rectangle
read off a screenshot by eye. Both were replaced by a pixel measurement: 1,260
table pixels, 0 repainted by the floor. **A guard that asserts a cheaper
property than the one it claims will eventually call right code wrong.**

The four "new zones" tests carried a hard-coded list of three zone ids, so they
covered only the zones someone had remembered to type in. They now iterate
`RECEPTION_PARTS` itself.

🔑 **The zones reach the SUPPLIER side, not just the drawing.** Four existing
invariants failed the moment the zones landed, each insisting a reception part
must have a supplying trade, a human label, a freeze rule and a line in the
render brief. `MOODBOARD_PART_TRADES` now maps all three — and lists EVERY tile
a couple can choose in that zone rather than a representative few, because a
partial list looks perfectly healthy on the finalization screen while sending
someone who picked a perfume bar to a photo-booth vendor.

🪤 **And one existing guard was wrong before this branch touched it.** The
whole-look brief excluded the People zone by testing `line.startsWith('Who')` —
three letters, not an identity. The new `program` zone labelled an attribute
"Who plays" and the guard reported that People had leaked into the brief. Both
halves fixed: the label is now "The band", and the guard identifies People by
its part id.

SPEC IMPACT: None. No locked decision changes; the marketplace taxonomy already
carried every one of these tiles, and this gives them somewhere to be dressed.
