## 2026-08-10 · feat(papic): new events start on Optimal photo quality

Owner ruling of 2026-08-10, verbatim: *"photo quality starts at optimal and not
full resolution."*

**All three choices stay** — Optimal · Full resolution · High efficiency. Only
the starting point moved. A couple can still pick any of the three at any time,
which is also what keeps paid preservation honest: preservation talks about
"original quality", so choosing Full resolution has to remain possible.

- New migration `20271127772092_papic_quality_tier_default_optimal.sql` —
  `ALTER TABLE public.events ALTER COLUMN papic_quality_tier SET DEFAULT
  'optimal'`, plus a refreshed column comment. The CHECK constraint listing all
  three tiers is untouched.
- **No production event moves.** The column is `NOT NULL`, so every stored row
  already carries its own materialized value and a DEFAULT is consulted only for
  an INSERT that omits the column. The migration contains no `UPDATE`; the five
  production events stay on Full resolution.

### 🚨 The constant was SPLIT, not flipped

`DEFAULT_PAPIC_FIDELITY = 'full_res'` in `apps/web/lib/papic-fidelity.ts` was
serving two unrelated questions at once:

1. what a brand-new event **starts** on — a product decision, now `optimal`;
2. what the capture ingest assumes when the tier **read fails**
   (`papic-ingest-fidelity.ts`, the PostgREST-error and `catch` paths) — a
   safety decision that must stay `full_res`.

Flipping the merged constant would have satisfied the ruling *and* made a failed
database read silently **downscale someone's wedding originals** — irreversible
loss of resolution, on an error path, with nothing thrown and nothing logged.

It is now two constants: `NEW_EVENT_PAPIC_FIDELITY = 'optimal'` and
`FIDELITY_READ_FAILSAFE = 'full_res'`. Consumers, and why each got what it got:

| consumer | gets | why |
|---|---|---|
| `papic-ingest-fidelity.ts` — `if (error)` and `catch` returns | fail-safe | error paths; ingest only ever downscales |
| `asPapicFidelityTier()` fallback | fail-safe | every caller is *reading* a value meant to already exist |
| Papic page's `?? 'full_res'` on the quality read | fail-safe (constant, was a re-typed literal) | a failed read, not a new event |
| `quality-picker.tsx` "Recommended" badge | new-event default | the badge marks the tier new events start on |
| event creation | *(nothing in TypeScript)* | the database DEFAULT materializes it |

### Guards

- `apps/web/lib/papic-fidelity.test.ts` — its premise genuinely changed, so it
  was **rewritten, not deleted**: the fail-safe stays `full_res`, the new-event
  default is `optimal`, and the two must differ. Plus two derived assertions
  over the migration corpus (the last statement to set the column DEFAULT must
  equal the constant; no migration may `UPDATE` the column on existing rows) and
  a source-text pin that the ingest error paths never name a downscaling tier.
- `apps/web/tests/db/papic-quality-tier-default.db.test.ts` — **new, executing**:
  replays the whole migration corpus into PGlite, inserts, and asserts a real
  row receives `optimal`, that all three tiers are still storable, that the CHECK
  still refuses an unknown one, and that changing a DEFAULT provably cannot move
  an existing row.

SPEC IMPACT: Yes — corpus `CLAUDE.md` "How photos come out" / Papic quality
defaults and `DECISION_LOG.md` (2026-08-10 row) record that new events start on
Optimal while existing events keep Full resolution. Applied in the same commit.
