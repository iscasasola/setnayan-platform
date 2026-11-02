## 2026-09-18 · chore(db): three supplier-side tables nothing writes are dropped (S39)

From S26's orphan sweep (`table-no-writer`, supplier tier). Migration
`20271234122426_supplier_tables_nobody_writes.sql`. Live row counts checked read-only first —
**all 0** — and production `pg_depend` / `pg_proc.prosrc` searched for dependents. All
three are **(b) delete the end nobody needs**:

| Table | Why nobody needs it | Also removed |
|---|---|---|
| `vendor_tool_bundles` | purchases of the V1 vendor-tool SKUs, retired with the V1 catalogue | view `vendor_active_tools` (read by nothing) |
| `vendor_self_comp_caps` | per-store override of the 12/quarter self-comp ceiling; never written, and 0 self-comps ever issued | `fetchSelfCompQuota` (no caller); the quota trigger keeps the fixed 12 |
| `vendor_meetings` | ad-hoc meetings no screen ever wrote; appointments (`event_appointments`) replaced them | its reads in Home "Upcoming", the Preparation agenda and the couple's supplier workspace |

The workspace had been telling every couple "No meetings scheduled yet" directly above their
confirmed appointments. The Schedules card now shows only for a supplier the couple added
themselves (no scheduler there) and says so; for a Setnayan supplier the Appointments section
is the schedule. Also pays down S26's `result-dropped-silently` line on
`lib/upcoming-items.ts · vendor_meetings.select`.

**Not dropped:** `vendor_2307_filings` — BIR 2307, 0 rows, owner retired the subsystem
2026-07-25 but kept the table on purpose; tax, so reported not deleted. `vendor_bid_submissions`
is S37's (#5642).

Guards updated, none loosened: erasure + export coverage move both user-FK tables to their
"DROPPED" exclusions (the parser cannot see a DROP; the T7 parser canary on `vendor_meetings`
stays), `anon-table-grants-closed` swaps the `vendor_tool_bundles` keep-SELECT pair for an
assertion that the table and view are gone, and `exposure-surface.baseline.txt` /
`user-fk-behaviour.generated.txt` lose their rows. ⚠ The FK file's header count will need a
regenerate if #5642 merges first (both move 241 → 239 by different tables).

SPEC IMPACT: iteration 0006's "meetings module" is superseded by Appointments in code — the
table is gone. Owner should confirm no ad-hoc meeting log for off-platform suppliers is wanted.
