## 2026-10-30 · fix(ci): the exposure baseline's header counts match its body again

Two PRs that each added exposure facts merged back to back; git combined their bodies, but the header kept one
side's counts (`# facts: 6776`, `col 4967`) while the body held 6778 facts / 4969 columns. `lint exposure baseline`
then failed on main and on every open PR. Regenerated with `pnpm -s exposure:baseline`: only the two header counts
change — no fact was added or removed, so nothing new is reachable.

SPEC IMPACT: None
