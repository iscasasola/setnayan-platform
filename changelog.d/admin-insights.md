## 2026-11-14 · feat(admin): Insights views onto the approved drawing (area build — Insights)

Owner, 14 Nov 2026: *"Yes, queue the builds"* — the approved drawing `Setnayan-specs/prototypes/admin_pub/insights.html`
(BUILDER-NOTES T-rules). The Insights Overview (shipped 14 Nov) is kept; this redraws every view it opens.

- **Shared parts, written once:** `app/admin/app-performance/_components/insights-parts.tsx` — `Nums` (a refused read is
  "—", never 0) · `Sec` · `Facts` · `Rows`/`Row` · `NotMeasured` · `Badge` · `Mix` · `Note` · `One` — and
  `insights-param-pick.tsx`, the one dropdown row that moves `?range=` / `?quiet=` / `?vendor=` (replaces the native
  select + Apply forms).
- **Redrawn, nothing dropped:** Visits · Sign-ups & growth · Intelligence (Won & lost) · Funnels · SEO & GEO ·
  Operations & hiring · Expenses & receipts · Slow loads · Problems · Offline daemon · Interconnections · Browser blocks ·
  Demand · Papic storage · Live Watch channels · Privacy & NPC (+ Coverage, Deletions, Checklist, Documents) · NPC data
  sheet. Explanations moved into ⓘs, frames off read-only facts, tokens only.
- **Honest numbers fixed:** Demand printed "floor 1 · feed on" when its settings read was refused — now "—" + couldn't
  read. Won & lost printed 0s over a refused rollup — `fetchAdminOutcomeOverview` now returns `failed`. Growth blanks
  each figure whose section failed. Interconnections probe titles say supplier.
- No new reads, no new server actions, no migrations. Old addresses already redirect (unchanged).

SPEC IMPACT: None — builds the approved drawing. Not built (each needs a new read, action or another PR's file):
Costs landing, grouped View ▾, Top shops, Growth sales split / delivery & trust / fastest movers, Problems Mark fixed /
Ignore per issue, Expenses Note field, channel Retire, data sheet Print, privacy-exceptions row.
