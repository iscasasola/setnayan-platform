## 2026-06-29 · feat(scripts): beat-grid analyzer gains a sanctioned PROD path (--emit-migration)

Closes the one real gap in the free Guest Stories beat-sync pipeline: `scripts/analyze-beat-grids.mjs` could only `--write` to a NON-prod Supabase (it refuses the prod ref by design), so analyzed `reel_music_tracks.beat_grid` values had no sanctioned way into prod.

- New `--emit-migration` flag: after computing grids, it reuses the `scripts/new-migration.mjs` allocator (collision-safe, never-round prefix that passes the CI "migration timestamp guard") to write an idempotent `BEGIN; UPDATE … beat_grid …; COMMIT;` migration — one `UPDATE` per analyzed track. Lands via PR → `supabase db push`, never a direct prod write. Verified end-to-end (allocator → parse → valid SQL → guard passes; test migration removed, not committed).
- Doc correctness: the script header + `scripts/README.beat-grids.md` claimed the feature was "inert groundwork" / "nothing reads beat_grid yet." That is stale — the render path DOES consume it (`lib/guest-stories.ts` pickMusic → `lib/reel-render.ts` → `lib/stories-templates.ts`; NULL grid → even-split fallback). Reworded to: beat grids are the "make cuts land on the beat" upgrade, run once the owned masters are ingested.

No app/runtime code touched — script + docs only. The audio path (music-tempo + audio-decode, already in apps/web devDependencies) is exercised when run against real masters.

SPEC IMPACT: None. Tooling + doc hygiene for the already-shipped Guest Stories pipeline. Context: `0012_papic/` Stories workstream; related memory `project_setnayan_stories_sde_buildplan`.
