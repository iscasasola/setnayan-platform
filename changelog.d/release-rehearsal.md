## 2026-10-08 · ci(release): a release rehearsal that costs nothing and touches nothing live

A manually-started workflow, `release-rehearsal.yml`, that rehearses ONE upload on
a GitHub runner: a throw-away Supabase stack, every migration (the live set by the
repo's replay engine, this release's new ones by the real
`supabase db push --include-all`), a small fixture, the app built in production
mode, the launch-critical journey walked at 375×812 with a screenshot per step,
and the database requests each step cost.

No production secret, no Vercel build, no deploy. Test code and workflow only:
+0 routes, +0 server actions, no screen changes.

SPEC IMPACT: None.
