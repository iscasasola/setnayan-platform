## 2026-11-13 · feat(admin): team areas × levels, and the owner approves his own two-admin requests (typed + 24 h)

Slice 2 of the approved admin (Setnayan-specs `prototypes/admin_pub/` — admin.html Team + Admin log, work.html
approvals row, map.html builder panel `#builder-2026-11-13`). Two owner rulings, DECISION_LOG 2026-11-13:
"ADMIN TEAM: AREAS × LEVELS — AI FIRST, THEN BASIC, THEN ESCALATED" and "THE OWNER APPROVES HIS OWN TWO-ADMIN
ACTIONS — TYPED + 24 H".

**Areas × levels**
- Migration `20271343355752`: `public.admin_areas()` (the 16 areas from the drawing's `admin.js`, one list for every
  CHECK) · `admin_scopes(user_id, area, level)` with RLS on at CREATE (admin-or-self read, service-role writes) ·
  `admin_audit_log.area` (CHECK-ed; NOT backfilled — the log is append-only, so old rows read their area from the
  action name) · `work_escalations` (Escalate ▸ with a note; one open per item).
- `isAdminProfile` stays the gate for opening /admin. `can(area, level)` (`lib/admin/can.ts` + `can.server.ts`) decides
  what an admin may DO: the owner always; Escalated includes Basic; unreadable scopes or an unknown area is NO, with a
  sentence that says it could not read rather than "not your area".
- **Nothing changes for anyone on the day it lands:** every existing admin who is not the owner is carried over with
  all 16 areas at both levels. The owner narrows people on the new Team screen; a brand-new admin starts with nothing.
- `requireAdminCan(area, level)` added inside 37 actions: approvals (decide = Escalated in the request's area), pricing
  (11), payments (8), users (9), fraud (3), vendors (3), receiving accounts (3).
- New screens: **/admin/team** (add an admin — name · email · area ticks · Basic / Escalated / both; owner shown as
  "everything" and locked; greyed with the reason in the ⓘ for anyone without Team · Escalated) and **/admin/admin-log**
  (Person ▾ · Area ▾ · Action · Day ▾; every row "by <name> · time"). Approvals: Escalated buttons greyed for a Basic
  admin with the reason in the ⓘ, Escalate ▸ with a note, a "Waiting for an Escalated admin" section, and "by <name> ·
  time" on decided rows. No nav was touched (the five-tab shell is another session's).
- Giving the Escalated level is itself a two-admin request (`grant_admin_escalated`, new vocabulary value);
  "Add an admin" rides on `grant_team_member`, which now carries the ticked areas and writes them before the flag.

**Owner self-approval**
- `admin_approval_requests.self_confirmed_at` + `run_after`, a `withdrawn` status (Cancel), and the four-eyes CHECK
  relaxed for exactly one shape. The trigger `guard_owner_self_approval` holds the rule on the DATABASE clock: only the
  owner (`is_platform_owner`: the owner address AND is_internal) may type the word on his own request; the database
  stamps the time; the wait cannot be moved once started; his own request can be decided by him only after
  `run_after`. Staff admins still never decide their own.
- The runner (cron-free, `after()` on `/`, Approvals and Team) executes due rows; a failed run is closed as `expired`
  with the reason instead of retrying forever. Two emails to the owner: when it starts waiting, and when it runs (or
  could not). Sent directly — the owner's own ruling about mail to himself.
- ONE new server action (`adminTeamAct`, op = add · save · clear · confirm_own · withdraw · escalate · resolve ·
  run_due) instead of eight; action budget 1249 → 1250 measured on the merged tree.

**Tests:** `lib/admin/areas-and-can.test.ts` (a Basic admin is refused an Escalated action; TS ⇄ SQL area list, owner
address and action vocabulary agree) · `lib/admin/self-approval.test.ts` · `tests/db/admin-areas-and-owner-self-approval.db.test.ts`
(the owner cannot self-approve before 24 h — mutation-checked: removing the clock check turns it red; a back-dated start
is overwritten; staff never; an audit row records area and actor). Exposure baseline regenerated: +26 lines, every one
read (two admin-only tables, two columns shaped like their neighbours, two helpers).

SPEC IMPACT: FEATURE_REGISTER.md (corpus) gains the row for `/admin/team` + `/admin/admin-log`. No ruling changed.
