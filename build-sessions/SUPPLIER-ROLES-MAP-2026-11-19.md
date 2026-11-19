# Supplier Roles — the map (2026-11-19)

Step 1 of the supplier Roles page. Read-only survey of `origin/main` @ `9da4c567c`; no app code changes.
Every anchor below is a greppable symbol, never a line number (CLAUDE.md rule 7).

## 0 · What exists today (found before building — RULE 0)

| Piece | Where | What it does today |
|---|---|---|
| Role enum | `CREATE TYPE public.vendor_team_role` (`supabase/migrations/20260514010000_iteration_0022_vendor_dashboard_expansion.sql`) | `owner > admin > agent > viewer`. `owner` retired 2026-07-01 (multi-admin). |
| RLS helper | `public.current_vendor_ids(min_role)` (same migration) | Shop ids where the caller's rank ≥ `min_role`. Used by ~80 policies: `'viewer'` ×44, `'admin'` ×34, `'agent'` ×4, `'owner'` ×1 (re-measure: `grep -rho "current_vendor_ids('[a-z]*')" supabase/migrations \| sort \| uniq -c`). |
| Per-event grant | `public.vendor_event_access_grants` + `current_vendor_dayof_grant_event_ids()` (`20270810694086_vendor_event_access_grants.sql`) | One account, one (shop, event). The day-of console admits admins always, others only with a grant. |
| Per-service scoping | `public.vendor_service_agents` (`20260816000000_vendor_service_agents.sql`) | An `agent` sees only the services (and therefore clients) assigned to them — "own work". |
| Whole branch | `vendor_team_members.whole_branch_keys TEXT[]` (`20271348490157_ultra_story_notes_whole_branch_and_branch_copies.sql`) | A person holds a whole location (`branch_id` or `'main'`); a trigger adds their `vendor_service_agents` row for every card filed there later. **This is already a branch scope.** |
| Per-person label | `vendor_team_members.team_label` | Free text "What they do" (e.g. "Front desk"), shown on the member row. Per PERSON, not per role. |
| Labels + blurbs | `VENDOR_TEAM_ROLE_LABEL`, `VENDOR_TEAM_ROLE_BLURB`, `VENDOR_TEAM_ROLE_PICK`, `VENDOR_ASSIGNABLE_ROLES` (`apps/web/lib/vendor-team.ts`) | Admin · runs the shop / Team member · own work / Helper · sees the schedule. |
| Role gates | `canManageVendor`, `resolveVendorRole`, `resolveVendorRoleForProfile`, `filterVendorNavGroups`, `VENDOR_SCOPED_NAV_ITEM_KEYS` (`apps/web/lib/vendor-role.ts`) | admin = everything; agent/viewer = Today + Clients only. |
| Event-day rule | `mayActForShopHere`, `teamRoleRunsTheShop`, `shopsThisAccountMayActFor` (`apps/web/lib/who-may-act-for-a-shop.ts`) | "runs the shop" OR "granted for this celebration". |
| Free helper | `FREE_HELPER_ROLE = 'viewer'`, `teamSeats` (`apps/web/lib/vendor-free-helper.ts`) | One Helper rides free on every plan. |
| Team screen | `TeamScreen` → `HelpersView` → `RolePick`, `InviteHelperSheet`, `AgentServiceAssignment` (`apps/web/app/vendor-dashboard/team/_components/`) | One row per person, role is ONE `PickMenu`, invite sheet = email · They can ▾ · What they do. Mounted by `/vendor-dashboard/team`, its rise route `@rise/(.)team`, and the Shop ⚙ "Team" fold. |
| Team actions | `inviteVendorTeamMember`, `updateVendorTeamMember`, `setVendorAgentServices`, admin motions (`apps/web/app/vendor-dashboard/team/actions.ts`) | All admin-gated through `fetchAdminVendorContext`. |
| Branches | `public.vendor_branches` (RLS: `current_vendor_profile_ids()` — the OWNER only), `apps/web/app/vendor-dashboard/branches/`, `_components/branch-manager.tsx` | Add / edit / pin branches. |
| Non-manager home | `AgentHome` in `apps/web/app/vendor-dashboard/page.tsx` | "You're on the team — ask your owner to assign you services". |

