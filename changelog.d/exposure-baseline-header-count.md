## 2026-11-05 · fix(security): the exposure baseline's header counts the facts its body holds

`node scripts/lint-exposure-baseline.mjs` (the required "Lint exposure baseline" check) failed on `main`:
`header declares 7071 facts but the body holds 7072`. Two merges (#7257, then #7260) each joined branches that
had both regenerated `supabase/security/exposure-surface.baseline.txt`: git kept both sides' new fact lines but
only one side's header count. Regenerated with `pnpm --filter @setnayan/web exposure:baseline` (1734/1734
migrations replayed): the body is byte-identical — only the two header counts move (`facts` 7071 → 7072,
`col` 5131 → 5132). Nothing new is reachable by anon or authenticated.

SPEC IMPACT: None
