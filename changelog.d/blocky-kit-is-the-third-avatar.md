## 2026-09-06 · feat(3d-plan): the Blocky Kit is the third avatar style

Owner 2026-09-06: *"build blocky kit."* Asked which of the three remaining
lineup styles was nearest, the measured answer was Blocky: in the prototype it is
the same jointed skeleton as Heritage drawn with rounded boxes instead of
capsules, and it walks. The app's rig already had every pose (stand, walk, run,
sit, dance, wave) and, since Heritage, honours skin, hair and outfit. So Blocky
is a **part table**, not a rig.

- **`kit/figure.tsx` mounts every part through a table** — `G.arm`, `G.leg`,
  `G.head`, `G.joint` (×4), `G.hip`, `G.shoe`, `G.torso` — chosen by
  `spec.kit`: `'round'` (the mannequin's own consts, `ROUND_PARTS`) or
  `'blocky'` (`kit/blocky-parts.ts`). Not one position or scale changed: each
  blocky part keeps the round part's native bounds, so the per-mount scales
  and the seat bake apply unchanged.
- **`kit/blocky-parts.ts`** — seven `RoundedBoxGeometry` parts at those bounds
  (the joint is a unit box, scaled by the ball radius like the unit sphere).
- **`FigureSpec.kit`** — the one new field on the spec.
- **`lib/heritage-config.ts`**: `style` is now `'heritage' | 'blocky'` over one
  schema (`RIG_STYLES`) — the style *is* the part table. `heritageFigureSpec`
  sets `kit` from it. Unknown rig styles repair to heritage; validation names
  both.
- **`lib/guest-avatar.ts`** returns the stored rig style; every reader now
  treats *any non-chibi* style alike (viewer, remotes, seated), so a fourth
  rig style would be a one-line table entry.
- **The maker** gains a Blocky chip; the rig controls serve both rig styles
  and switching between them keeps the whole look.

Guards: `blocky-kit-is-the-third-avatar.test.ts` — the style validates,
resolves and selects the table; the rig mounts all 12 part slots through the
table and no capsule const is hard-wired in JSX; the blocky table has every
part as rounded boxes at the round bounds; every reader treats rig styles
alike; the maker offers Blocky and saves which rig style it is.

Still prototypes: Soft One-Piece and Kokeshi — both need cloth motion first.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-06 row.
