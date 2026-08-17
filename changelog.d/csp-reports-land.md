## 2026-08-17 · feat(security): the browser-protection reports now land somewhere they can be read

Measured from the live site's own headers 2026-08-17: the ENFORCED
Content-Security-Policy covers `frame-ancestors` + `frame-src` only; the wide
policy is sent **report-only** with `report-uri /api/csp-report`. That is
correct, and was always meant to be temporary — enforcement was deferred until
"the reports are boring".

**Nobody could tell whether they were boring.** The report route ended at a
single `console.warn`, beneath a docblock claiming "Sentry when configured" —
there is no Sentry call in the file. Production had no table matching `csp`
(verified: 0 tables, 0 functions). So the deferral had no exit: the evidence
needed to make the decision was never kept, and **the moment to switch real
protection on could never arrive by itself.**

Adds `csp_violation_reports` (migration `20271144274507`) and a **Browser
blocks** tab on the existing Insights Studio at
`/admin/app-performance?tab=browser-blocks`.

- **Aggregated, not raw rows.** One counter per
  `(directive, blocked_origin, route_shape, Manila day)`. A misconfigured policy
  fires on every asset of every page view; raw rows would be an unbounded write
  amplifier aimed at our own database by unauthenticated traffic.
- **The day is a Manila day**, computed server-side in one place, so a date
  column can never be filled from a UTC instant and read as the previous day.
- **No new anonymous surface.** The route writes with the SERVICE ROLE, so no
  anon grant and no anon-callable function. The table explicitly
  `REVOKE`s from `anon` and `PUBLIC` — new tables here do not arrive locked,
  which is how 306 of 383 public tables came to grant `anon` a SELECT.
- **A failed read is not an empty list.** Both the route and the admin surface
  check the Supabase `error` (it resolves rather than throwing) — the surface
  says "we do not know" instead of printing a reassuring "nothing was blocked".
- **No enforce button, deliberately.** Tightening is a reviewed code change, not
  a click. Our own frame policy blocked our own map for weeks.

⛔ This change enforces nothing. Extended, not redrawn: RULE 0 found the
Insights Studio already consolidating nine read-only diagnostics surfaces, so
this is a tenth tab rather than a new page or nav entry.

Migration dry-run against production inside a rolled-back transaction (repeat
report incremented to `hits: 2` rather than duplicating; Manila day correct),
then verified nothing persisted. Mutation-tested both ways.

SPEC IMPACT: None.
