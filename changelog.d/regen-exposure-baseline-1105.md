## 2026-11-05 · fix(ci): regenerate the exposure baseline after two merges each added one fact

Two PRs merged on 5 Nov (#7254, #7260) each regenerated `supabase/security/exposure-surface.baseline.txt` with one new fact. Git combined both added lines cleanly, but the header kept one side's counts (`facts: 7071`, `col 5131`) while the body held 7072, so `lint exposure baseline` and the DB-replay meta test failed on main `8c0d8e1`. Regenerated with `pnpm --filter @setnayan/web exposure:baseline`: only the two header counts change, and no fact line is added or removed.

SPEC IMPACT: None
