## 2026-11-06 · fix(ci): exposure baseline header recounted after the #7249 merge

The #7249 merge left `supabase/security/exposure-surface.baseline.txt` declaring `# facts: 7126` over a body of 7,128
lines (the per-kind counts already summed to 7,128), so `lint exposure baseline` failed on main and on every open PR.
Header recounted from the body; no fact added or removed. `node scripts/lint-exposure-baseline.mjs` → OK.

SPEC IMPACT: None
