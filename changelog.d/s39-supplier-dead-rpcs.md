## 2026-09-18 · chore(db): six supplier-side functions nothing calls are dropped (S39)
## 2026-09-20 · chore(db): a seventh — the caller-of-the-caller — joins the drop (owner-approved)

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

**Added 2026-09-20 (owner-approved — "yes"):** dropping `handle_vendor_lead_report` above
orphans `release_lead_token_hold(uuid,text)` — its only caller was the `PERFORM` inside that
function's body. `sweep_ghosted_lead_holds` (the other place a hold gets released) inlines its
own `UPDATE`/`DELETE` rather than calling it, so nothing else was ever going to call it either.
`ugat-both-ends.db.test.ts` (new since S39 shipped) flags exactly this shape as a money-tier
`rpc-no-caller` orphan and its message is explicit: don't baseline it, call it or drop it. It is
dropped in the same migration as the caller that orphaned it, so it is now **seven**.

The migration asserts all seven are gone and that the two live siblings
(`count_saves_for_vendor`, `vendor_worked_with_ids`) remain. Baselines/registers moved:
`exposure-surface.baseline.txt` (2 func lines from the original six — `release_lead_token_hold`
was never exec-granted to anon/authenticated so it never appeared there),
`anon-rpc-surface.baseline.txt` (1 line, original six), `ugat-both-ends.baseline.txt` (6 lines
removed from the supplier-facing tier for the original six; `release_lead_token_hold` was never
added, per the guard's own instruction).

SPEC IMPACT: None — every one of these was already retired or superseded in the corpus
(token economy retirement, 2026-06-17 verification-bonus removal; `release_lead_token_hold` was
infrastructure for that same retired token economy).

## 2026-09-20 · fix(ci): the both-ends baseline is edited by hand here, never regenerated

CI failed in `test:db:ci` (which then failed the blocking-guards step), and the failing test was
`ugat-both-ends.db.test.ts`. Not the drop — the **baseline file**. An earlier repair pass had
regenerated `ugat-both-ends.baseline.txt` wholesale with `UPDATE_BOTH_ENDS_BASELINE=1`, which
rewrote it from 132 rows down to 62. The test's own anti-truncation floor —
`assert.ok(baseline.size > 100, 'baseline holds only N lines — was it truncated?')` — then fired.

🔑 **A wholesale regeneration of this file cannot pass its own guard today.** The honest current
orphan set is **44** rows (11 rpc · 16 table · 3 notice · 3 component · 11 silent-drop, measured
here), because ~82 of the inherited 132 were genuinely paid down by the retirement and
"reads-honest" PRs that have since merged — and a paid-down entry only *prints a note*, so nobody
was ever forced to delete it. Any honest regeneration therefore lands under the floor of 100 and
reads as a truncation. **Edit this baseline by hand, one line per orphan you actually retired.**
Deleting the other 82 stale rows is a separate job (it would drop the file to 44 and needs the
floor re-thought), deliberately not done in a migration PR.

This PR now removes exactly its own six rows from the supplier tier (and updates that tier's
header count 10 → 4); the file holds 126 rows and the full db suite is 2,939/2,939 green.
The regenerated baselines (`port-control-baseline.json`, `exposure-surface.baseline.txt`,
`admin-jobs.generated.ts`) were taken from `main` and regenerated; the FK behaviour map did not
move. The one merge conflict was `port-control-baseline.json` — resolved by taking main's copy and
re-running `pnpm --filter @setnayan/web port:baseline`.

SPEC IMPACT: None.
