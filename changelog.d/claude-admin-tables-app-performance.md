## 2026-08-17 · refactor(admin): the App Performance studio's seven tables become ConsoleTable — and stop reporting refusals as zeroes

Six surfaces under `app/admin/app-performance/` (seven tables, `intelligence-surface`
holds two) now render through the shipped `<ConsoleTable>` archetype.

The point is not the markup. These are the MEASUREMENT screens, and every one of
them could print a confident number over a query the database had rejected —
Supabase resolves with `{ error }` rather than throwing, so `?? []` and
`count ?? 0` turn a refusal into "nothing here".

**The swallow was UPSTREAM in four of the six**, so converting the table alone
would have fixed nothing. Reads now keep `null`:

- `lib/hiring-guide/queries.ts` — new `getHiringRoadmapResult()`; the list form
  is kept for the alert engine, which cannot act on the difference. The old
  `[]` printed "Roadmap not seeded — run migration" (prod holds 4 rows).
- `lib/admin/intelligence-stats.ts` — `churn`/`leads` nullable + per-section
  errors + `CHURN_ROW_CAP`/`LEAD_ROW_CAP` exported (100/50, previously silent).
- `lib/admin/platform-expenses.ts` — `ledger` nullable, `LEDGER_ROWS` exported.
- `lib/vendor-funnel.ts` — new `fetchVendorFunnelTotalsResult()`; the plain form
  is unchanged for its vendor-dashboard callers.

Also: `funnels-surface` had ELEVEN reads and two error bindings — the four
order-pipeline counts were not checked at all; the drill-down's capped vendor
list moved to `_components/funnel-vendor-picker.tsx`, which discloses its own
cap and no longer swallows its error; four local header blocks became
`PageMasthead` and a local `StatCard` became `KpiStatCard`; two gold-on-text
spans moved the colour onto the icon (3.37:1 as text, fine on a glyph).

SPEC IMPACT: None.
