## 2026-08-03 · fix(admin): restore the two nav groups a cleanup commit deleted by accident, and guard the shape

**The admin sidebar has been rendering four menu rows instead of six since 2026-08-02.** Owner-reported after opening the console.

`4604bf718` ("retire the sign-in hero video") was meant to delete ONE 7-line nav item from `ADMIN_NAV_GROUPS`. Its diff on that file is **332 deletions, 0 insertions**. It took out:

- the entire **`directory` (Accounts)** group — Users · Founder seats · Vendors · Demo vendors · Events · Venues;
- the entire **`media` (Studio)** group — its 13 surviving items were absorbed into the **Overview** group, so the row labelled "Overview" listed Songs, Patiktok, Referrals and Discount codes;
- all **27 Overview act-now queue items** — Verify · Payments · Payouts · Disputes · Fraud · Approvals · every SLA-bound lane.

**Blast radius was narrower than it sounds, and worth stating precisely.** `deriveSixMenus()` maps over the groups, so the desktop sidebar lost two rows and every queue link. But `MENU_HUBS` still defined hubs for both dead groups, the `/admin` landing kept its tiles, and the mobile bottom nav hard-codes its own Accounts tab — so **no surface became unreachable**. The menu was wrong, not the app.

**Restored** `admin-nav-groups.tsx` to its pre-`4604bf718` state, then re-applied the one deletion that was intended (the `hero-video` item, replaced by a comment pointing at `lib/website-media-retired-hero.test.ts`) and dropped the now-unused `Video` icon import. Diff against the pre-regression file is exactly those two hunks. Result: **6 groups · 78 items** (79 minus hero-video).

### Why nothing caught it, and what does now

A menu is an array of objects. A shorter array is still a valid array — typecheck, lint, and 6,275 unit tests all stayed green. New `admin-nav-groups.test.ts` checks the menu against two sources that exist for their **own** reasons, so this is never two hand-typed lists agreeing with each other:

- **`NAV_SLOT_DEFAULTS`** carries one `admin.sidebar.<key>` slot per item so `/admin/menus` can rename and re-icon it. It is maintained for the rename feature. Every slot must still have an item — on the broken commit, **28 are orphaned**.
- **`MENU_HUBS`** carries one entry per group. It survived the deletion untouched, so comparing against it catches a vanished group *even when its items are absorbed elsewhere and the total count still looks plausible* — which is exactly what happened here.

Plus: no empty group, no duplicate item key, and a **self-check that every source parsed non-empty** — a guard that matches nothing passes forever.

**Verified in both directions:** 4 tests pass on the fix; tests 2 and 3 fail with actionable messages when `admin-nav-groups.tsx` is swapped back to the broken version. A guard that cannot fail is worse than none.

No exact group or item COUNT is asserted. A number in a test is a number someone bumps to make the build pass.

⚠ Local run used `node_modules` linked from an older checkout, so 4 pre-existing failures (`papic-*`, `vendor-deep-search-*`) and 145 `Cannot find module` typecheck errors appear — all confirmed identical on unmodified `origin/main`, all traced to packages that checkout predates (`@electric-sql/pglite`, `leaflet`, `@react-three/postprocessing`). **Zero errors in the changed files.** CI installs the real lockfile.

SPEC IMPACT: None — restores the IA already locked by the 2026-07-04 six-menu respine and the 2026-07-15 flatten. No SKU, price, route, or schema change.