**In flight (RULE 0 #8):** open-PR search for role/team found nothing on supplier roles. #7585 (admin team areas × levels) is the
*Setnayan admin console*, not supplier shops — different table, no overlap. The spec corpus (`Setnayan-specs`) is not
reachable from this cloud session, so the DECISION_LOG row 2026-06-05 "Vendor admins see EVERYTHING" was not re-read
here; its rule is mirrored in code (`canManageVendor` → full nav) and is kept for Shop Manager.

## 1 · The six roles — today vs proposed

"Today" = the nearest existing enum value and what that value opens. "Should" = the owner's ruling (19 Nov).

| # | New role (fixed key) | Nearest today | Opens TODAY | Should open |
|---|---|---|---|---|
| 1 | **Shop Manager** `shop_manager` | `admin` | Everything: team, plan, branches, money, shop page, all clients, day-of console. | Same. "Sees everything including branches." Unchanged. |
| 2 | **Branch Manager** `branch_manager` | none (`admin` is whole-shop; `agent`+`whole_branch_keys` gives the branch's services but no team/money) | — | Everything a Shop Manager has, **for one branch**: that branch's clients, bookings, payments, event days, its team (invite/assign at or below their level, within the branch), its branch settings. Not the plan, not other branches, not shop-wide money settings. |
| 3 | **Account Manager** `account_manager` | `agent` | Today + Clients for their assigned services (`vendor_service_agents`). No payments screen, day-of only with a grant. | Bookings, chat, payments and event day **for their own clients**, on their branch. One role (owner: "this is one role"). Their clients' event days without a separate grant. |
| 4 | **Marketing** `marketing` | none | — | Shop page, cards, photos, promos, ads. **No bookings, no clients, no money.** Whole shop (TO CONFIRM). |
| 5 | **Event Crew** `event_crew` | `viewer` + `vendor_event_access_grants` | Today (read) + the day-of console for granted events. | Hub and photos **for the events they're given** only. Nothing else. |
| 6 | **Helper** `helper` | `viewer` | Today + Clients, read-only. | Sees the schedule, changes nothing. Stays the free seat (`FREE_HELPER_ROLE`). |

Event day (owner: *"event can also be handled by agent and branch admin and admin"*): Shop Manager (all events) ·
Branch Manager (their branch's events) · the client's Account Manager (their clients' events) · Event Crew (granted
events). Extends `shopsThisAccountMayActFor` from two ways in to four.

**DECIDED (owner, 19 Nov, relayed):** Marketing covers the whole shop — *"yes"* · ONE role per person — *"no"* to two
roles · money changes need no second Shop Manager's yes (no two-person approval; the existing two-admins-agree motions for
demote/remove are untouched).

## 2 · How the new roles map onto the existing enum — recommendation

**Do not extend `vendor_team_role`.** Keep it as the RLS *rank* and add the duty beside it:

- `ALTER TYPE … ADD VALUE` cannot be used in the transaction that adds it, and every one of the ~80 policies compares
  rank through `current_vendor_ids(min_role)`. New enum values would each need a rank, and **Branch Manager has no
  honest rank**: rank it as `admin` and all 34 `current_vendor_ids('admin')` policies open the whole shop to them; rank
  it `agent` and it loses team/money. A rank is one-dimensional; a branch is a second dimension.
- So: **role (rank) stays · a new `duty` column says which of the six · `branch_id` says where**.

### Proposed columns (one migration, `pnpm migration:new`, RLS at create)

```
vendor_team_members
  + duty       TEXT NULL  CHECK (duty IN ('shop_manager','branch_manager','account_manager',
                                               'marketing','event_crew','helper'))   -- ONE role per person (owner)
  + branch_id  UUID NULL REFERENCES vendor_branches(branch_id) ON DELETE SET NULL
                                               -- NULL = main location / whole shop
  (role stays: the rank RLS already reads, DERIVED from duty by a trigger — never typed by hand)
                                               CHECK: branch_id IS NULL when duty IN ('shop_manager','marketing')

vendor_role_names            -- NEW · the shop's own name for each fixed role
  vendor_profile_id UUID  REFERENCES vendor_profiles ON DELETE CASCADE
  duty              TEXT  CHECK (duty IN (the six))
  display_name      TEXT  CHECK (length BETWEEN 1 AND 40)
  updated_by        UUID  REFERENCES auth.users ON DELETE SET NULL
  updated_at        TIMESTAMPTZ
  PRIMARY KEY (vendor_profile_id, duty)
  RLS: SELECT current_vendor_ids('viewer') · write current_vendor_ids('admin') · is_admin()
```

Derived rank (trigger `vendor_team_members_rank_from_duty`, so every existing policy keeps working unchanged):
`shop_manager → admin` · `branch_manager → agent` · `account_manager → agent` · `marketing → agent` ·
`event_crew → viewer` · `helper → viewer`.

Backfill (same migration, data-only): `admin|owner → shop_manager` · `agent → account_manager` with `branch_id`
from a single `whole_branch_keys` entry when there is exactly one · `viewer → helper`. Nothing loses access on day one.

### Why a separate names table, not `team_label`

`team_label` is **per person** ("Front desk"). The owner's ask is **per role, per shop** ("our Account Managers are
called Coordinators"), shown on every card of that role. Different fact → different home, so no two sources of truth.
Card line becomes `<shop's name for the role> · <branch>`, with the fixed role behind ⓘ. **Open:** keep `team_label`
as an extra per-person line, or retire it once role names exist? (Drawn as kept, smaller.)

### New / changed RLS helpers

| Helper | Change |
|---|---|
| `current_vendor_ids(min_role)` | **Unchanged.** Rank still derived; all ~80 policies untouched. |
| `current_vendor_branch_keys(vendor_profile_id)` **new** | The branch keys (`branch_id` or `'main'`) the caller manages: all for Shop Manager, `{branch_id}` for Branch Manager. SECURITY DEFINER, STABLE, `search_path` pinned. |
| `current_vendor_duty_ids(duty)` **new** | Shop ids where the caller holds a duty — for the Marketing write policies on `vendor_profiles` storefront columns, `vendor_services` card content, portfolio/photos, promos, ads. |
| `vendor_service_agents` | Branch Manager gets the branch via the existing `whole_branch_keys` trigger (no new mechanism). |
| `vendor_event_access_grants` | Unchanged; Event Crew keeps using it. Account Manager / Branch Manager reach event day by the client's service/branch instead of a grant. |
| `vendor_branches` policy | Today owner-only (`current_vendor_profile_ids()`). Add SELECT for the team (branch names on cards) and UPDATE for the Branch Manager of that row. |

The 10th canonical helper is a new RLS pattern — **needs owner sign-off** per RLS_Policy_Pattern ("no invented
patterns"), flagged in the PR.

## 3 · Screens that change

| Screen / module | Change |
|---|---|
| `lib/vendor-team.ts` | `VENDOR_DUTIES`, fixed names + one-line blurbs for the six; `VENDOR_TEAM_ROLE_PICK` becomes the duty pick. `fetchVendorRoleNames`. |
| `lib/vendor-role.ts` | `resolveVendorDuties`; `filterVendorNavGroups` by duty (Marketing → Shop/cards/photos/promos; Event Crew → Today + their events). |
| `lib/who-may-act-for-a-shop.ts` | Four ways in (Shop Manager · Branch Manager of the event's branch · the client's Account Manager · Event Crew grant). |
| `lib/vendor-free-helper.ts` | Free seat = `helper` duty (same rule, new key). |
| `team/_components/helpers-view.tsx` | Member row shows the shop's role name + branch; a new **Roles** fold/page. |
| `team/_components/helpers-controls.tsx` | `RolePick` and `InviteHelperSheet`: Role ▾ (one) and Branch ▾ (only for Branch/Account Manager, only when the shop has ≥ 2 locations). |
| `team/roles/page.tsx` **new** + `@rise/(.)team/roles` | The Roles page: six fixed roles, one line each, ⓘ for detail, a box for the shop's own name. |
| `team/actions.ts` | `setVendorRoleName`; invite/update carry `duty` + `branch_id`; Branch Manager may manage their branch's team. |
| `vendor-dashboard/page.tsx` `AgentHome` | Superseded by the Today scoping PR (each role sees its own tasks) — **separate later PR**. |
| Everywhere a member card renders (`customers/page.tsx`, `admin/vendors/[vendorProfileId]/team`, prints) | Read the role name through one helper `memberRoleLine`. |

## 3b · The plan sets the team (owner 19 Nov: *"Plan Page will pick the plan. Then we will identify the roles and their coverage."*)

The seat and branch numbers ALREADY EXIST — read, not invented:

| Plan (`TIER_LABEL`) | Seats with the owner | Branches beside main | Source |
|---|---|---|---|
| Free · Verified · Plus · Pro · Ultra | 1 · 1 · 2 · 6 · 12 | 0 · 0 · 0 · 2 · 5 | `TIER_CAPS[*].agentAccounts` (seats BEYOND the owner 0·0·1·5·11) in `lib/vendor-tier-caps.ts`; `vendor_billing_catalog.max_sub_seats` for the paid SKUs, written by `20271350427190_supplier_plans_rebuilt_2026_11_18.sql` (owner "SUPPLIER PLANS REBUILT", 2026-11-18). |

Plus one free Helper on every plan (`FREE_HELPER_SEATS`). ⚠ The live DB was **not** read from this session (no credentials);
re-measure with `select sku_code, max_sub_seats from vendor_billing_catalog where sku_code like '%vendor_%'`. That
migration names the top plan "Max" while the app labels `enterprise` "Ultra" — the drawing uses the app's label.

**No plan row says which ROLES a plan includes, or how many seats each role may take** → both are drawn as
**TO CONFIRM** (drawn default: every plan may use every role inside its seat count). Delta: the Plan page gets a
"Your team on <plan>" row and a "Roles and who covers what ›" row into Team › Roles; the Roles page opens with the
plan's line and "Change plan".

## 3c · Who gets new inquiries (owner 19 Nov: *"(Branch-Type of Event-Last Name)"*, *"2 account managers — A-M … N-Z"*)

**Nothing ships for this today** (searched `assigned_agent|auto_assign|round_robin|assignee_member` across migrations,
`lib/` and `vendor-dashboard/` — no hits). Today an agent sees every inquiry on the services they are given
(`vendor_service_agents`); two agents on one service both see every inquiry and nobody owns it.

Proposed:
- **Branch** = the branch the inquiry's service card is filed under (`vendor_services.branch_id`, NULL = main) — existing.
- **Event type** = the inquiry's `event_type` (enum `public.event_type`) — existing. One row per type the shop sets,
  plus "Every other event".
- **Last name** = a letter range per Account Manager. New table `vendor_inquiry_routes(vendor_profile_id, branch_key,
  event_type NULL = every other, vendor_team_member_id, letter_from, letter_to, adjusted BOOLEAN)`, RLS at create
  (`current_vendor_ids('viewer')` read · Shop Manager / that branch's Branch Manager write).
- **Even split, by itself:** when an Account Manager joins or leaves a branch, each route row for that branch that is NOT
  `adjusted` re-splits A–Z evenly by letter, in join order (1 → A–Z · 2 → A–M / N–Z · 3 → A–H / I–Q / R–Z). An adjusted
  split is left alone and the manager sees "X joined · Reset to even?". Inquiries already handed out never move.
- The inquiry gets an owner: a new `assigned_member_id` on the inquiry thread, set once when it arrives.
- **TO CONFIRM:** whose last name counts (drawn: the person who sent the inquiry) · when that Account Manager is away
  (drawn: the next Account Manager in the branch, then the Branch Manager).

## 4 · Order of work (after the owner OKs the drawing)

1. PR A — migration (`duty`, `branch_id`, `vendor_role_names`, rank trigger, backfill, two helpers, RLS at create) +
   Ugat map node + the lib changes + the Roles page + card + invite. Guards: a duty-derives-rank test, a "the card
   shows the shop's name" render test, a fail-closed branch test.
2. PR B — inquiry routing (`vendor_inquiry_routes`, auto re-split, assignment on arrival) + the "Who gets new inquiries" card.
3. PR C (later) — Today/nav scoping per duty, `AgentHome` retired.
