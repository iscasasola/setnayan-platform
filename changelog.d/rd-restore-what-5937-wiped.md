## 2026-09-24 · fix: restore #5934 section backgrounds and #5913 public-profile posters, silently reverted by the #5937 merge

The merge of #5937 (a docs PR whose branch was cut before #5913, #5933 and #5934
landed) carried stale copies of 25 code files and reverted them on `main` — −3,041
lines, nothing red. This reverse-applies ONLY that merge's `apps/` + `supabase/`
changes onto current `main` with a 3-way merge; its `build-sessions/` docs stay.

- **Restored byte-exact** (equal to `bf8c0ab64^1`): the #5913 posters
  (`app/u/[userSlug]/page.tsx`, `lib/public-profile.ts`, `lib/celebration-*`,
  `lib/coming-up-and-past*`, `lib/event-board.ts`, the profile page) and the #5934
  background tests (`a-background-kind-cannot-smuggle-a-ref`,
  `each-background-kind-reaches-the-page`, `a-section-background-is-a-ref`).
- **Merged with later work**: #5934's photo/snippet/colour kinds now sit beside
  #5948's `hubPhotoPlacement` (behind · beside · none). A colour is the ground, so
  it paints behind in every arrangement; a snippet stays behind under left/right
  (the beside column is a still-picture layer); the `hub-bg-*` class is omitted
  when nothing is drawn, so a snippet's scrim never washes over bare words.
  #5933's centred rail mark (`front-door.css` + rail test §9) is back beside #5943's
  event menu. `port-control-baseline.json` regenerated on the final tree.
- No new `"use server"` exports, no migrations. Background gating (colour free,
  media Pro) is NOT implemented here — it is the pending `rd/hub-look-is-pro`.

SPEC IMPACT: None
