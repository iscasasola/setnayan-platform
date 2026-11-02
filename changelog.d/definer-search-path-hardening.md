## 2026-07-12 · fix(hardening): pin search_path on session DEFINER fns + cap Papic drop-warning batch

Second-pass hardening from an adversarial review of the fake-inquiry-protection + cron-free work. The review confirmed **no correctness bugs** and verified all 5 cron→after() extractions are verbatim + idempotent; these are the two minor items it flagged.

- **`supabase/migrations/20270730363797_definer_search_path_hardening.sql`** — `ALTER FUNCTION … SET search_path = public` on the 9 `SECURITY DEFINER` functions this session added (`unlock_vendor_event_hold`, `consume_lead_token_hold(_for)`, `release_lead_token_hold`, `sweep_ghosted_lead_holds`, `handle_vendor_lead_report`, `get_lead_trust_flags`, `detect_inquiry_concentration`, `claim_periodic_job`). They omitted it, tripping Supabase's `function_search_path_mutable` advisory (repo convention: 162/197). Not exploitable (all refs schema-qualified / pg_catalog builtins; none call an `extensions`-schema fn), so metadata-only ALTERs — no body change, idempotent, `search_path = public` matches the dominant repo form.
- **`apps/web/lib/daily-email-jobs.ts`** — cap `runPapicDropWarning` at `PAPIC_WARN_MAX_BATCH = 300` events/run. The retired route had `maxDuration = 60`; inside `after()` the work is bounded by the host page's timeout, so a large first-run backlog could be truncated. Each event stamps `full_res_drop_warned_at` on its own send → the remainder is picked up next run with no double-send (14-day lead window absorbs the spread).

`tsc` / `lint` / `migration:check` green.

SPEC IMPACT: None (hardening only; metadata ALTERs + a per-run batch bound, no behavior/pricing change). See DECISION_LOG 2026-07-12.
