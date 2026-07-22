## 2026-07-22 · fix(papic): split still/play display resolvers + repoint every read path (Storage PR-1)

Closes a bug that is **already LIVE for photos**: several read paths presign a
Papic capture's raw `r2_object_key`, which 404s the moment the 90-day full-res
sweep (`lib/papic-fullres-drop.ts`) drops the original — a dark gallery tile,
broken OG preview, or a failed reel render. This is the safety half of the
Storage-Sustainability spec (`0012_papic/Papic_Storage_Sustainability_Spec_2026-07-22.md`,
PR-1). **No schema, no migration — pure code.**

**New `lib/papic-display-ref.ts`** — two DISJOINT, pure resolvers (unit-tested
under `tsx`, like `papic-fullres-drop-core.ts`):
- `resolveStillRef(row)` → ALWAYS an image (`<img>`, OG, thumbnail): photo →
  `thumb_r2_key ?? display_r2_key ?? r2_object_key`; clip → `thumb_r2_key ??
  poster_r2_key` (NEVER the raw video).
- `resolvePlayRef(row)` → ALWAYS a video (`<video>`, reel input): clip →
  `clip_web_r2_key ?? r2_object_key` (`clip_web_r2_key` is OPTIONAL — the column
  arrives in a later PR, so the resolver falls back to the raw when absent).
- **Presign-boundary hardening:** when `full_res_dropped_at` is set the dead raw
  `r2_object_key` is dropped from BOTH fallback chains — the durable derivative
  wins and `null` beats a guaranteed 404. Guard A never drops a photo without a
  `display_r2_key`, so a dropped photo always still resolves.
- `stableMediaPath(ref)` builds the streaming-route path for a stored ref.

**Repointed read surfaces** (each SELECT extended with the derivative columns +
`full_res_dropped_at` so a resolver can prefer a column that's actually loaded):
- Still → `resolveStillRef`: `app/[slug]/_components/editorial/data.ts` (the
  public gallery — BOTH the seat block AND the guest-capture block that merge
  into it, since guest photos drop too; plus the curated + auto-pick OG hero),
  `lib/life-story-moment-graph.ts` (per-kind: photo→still, clip→play, since
  Life-Flash renders `<img>` vs `<video>` off `type`), the Kwento review queue
  anchor, the Kwento Magazine spine, `library/_data/editorials.ts` hero, and
  `admin/user-reports` thumbnails.
- Play → `resolvePlayRef`: `lib/alaala-orb.ts` (the "safe" public-orb surface
  that presigned raw clips directly).
- **`lib/guest-stories.ts` uses `resolveStillRef`, NOT `resolvePlayRef`** —
  Stories are PHOTO-driven (clips excluded) and feed `<img>` inputs, so a still
  ref is correct; `resolvePlayRef` on a photo returns the raw key (404s after
  drop, leaks geo EXIF) — the opposite of the fix. Deviates from the spec's
  "play surface" label by design (see SPEC IMPACT).

**New streaming media route `app/papic/media/[...key]/route.ts`** — STREAMS
bytes from R2 (media bucket only; private buckets never exposed), never 302s to
a presign, with ETag revalidation (keys are path-derived, so no `immutable`).
The public `/[slug]` OG card (`/api/og/realstory-slug`) now composites its hero
via the new `EditorialData.heroStableUrl` (the absolute stable-route URL) so a
crawler's cached preview survives presign expiry.

Fixture test `lib/papic-display-ref.test.ts` proves every repointed surface
still resolves to a real derivative after an original is "dropped" (no
`r2_object_key`-only 404 path). Full suite green (2526 tests), `tsc` clean.

Out of scope (later PRs, per the spec): clip web-copy transcode (PR-2/3),
extending the drop to clips (PR-4), Drive resilience (PR-5), and all tiering
(PR-6/7). The `save-photo` / `me/[token]/photo` outbound full-res fallback in the
spec's PR-1 text was left out — its fix is "provider-aware" (`getStorageClient`),
which is tiering infrastructure this PR does not build.

SPEC IMPACT: `0012_papic/Papic_Storage_Sustainability_Spec_2026-07-22.md` —
implementation of PR-1, no locked-decision change. One intentional deviation to
surface for owner awareness: the spec lists `lib/guest-stories.ts` under "play
surfaces (→ resolvePlayRef)", but the module is photo-only and feeds `<img>`
inputs, so it correctly uses `resolveStillRef` (using play there would reintroduce
the exact 404-after-drop + geo-leak the PR fixes). Logged as a decision note; no
spec body edit.
