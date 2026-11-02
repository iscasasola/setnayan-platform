## 2026-08-14 · feat(admin): One Shell slice 3 — the console keeps the left rail

Owner, 2026-08-13, over three YouTube screenshots in which the left rail never leaves: *"the sidebar should stay. look at here as we navigate around. what you did was jumping back to the old dashboards. so what we want to see the dashboards converted for this desktop view."* `DECISION_LOG.md` 2026-08-13 · `ONE_SHELL_PLAN_2026-08-13.md` § 2, slice 3 · drawing `prototypes/one_shell_2026-08-13.html`.

**What a person gets:** opening Setnayan HQ no longer swaps the furniture. The rail they had a second ago stays — their events, their Alaala, their story, their shop — and the console's own six menus appear underneath them. Everything the console offered is still offered, in the same places, with the same words.

**Scope: chrome only, desktop ≥1024, 108 screens. Zero route moves, zero page-body changes, no schema.** Below 1024 nothing changes at all: the shared rail paints nothing there by design and `<AdminBottomNav>` remains the whole of navigation.

### Nothing about the menu was redrawn

`ADMIN_NAV_GROUPS` is untouched. The six groups still render **flat** as six top-level rows (owner 2026-07-15, *"solid menu with no submenus"*) — Overview · Accounts · Studio · Ugat Console · App Performance · Money — and "All surfaces" is still a **link** to `/admin/more`, deliberately **not** a seventh group. The registry overlay, the queue badges, the worst-urgency roll-up and the active-row rule all moved out of the deleted component *verbatim*; `admin-sidebar.tsx` keeps them and keeps `MENU_HUBS`, because `admin-nav-groups.test.ts` reads that constant **out of that file by path**. Renaming the file would blind that guard while every test stayed green.

### Three things the old shell quietly owned, re-homed rather than assumed

Each would have vanished with nothing to throw and nothing to log:

1. **The sticky top bar and the owner-locked hide-on-scroll rule** (2026-06-15) belonged to `SidebarShell`'s `topBar` *slot*, not to the bar. `<AdminStickyTopBar>` is that slot, and it **wraps the identical markup** — the SLA pill, the bell, the role badge, the name and the account menu are not re-typed, so a rewrite cannot drop one.
2. **`.sn-vt-page` on the content.** `NavSlideController` lists `/admin` among its base tabs and animates exactly one *named* element, freezing the rest. That name rode on `SidebarShell`'s `<main>`. Without it the mobile tab tap still starts a transition and **animates nothing** — a dead feature with no error. It is on the content wrapper, and the guard asserts **exactly one** (two is a duplicate `view-transition-name`, which makes the browser skip the transition outright).
3. 🔒 **The account menu on desktop.** It opened from the HQ plaque in the old sidebar header, with the top bar's `<AccountSwitcher>` marked `lg:hidden` as the mobile twin. The header is gone and the shared rail has no account menu in its app variant, so the pill is now shown **at every width** — it is the only route to sign out of HQ since the loose top-bar sign-out was retired 2026-08-13.

### The 72px icon strip: decided, not discovered

Between 1024 and 1280 the rail is an icon strip and the stylesheet hides `.fd-ct`, so a per-menu queue count is not visible there. That matches what the old rail did when collapsed to 64px, and it is only acceptable because SLA pressure has a second, always-visible channel: the overdue / due-soon pill in the top bar, on every admin page at every width. The guard pins that pill **for this reason** — if it goes, the badge must stop being a `.fd-ct` count.

### 🛡 Guards — both mutation-proved, 16/16 sabotages caught

- **`admin-carries-the-cron-free-jobs.test.ts`** — this repo is cron-free: **12** background jobs ride on admin traffic through `after()` with no scheduler behind them. Each must be present *and inside an `after()` call*, and the total is counted, so a thirteenth job cannot be added un-listed and then dropped silently by the next rewrite. Sabotages proved RED: a sweep deleted, a job moved out of `after()`, a job added.
- **`admin-rail-context.test.ts`** — no row states its own active state (the front-door rail shipped `Home` hardcoded `data-on="true"`); one winner and never two; `null` renders as *no row lit*, never a fallback to the first; All surfaces is not a group; the account menu is reachable at every width; the SLA pill survives; the bottom nav and ⌘K are mounted **once each and unconditionally**.

🪤 **One of these guards was decoration on its first run, and the mutation said so.** The bottom-nav check asserted the string `<AdminBottomNav` appeared — sabotaging the layout to `{null && <AdminBottomNav …}`, which removes the bar from every phone, left that string in place and the guard **GREEN**. Rewritten to count the mount and reject the two shapes that render nothing while reading as one. Every sabotage in the run is reported with its **occurrence count before → after**, and two of the first cut's mutations *did not land at all* because the replacement text contained the needle — the same `DISABLED_foo` prefix trap already on record here.

### `lint-port-no-lost-controls` did its job

It failed the first push of this change and named six removed blocks — `SidebarShell`, `AdminSidebar`, `AdminSidebarMenu`, `DoorwaySidebarHeader`, `SwitcherPlaqueTrigger`, `Badge` — which is exactly the list above. **No destination was lost**, only the elements they were drawn with. Baseline regenerated in this same PR so each removal reads as one line in the diff.

### ⏭ Named, not fixed

**A bare tabbed admin URL lights no rail row.** `/admin/pricing` with no query is a real page, but the Money group declares that row as `/admin/pricing?tab=pricing` *including in its `matchPrefix`* — and a `matchPrefix` is compared against a pathname, which can never contain a `?`. **This is not a regression of this port**: the predicate is the shipped one, moved unchanged, and the old sidebar lit nothing there either. Pinned by a test that says to delete it when the fix lands, because the fix is a `matchPrefix` edit inside `ADMIN_NAV_GROUPS` — nav membership, not chrome.

**The six group labels are not renameable from the nav registry.** They never were: the registry overlay applies to a group's *items*, which after the 2026-07-15 flatten feed only active-detection and the badge roll-up. Unchanged here, and stated so it is not mistaken for something this slice dropped.

SPEC IMPACT: `ONE_SHELL_PLAN_2026-08-13.md` § 2 — the slice table's admin row is marked shipped, and `DECISION_LOG.md` carries the row. No product decision changes: no price, no SKU, no schema, no route, and no menu membership.
