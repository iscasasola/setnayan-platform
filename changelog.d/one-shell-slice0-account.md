## 2026-08-13 · feat(dashboard): One Shell slice 0 — the couple's own account pages keep the left rail

Owner, over three YouTube screenshots in which the left rail never leaves: *"the sidebar should stay. look at here as we navigate around. what you did was jumping back to the old dashboards. so what we want to see the dashboards converted for this desktop view."* — then *"yes exactly!"* to the restatement. `DECISION_LOG.md` 2026-08-13 · `ONE_SHELL_PLAN_2026-08-13.md` · drawing `prototypes/one_shell_2026-08-13.html`.

**What a person gets:** they sign in, and the site does not change shape. The same rail they saw signed-out is still there, now carrying their events, their Alaala, their story, and — if they hold them — their shop and Setnayan HQ. Pressing anything keeps the rail.

**Scope: desktop ≥1024 only, ~15 screens** — the events board plus the account spokes (`(launcher)` + `(account)`). No route moved. The phone keeps its bottom-bar grammar untouched; converting it would be a blueprint regression.

### 🔴 The defect this slice had to fix first

**The front-door rail had NO active-route logic — `Home` was hardcoded `data-on="true"`.** Correct on the one URL it rendered on, and wrong on all 296 the moment the same rail mounts anywhere else. Nothing throws. Now every row's state comes from the **shipped** `match-path.ts` matcher via a new `activeRailKey` resolver, and `rail-active.test.ts` fails if any row's active state is a literal.

🔑 **A "which one" resolver, not a per-row boolean.** The shipped matcher is prefix-based by contract, so asking each row independently DOUBLE-LIGHTS: on `/dashboard/library` both `/dashboard` and `/dashboard/library` answer yes. The most specific match wins, and `/dashboard` is declared `exact` — otherwise reading your own settings tells you you are looking at your events.

### 🔒 This deliberately reverses an owner lock

`dashboard/(launcher)/layout.tsx` and `dashboard/(account)/layout.tsx` were chrome-less by the 2026-06-14 retirement and owner rulings 2026-07-09/13 (*"we do not want side bar and menu bars here"*). The owner **superseded** that on 2026-08-13. Both layouts now carry the reversal in their own docblocks, citing the log row, so no future session "restores" the chrome-less launcher believing the older ruling still stands. The retired `<SidebarShell>` / `<AccountSidebar>` paradigm is **not** what came back — the front door's own rail is.

### The app variant lends its CHROME and never its page styling

`.fd` sets background, colour and typeface, and the last two are **inherited**. Mounted around ~15 account pages unchanged it would have repainted every one of them in the front door's system face — silently answering `ONE_SHELL_PLAN` §5.3, an **open owner decision** about the chrome typeface. Under `[data-chrome='app']` those page-level declarations are unset; the rail keeps the front-door face (the plan's own recommendation) and the app's terracotta and serif reach the content column untouched. `front-door.css`'s header said *"nothing outside `/` may inherit a rule from this file"*; that sentence is now **wrong rather than stale**, so it was replaced, not appended to.

### 🔑 The app variant renders the RAIL ONLY — no top bar

The signed-in surfaces already carry their own. The launcher's one-line rail holds the **⌘K command bar**, the bell and the account switcher, and its docblock names those a REACHABILITY CONTRACT — **sign-out exists nowhere else on that surface**. Swapping it for the front door's top bar would trade a command palette over your own events for a search box aimed at the supplier marketplace, and drop two doors on the way. Nothing was removed anywhere; the rail is added beside what already shipped. This also matches the three real `SidebarShell` mounts, which are likewise a rail beside a surface that keeps its own top chrome.

### Traps closed on the way

- **`SidebarShell` has THREE real mounts, not five.** A plain grep over layouts returns five; `(account)/layout.tsx` and `dashboard/layout.tsx` only *mention* it in prose. Measured by import + JSX, not by string hit. Nothing about it was touched.
- **The sr-only `<h1>`** is now front-door-only. Carried into the app variant it would have put **two `<h1>`s on all ~15 pages** — the defect the 2026-08-13 doorway work measured and closed.
- **Labels come from `getNavSlotMap()`** in the app variant. Hard-coding them would make an admin rename apply on the phone and not on the desktop — two answers to one question, no error.
- **The three cron-free `after()` jobs on `/` are untouched** — nothing in `app/page.tsx` changed.
- **The session-reading shell is mounted per tree, never on public pages** (which it would silently de-cache) and never by "routing through `/`" (middleware bounces Capacitor/Tauri off marketing paths, owner-locked 2026-06-10).
- **`isHidden` from the nav registry is deliberately NOT read.** A first cut dropped admin-hidden rows — a second authority on which rows exist, and it collided head-on with the shipped guard pinning the Find-a-supplier gate to `account.signedIn` and its exact polarity. Labels were the ask; hiding was not.

### Guards — 12 sabotages, 12 caught, counts measured before → after

`rail-active.test.ts` (16 tests). Every assertion was mutation-tested with the occurrence count of the sabotaged string printed before and after; an anchor that failed to move is reported as DID-NOT-APPLY, never as a pass.

🪤 **Two of my own guards were decorative on their first run, and both were caught by measurement, not by reading them.**
1. The literal check scanned for the JSX attribute `data-on=` — which no longer exists anywhere, because the value is produced once as an object key. Its own "found none" assertion is the only reason this surfaced; without that line it would have passed forever while checking an empty list.
2. The behaviour tests declared their own copy of the row list, so deleting `exact: true` from the **shipped** list passed everything. **Testing the primitive is not testing the caller.** Fixed at the cause: the list moved into an exported `railMatchRows()` the tests now call.

Three existing guards were **re-anchored, not relaxed**, because code moved beneath them — the shop-row check and the folder-count check went red on the move, which is how both were found.

### Also

`matchesPath` accepts `Pick<NavItem, 'href' | 'matchPrefix'>` instead of a full `NavItem` — a pure type **widening** (it only ever read those two fields; a full `NavItem` demands a LucideIcon the glyph rail has no use for). Every existing caller still satisfies it; behaviour untouched. `resolveRailAccount`, the Studio group and the folder mapping moved out of `front-door.tsx` into `rail-data.ts` so both mounts resolve "which consoles does this person hold" and "how many suppliers in this category" from **one** source.

Verified: typecheck exit 0 · 8024/8024 unit tests · all 16 `lint:*` scripts read for output, not just exit codes · eslint clean in every touched file.

SPEC IMPACT: None — no SKU, price, schema or route change. Chrome only, desktop ≥1024. The owner-lock reversal is already recorded in `DECISION_LOG.md` 2026-08-13; both layouts now cite it inline.
