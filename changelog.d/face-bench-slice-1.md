## 2026-11-05 · feat(papic-faces): face bench slice 1 — count what each match line would do on a labelled folder

DECISION_LOG 2026-11-05 "FACE MATCHING: MAKE IT FIND EVERY PHOTO OF A PERSON — APPROVED, IN SLICES, MEASURED
FIRST", slice (1). Numbers before any line moves.

- `apps/web/lib/face-bench-core.ts` (pure) + `face-bench-core.test.ts`: read a `<person>/<photo>.jpg` folder
  (`selfie*` files enrol; a group photo goes in every person's folder, joined by content hash), decide every
  (photo × person) pair on the closest face × closest selfie, and count per auto line: true / false auto-tags,
  true / false suggestions, misses (and how many of those had no face found at all), precision and recall. Also
  the distance spread for same-person vs other-person pairs, and face sizes (as the 512-px detector sees them)
  for every face, for hits, and for misses. A test runs the bench and the shipped `planAutoTags` on the same
  random numbers and requires the same call on every pair.
- `apps/web/scripts/face-bench.ts` (`pnpm face:bench -- --dir <folder>`): runs the shipped model
  (`@vladmandic/face-api@1.7.15`, the same weights `host-face-models.mjs` puts on R2) the way the server rescan
  decodes (1024 px, `--max-side 0` for a phone's full frame), `--selfies N` to compare one enrolment frame with
  several, `--json` for every pair's distance (no descriptor is written). Refuses a folder or output inside the repo.
- 0.50 / 0.60 do NOT move. A test pins them, so moving either needs a bench run cited in the DECISION_LOG.
- Datasets: none found that has identity labels, Filipino faces AND a licence that clearly allows business use.
  Meta's Casual Conversations v2 (consented, includes the Philippines) is the one worth checking — its licence
  text could not be read from the session. Nothing was downloaded.

SPEC IMPACT: None — implements the approved 2026-11-05 row; no decision changes.
