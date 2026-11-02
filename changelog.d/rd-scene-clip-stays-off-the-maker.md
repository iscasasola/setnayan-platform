## 2026-10-22 · fix(maker): the guest page's cover-video player leaves the Maker's first load again — the prints read the main background through its plain half

`details-pieces-are-lazy` test 5 went red on main (`be1e9f4`): `scene-clip.tsx` (the guest page's clip player) was a
first-load boundary of the Maker again. The chain: `launch/page.tsx` → `lib/print-set.server.ts` →
`app/[slug]/_lib/main-ground-layer.tsx` (for `mainGroundPictureFor`, added by #6744 "prints wear the Hub look") →
`app/[slug]/_components/main-ground.tsx` → `scene-clip.tsx`. The layer file both ANSWERS what the background is and
DRAWS it; Next puts every `'use client'` module a route's server files reach into its first load, drawn or not.

- `app/[slug]/_lib/main-ground-picture.ts` (new, plain, no component import): `pictureOf`, `screenSizedStill`,
  `movingBackground`, `loopLook`, `mainGroundStillFor`, `mainGroundPictureFor` and `MainGroundInput` — moved unchanged.
  `main-ground-layer.tsx` keeps the drawing (`mainGroundLayerFor` and its shade/effect helpers), imports `pictureOf`
  and `screenSizedStill` from it (still ONE resolver for the page, the film and the prints), and re-exports the two
  readers for every existing caller. `lib/print-set.server.ts` imports from the plain file.
- Guards: `details-pieces-are-lazy` test 5 now prints the WHOLE import chain to a leaked guest component; new test 6 —
  `main-ground-layer.tsx` and `_components/main-ground.tsx` are never Maker server files, `main-ground-picture.ts` is
  and imports no component (sabotage: print-set's old import → tests 5 and 6 red, restored → green). Eight guards that
  read the resolver's source by path now read both files.

SPEC IMPACT: None
