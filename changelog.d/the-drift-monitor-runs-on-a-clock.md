## 2026-09-02 · fix(ci): the deploy-drift monitor stops reporting success while dormant

The monitor merged earlier today (#5088) to catch a 2.5-hour silent production
outage was itself silent: `VERCEL_TOKEN` is not set, so its gate printed a
`::notice::` and **exited 0**. It reported `completed/success` on every run while
verifying nothing, and was cited in this session as evidence production was
healthy. A monitor nobody has armed is indistinguishable from a monitor finding
nothing wrong — the exact failure it exists to catch.

The workflow contradicted the principle its own script states —
`deploy-drift-doctor.mjs`: *"A check that can't verify must not say 'fine'."* The
doctor honours it internally (INCONCLUSIVE = exit 2); the gate around it did not.

Two changes, owner-ruled "loud" on 2026-09-02:

1. A dormant monitor now FAILS with an `::error::` instead of passing quietly.
2. A `schedule:` trigger (hourly at :17). Firing only on `deploy-prod` left a
   blind window — drift beginning after the last merge of the day went unreported
   until the next one. The doctor's `--grace-min` (default 20) means a scheduled
   run cannot false-alarm on a deploy still in flight.

⚠ Arming it needs THREE secrets, not one. The doctor's header says project/org id
"default to the checked-in `.vercel/project.json`" — but `.vercel` is gitignored
and nothing under it is tracked, so that fallback cannot work in a CI checkout.
Set `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.

SPEC IMPACT: None — CI only.
