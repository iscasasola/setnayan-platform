## 2026-09-26 · ci(guard): count the server actions on every PR, before Vercel refuses the deploy

Every exported `"use server"` function is one Vercel route; production is refused above
2,048 (`too_many_routes`) — it stopped deploys on 2026-09-23 and again on 2026-09-26,
while GitHub's deploy-prod run still said success. `apps/web/scripts/lint-server-action-budget.mjs`
counts exported actions (1,209 in 341 files at landing) and fails above `CEILING = 1225`,
naming the fix (reuse · un-export unused · raise with a fresh `vercel build` count). Wired
as a blocking step in the typecheck + lint job (`guard_server_action_budget`). Sabotage:
`SERVER_ACTION_CEILING=1200` → exit 1.

SPEC IMPACT: None.
