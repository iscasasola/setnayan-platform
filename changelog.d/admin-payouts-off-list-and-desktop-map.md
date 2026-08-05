## 2026-08-04 · fix(admin): drop the dead Payouts lane, and let desktop see the whole menu

Two loose ends from the admin simplification the owner approved. Neither builds anything new — one removes a row, the other flips a prop that already existed.

### 1 · Payouts leaves the work list

`/admin/work` ranks what needs the owner **today**. `payouts` can never accrue new work: the dispatcher's own call site records the 2026-05-28 V2 cutover — *"Setnayan is now a software publisher, not a marketplace intermediary… new V2 orders won't route through it"*. Couples pay vendors directly, off-platform; only pre-V2 orders carrying `vendor_profile_id` can reach it.

A lane that can never fill costs a row and a glance every morning, forever.

It goes into `WORKLIST_EXCLUDED_KEYS` — the opt-out list that already exists for exactly this, so `work-rows.test.ts` still enforces 1:1 coverage and an *accidentally* dropped queue keeps failing. It **keeps** its `ADMIN_QUEUE_META` entry: the Money menu still links `/admin/payouts` for legacy rows, and the badge should still light if one ever surfaces. **This removes the daily prompt, not the page.**

### 2 · The full menu appears on desktop

`/admin/more` already renders **every** group and item from `ADMIN_NAV_GROUPS` with a live filter — the "All surfaces" screen from the approved sample. It was `lg:hidden`, on the premise that *"the sidebar handles overflow there"*.

The **2026-07-15 flatten ended that premise**: the sidebar became six plain doorways, so 108 admin pages had no browsable index on desktop at all. The map existed the whole time; nobody could reach it from a laptop.

`MobileLandingGrid` already had a `desktopVisible` prop. One flag, plus a sidebar row so it is reachable. Retitled to **All surfaces** to match the approved sample.

The sidebar row is deliberately **not** a seventh `ADMIN_NAV_GROUPS` entry: it is a link to a page, not a group of items, and adding it there would break the groups-to-`MENU_HUBS` parity that `admin-nav-groups.test.ts` asserts — the guard written after a cleanup commit silently deleted two whole groups.

Verified: full unit suite green · lint clean · zero typecheck errors in the changed files.

SPEC IMPACT: None.
