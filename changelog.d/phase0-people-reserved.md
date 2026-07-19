# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(account-home): reserved "People" nav item + page — Phase 0 slice 2 (person-spine)

Gives the person-spine **connections** layer its permanent home in the account rail, ahead of the graph itself. Reserved / inert — no `people`-table data is wired; the page renders a "coming with connections (Phase 2)" preview. Part of the locked person-spine plan (`03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md`).

- **`app/dashboard/(account)/people/page.tsx`** (new) — reserved People page previewing the three connection layers: **Family** (first-degree only — spouse · parent · sibling · child, with "grandparents / cousins / in-laws appear automatically"), **Godparents · Ninong/Ninang** (event-created from binyag/wedding/confirmation), and **Friends** (co-presence), under the locked guardrails (mutually confirmed · adults-first · private to you). All inert.
- **`account-nav-config.ts`** — new `people` item (`Users` icon, `/dashboard/people`) inserted after My Events.
- **`account-sidebar.tsx`** — `SIDEBAR_SLOT_KEYS.people → customer.account.people` so the item is admin-editable via the nav registry (same wiring as Memories Hub).
- **`lib/nav-registry-defaults.ts`** — new `customer.account.people` slot default (route `/dashboard/people`, `Users`).

Wiring cross-checked end-to-end (route ↔ href ↔ matchPrefix ↔ slot ↔ registry route all agree on `/dashboard/people`). Verified: tsc clean · `lint:navicon` delegation guard passed · `next lint` clean · `nav-registry-defaults` node:test 8/8 (validates the new slot's icon against the allowlist).

Note for owner: the item is visible to **all** account users (leading to the reserved preview page) — say the word if you'd rather flag-gate it to internal accounts until Phase 2 lands.

SPEC IMPACT: None new — reserved nav surface for Phase 2 of the locked person-spine plan; no schema, no graph data.
