## 2026-09-18 · chore(db): six supplier-side functions nothing calls are dropped (S39)

From S26's orphan sweep (`rpc-no-caller`, supplier tier). Migration
`20271233596518_supplier_rpcs_nobody_calls.sql`. Each re-measured on `origin/main` and
against production `pg_proc.prosrc` (no other function body names any of them). All six are
**(b) delete the end nobody needs**:

| Function | Why nobody needs it |
|---|---|
| `consume_vendor_assets(uuid,int)` | the token burn; tokens retired 2026-07-21/22 and the manpower gig accept is free |
| `grant_verified_vendor_bonus()` · `…_on_insert()` | **the verified-supplier bonus is NOT granted, by owner decision 2026-06-17** — triggers dropped in `20270110320020`, these were `RETURN NEW` stubs; no copy promises the bonus |
| `handle_vendor_lead_report(…)` | **a supplier CAN still report a bad lead** (`reportUser` → `user_reports` → `/admin/user-reports`); this was only the token refund on top, whose caller left with the lead-token-hold retirement (`43996627c`) |
| `rival_signals_for_vendor(uuid)` | the Shortlist Radar card was deleted (`8bdf1f63d`); `demand_radar_for_vendor` is the live demand feed |
| `vendors_worked_together(uuid,uuid)` | the partnerships page uses the set-valued `vendor_worked_with_ids(uuid)`, which stays |

The migration asserts all six are gone and that the two live siblings
(`count_saves_for_vendor`, `vendor_worked_with_ids`) remain. Baselines trimmed:
`exposure-surface.baseline.txt` (2 func lines), `anon-rpc-surface.baseline.txt` (1 line).

SPEC IMPACT: None — every one of these was already retired or superseded in the corpus
(token economy retirement, 2026-06-17 verification-bonus removal).
