### Gown maker: 3D flowers, raised lace, glitter tulle, scattered pearls (prototype v200)

- 3D flowers: scattered blooms, a cascade (from her shoulder, or the bodice edge on a strapless gown), a neckline row, a hem border or a waist cluster; rosettes, petal blooms or small blossoms; 2.5, 4 or 6 cm; light, medium or full; in the gown colour, ivory, blush or the accent. One instanced mesh, each flower pinned to the cloth it is sewn on (the gown, a sleeve, the cape) and laid again when that cloth moves; left off under a cape or an overlay, and not drawn where an arm rests on it or its petals would go into her skin. A phone draws at most 600 (the beads keep their 2,500); the quantities count every flower.
- Flowers on the cape (`capeFlowers`): trailing down, along the edge or all over.
- Raised (3D) lace (`laceFinish`): a bump and a soft shadow in the lace shader, no geometry.
- Glitter tulle (`glitter`): for the veil (`veilFab`), a cape, an overlay and a layer under the skirt. A sparkle in the shader with no time in it, so an idle frame stays identical.
- Scattered pearls (`pearls`): along the neckline and the veil's edge, on the bead system's pearls and the Pearls line.
- The veil keeps clear of the flowers. The bead system's shared pieces (`parts/beads.ts`: the spot on the gown, the bead shape, the phone cap, a set laid on the cloth) arrive here; A7 extends them.
- The rules follow v200 word for word (no large flowers on a sheath; a hem border needs a floor-length hem; a strapless cascade starts at the bodice edge; no veil, no veil-edge pearls; an accent colour first), and the server refuses what they rule out. New quantities: `flowers` and `laceRaised` (labour), `glitterM` (materials).
- Every case is held to v200 (every flower's spot, cloth and turn, which are hidden, every drawn flower and pearl within 1 mm, the veil over flowers within 1 mm, the designer's lines and the quote's numbers, the rules word for word).
- Dev lab only (`/dev/gown-maker-lab?view=dress`: 3D flowers and their details, 3D flowers on the cape, Lace finish, Veil made of, Scattered pearls, Glitter tulle under Cape made of and Overlay made of); nothing a person sees yet.

SPEC IMPACT: None (ports prototype v200 as written; prototype issues reported to the coordinator).
