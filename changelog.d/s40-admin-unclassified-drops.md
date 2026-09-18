## 2026-09-19 · chore(db): S40 orphan sweep drops 3 dead functions + 2 dead tables (ADMIN/UNCLASSIFIED)

Re-measured every ADMIN + UNCLASSIFIED row assigned from `apps/web/tests/db/ugat-both-ends.baseline.txt`
(S26, PR #5625) against `origin/main` and the live database on 2026-09-18/19. Dropped the ones
with zero live caller/writer AND no documented future-PR intent; left the rest alone (see below).

**Dropped (migration `20271233873951`):**
- `current_user_gallery_counts()` — built to replace a perf bug in `getSwitcherData()`, but the
  switcher panel was slimmed to events-first before the swap landed. The function's own consumer
  file says outright: "unused ... can be dropped in a later migration."
- `hamming_distance(bigint, bigint)` — the real pHash match (repost-watch AND the inspiration-gallery
  logo check) runs entirely client-side via `lib/perceptual-hash.ts`'s JS mirror. Zero SQL callers.
- `moderator_can_see_row(...)` — built as an RLS helper "for subsequent phases" that never arrived;
  not one of the 4 canonical RLS helpers (CLAUDE.md). Zero policies call it.
- `bespoke_monogram_generations` (table) + `events.monogram_custom_generation_id` (column) — the
  Bespoke AI Monogram Studio was retired 2026-06-19 (owner decision); that commit deliberately kept
  the table "until confirmed unneeded." Re-measured live: 0 rows, 0 events reference it. This is that
  cleanup. `events_host` (an explicit computed-projection view) depended on the column, so the
  migration rebuilds it verbatim from its last definition (20271230123132) after the drop.
- `founder_time_log` (table) — shipped 2026-05-23 scoped to "table + RLS only, dashboard React
  components out of scope"; no dashboard ever shipped in the 4 months since. 0 rows.

**Left alone, with reasons inline in the migration** — `render_jobs`, `seo_suggestions`,
`concierge_brain_chunks`, `concierge_response_cache`, `person_stewardships`,
`stewardship_transfers` each carry an explicit "inert scaffolding, later PR" comment in their own
migration (owner-approved architecture notes). `execute_manpower_telemetry_reward` was explicitly
flagged to the owner pending a "crew-rate-marketplace decision" (2026-06-15 changelog) and its
`token_rewards_log` table holds live rows — NEEDS-OWNER, not engineering's call to make.

Synced 5 dependent guard/fixture files so the drop doesn't strand a false claim: `lib/erasure/coverage.ts`
+ `lib/erasure/coverage-guardrail.test.ts` (executable list removes the entry, the guard's static-parse
list keeps an annotated "TABLE DROPPED" line — same split already established for `calendar_feed_tokens`),
`lib/export-completeness.ts` + `lib/export-coverage-guardrail.test.ts` (same split), `tests/db/anon-rpc-surface.baseline.txt`,
`tests/db/anon-table-grants-closed.db.test.ts` (batch-2 floor 17→16, combined floor 95→94, with the
one-line reason inline — not a silent trim), `tests/db/user-delete-fk-surface.db.test.ts`, and
`tests/db/user-fk-behaviour.generated.txt` (regenerated via `UPDATE_FK_BEHAVIOUR=1`). All 66 tests in
the affected db-test files pass.

SPEC IMPACT: None — pure dead-code/dead-schema removal, no product behavior change.
