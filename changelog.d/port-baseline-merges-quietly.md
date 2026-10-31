## 2026-10-30 · chore(ci): the port baseline stores only its routes, so open PRs stop conflicting on it

`apps/web/scripts/port-control-baseline.json` carried the commit it was generated from and four totals in its first
lines. Every PR that regenerated it rewrote those same lines, so ANY two open PRs conflicted there — eight at once on
30 Oct, each needing a re-sync and a full CI re-run before it could ship. The generator now writes `{ routes }` only;
`lint-port-no-lost-controls.mjs` derives what it printed from `routes`. Two PRs now conflict on the baseline only when
they change the same route's controls.

SPEC IMPACT: None
