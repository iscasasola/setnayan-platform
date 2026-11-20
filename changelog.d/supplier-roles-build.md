## 2026-11-19 · feat(supplier-team): six supplier roles — Shop Manager · Branch Manager · Account Manager · Marketing · Event Crew · Helper

Build of the #8013 drawing (owner OK 19 Nov, "build them all in cloud"). Extends the shipped team model — no second one.

- **DB** (`supabase/migrations/*_supplier_six_roles.sql`): `vendor_team_members.duty` (ONE role per person) + `branch_id`
  (ON DELETE SET NULL; NULL for Shop Manager / Marketing). The RLS rank in `role` is DERIVED from duty
  (`vendor_team_duty_rank_trg`, sorts before the admin-floor guard), so all ~80 `current_vendor_ids` policies are unchanged;
  a legacy rank write moves duty to the nearest role. Backfill: admin→Shop Manager, agent→Account Manager, viewer→Helper.
  New `vendor_role_names` (the shop's word per role; RLS at create). Helpers `current_vendor_duty_ids(duty)` +
  `current_vendor_branch_manager_scopes()`. Branch Manager: holds their branch's cards (trigger), manages their branch's
  team and card ticks, at or below their level (RLS). Marketing: reads + updates the shop's cards (no insert/delete).
  `current_vendor_dayof_grant_event_ids()` also admits a client's Account / Branch Manager. Ugat J4 updated.
- **lib**: `lib/vendor-duties.ts` — the six roles, names, the ONE capability matrix (`dutyMay`), nav per role.
  `resolveVendorStanding`, `mayOnProfile`, `fetchTeamManagerContext`, `fetchVendorRoleNames`. Free seat = Helper role.
  Event day four ways in (`lib/who-may-act-for-a-shop.ts` + `lib/booked-supplier.ts`).
- **Screens**: Team card (shop's role name, gold, ⓘ fixed role · branch · cards), Role ▾ + Branch ▾ in the row and the
  invite, new Team › Roles page (`/vendor-dashboard/team/roles`), Branch Manager's branch-only Team, duty-aware rail +
  phone bar, Today says the person's role, 🔒 Problem → Solution on Theft Watch / Track record / Analytics.
- **Guards**: `lib/vendor-duties.test.ts` (rank mirror pinned to the SQL, matrix, nav, names, four ways in),
  `tests/db/six-supplier-roles.db.test.ts` (10 cases on the replayed schema).

SPEC IMPACT: new supplier role model (DECISION_LOG 2026-11-19 rows) — the corpus is not reachable from this cloud
session, so the corpus edit is flagged for the controller. ⚠ Owner sign-off: two new canonical RLS helpers
(`current_vendor_duty_ids`, `current_vendor_branch_manager_scopes`); Marketing can edit a card's price (RLS cannot split
columns). Not in this PR (drawing (d)–(h)): Plan-page rows, inquiry routing, Clients "Handled by", plan-end pause, chat line.

## 2026-11-21 · fix(supplier-team): the member card matches drawing (b) — a tap opens its controls

Caught up with `main` (merge only; ugat screens, exposure and FK baselines regenerated). The Team card is one clean
row as drawing (b) draws it: gold-tinted initials, the shop's role name + ⓘ, where they work. Role ▾ · Branch ▾ ·
Remove open in place under the card on a tap (rows: tap opens) instead of always showing; the ⓘ opens only its
note. Pairs at 375 light / dark and desktop in `build-sessions/shots-supplier-roles/pair-*.png`.

SPEC IMPACT: None.
