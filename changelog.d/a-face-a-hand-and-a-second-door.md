## 2026-09-06 · feat(3d-plan): a face, a hand, and a second door — three visible fixes for the avatar styles

Owner 2026-09-06: *"any improvements you can do for the 3 styles?"* → *"go."*
Measured first: dressed rig figures (Heritage, Blocky) had a featureless head and
sleeves that ran to the fingertip, and the avatar maker had exactly one door.

- **Faces on Heritage and Blocky.** The rig's look system has carried
  `faceVariant` since the blob pivot and nothing read it; the chibi already
  draws eyes and mouths as ink decals. `kit/rig-face.ts` takes the chibi's ink
  for one of three fixed combos, **clones** it (the chibi cache is shared with
  every mounted chibi) and scales it head-to-head (`RIG_HEAD_R / CHIBI_HEAD_R`).
  `chibiFaceInkGeo` is the read-only accessor added to `lib/chibi-geometry.ts`.
- **Hands.** A skin-tinted part at each forearm's end — the rig's joint shape,
  so a ball on Heritage and a cube on Blocky — sized to the forearm tip.
- **Both sit behind the SAME `look` gate as skin and hair**, so a guest without
  an avatar renders byte-for-byte as before: the blob keeps no face and its
  rounded stump.
- **A second door into the maker.** The venue page's header link was the only
  one; a guest who opens their **seat pass** and never the 3D room never learned
  they could make an avatar. The seat-found state now carries "Make your avatar
  for the 3D room →", gated on the same flag as the first door.

Guards: `lib/a-face-a-hand-and-a-second-door.test.ts` — the face is a scaled
clone at the smaller head's distance; variants wrap; face and hands mount only
under `look`; one hand mount inside the mirrored arm chain; the seat pass door
and its gate. The Blocky part-table guard's mount count moves 12 → 13 (the hand).

Flagged, not done: the seated dressed-crowd cost (individual figures) once
adoption is high; and a chibi *dance* clip (the chibi only hops on the dance
floor) — next.

SPEC IMPACT: None.
