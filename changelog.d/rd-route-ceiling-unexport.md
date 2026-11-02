## 2026-09-26 · fix(build): 31 server actions nothing calls stop costing a Vercel route

Production deploy `dpl_44dNXVuV…` (main 6b4243c, #5990 + #5994) was refused by Vercel:
`too_many_routes` — "Max is 2048, received 2049" at `process-and-upload-routes`. The
GitHub deploy-prod run still reported success (it only fires the hook), so the site kept
serving the older build. Every exported `"use server"` function is one Vercel route.

A sweep of all 1,239 exported actions in 337 `"use server"` files found 37 that no
non-test file imports. The 31 of those no test mentions have their `export` removed —
the function stays (several are still called inside their own file), it just stops
being a public route. The 6 that a test names are left alone. Net: −31 routes.

Re-measure: every exported action with no importer (see the PR body for the script).
The standing gap from CONTROLLER §9 remains: a per-PR guard that counts exports.

SPEC IMPACT: None.
