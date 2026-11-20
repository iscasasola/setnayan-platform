## 2026-11-20 · ci(deploy): publish to production every 2 hours instead of every 4

Owner, 2026-11-20: deploy every two hours, "giving us 12 merges in a day". `deploy-prod.yml`'s schedule moves
from `7 */4 * * *` to `7 */2 * * *` (8:07, 10:07, 12:07 … Manila). A run with no new commits since the
`deployed-prod` tag still builds nothing, so the extra runs cost build minutes only when something merged.
`deploy-drift-monitor.yml`'s `--grace-min` moves from 285 to 165 (120 min between runs + the same 45-min
build and hook margin), so the monitor alarms on real drift and not on every cycle. CLAUDE.md's cadence
section is updated to match. `workflow_dispatch` ("publish now") is unchanged.

SPEC IMPACT: None
