## 2026-07-23 · ci(migrations): scheduled safety-net so skipped migration applies self-heal

Adds a `schedule:` trigger (every 30 min, at :17/:47) to
`.github/workflows/supabase-migrations.yml`. The existing `push` trigger can
silently skip a migration merge: the shared `concurrency` group with
`cancel-in-progress: false` means GitHub keeps only one in-progress + one pending
run, so bursty migration merges leave intermediate pending runs superseded and
never applied (observed live 2026-07-22 — #3546 + #3549 applied only via manual
dispatch). The scheduled run re-runs `supabase db push` (idempotent; the `gate`
step no-ops when secrets are unset, and db push skips already-applied) so any
skipped migration self-heals within ~30 min instead of surfacing as "Try again"
errors in prod. Shares the same concurrency group, so it queues behind a live
apply rather than racing it.

SPEC IMPACT: None (CI infrastructure).
