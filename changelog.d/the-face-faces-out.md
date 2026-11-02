## 2026-09-06 · fix(3d-plan): the face faces out, the hair leaves the face open, and the rig styles have a body

Owner 2026-09-06, looking at the maker on production: *"heritage and blocky's
face seem wrong"* · *"the gender seems incorrect. chibi looks like a female and
heritage and block looks like a male."* All three measured on geometry:

- **The face sat inside the head.** `rig-face` scaled the chibi's ink to the
  rig head and stopped; the chibi keeps its own ink just inside its head and
  lets tube thickness poke through, but at 0.47× the tubes are 3 mm and
  nothing does — Heritage's whole face vanished inside the sphere, Blocky's
  eyes broke the box front as two dark holes. Now, after scaling, the face is
  translated so its furthest point sits `RIG_FACE_PROUD_M` in front of **that
  kit's** head front (sphere radius / box face) — one geometry per kit.
- **The long hair wrapped the face.** One sphere section per style swept all
  the way round; "Long" was a dark ball. Round hair is now a crown cap (full
  sweep to the brow) plus, for the longer styles, a drape around the back and
  sides whose φ sweep starts after the face and ends before it. On Blocky the
  sphere cap hid *inside* the box head; it is now a rounded-box helmet on the
  head top, with a back panel for the longer styles.
- **No body on the rig styles.** `HeritageAvatarConfig.bodyType`
  (`female | male`, the chibi's two), hash-defaulted, with the default outfit
  and hair length following it so the first impression reads right (any
  outfit stays pickable for any body). `FigureSpec.build` carries it; a
  female build narrows the torso and shoulders and widens the hips — dressed
  figures only, the blob untouched. The maker has a Body row for the rig
  styles.

Guards: `lib/the-face-faces-out.test.ts` measures the face's bounding box
against each kit's head front; walks every vertex of the long round cap to
prove nothing sits below the brow inside the face opening; proves the Blocky
helmet rises above the head top and never in front of the face; the body's
catalog, defaults, validation, repair and spec; the rig applying the build
and passing its kit. Two earlier guards updated to the kit-aware calls.

SPEC IMPACT: None (the chibi's own two body types extend to the rig styles).
