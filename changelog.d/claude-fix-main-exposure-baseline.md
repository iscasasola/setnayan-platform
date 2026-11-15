## 2026-11-13 · fix(ci): regenerate the exposure baseline header after two PRs raced it

Two PRs merged on top of each other and each edited `supabase/security/exposure-surface.baseline.txt`; the body held 7758 facts while the header still declared 7757, so `lint exposure baseline` and the DB-replay meta test failed on `main`. Regenerated with `pnpm --filter @setnayan/web exposure:baseline` — the only change is the header count (`# facts: 7757` → `7758`); no fact line was added or removed.

SPEC IMPACT: None
