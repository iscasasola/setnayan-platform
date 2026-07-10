## 2026-07-10 · feat(vendors): Budget tab inside the Merkado + remove the standalone Budget nav (PR-4 · S-Budget)

Owner 2026-07-09/10: put the budget where the spend decisions happen (the Merkado) and drop the redundant top-level Budget nav item. Done by REUSING the existing, mature budget system — no new schema, no rebuild.

- **New `Budget` tab in the Services/Merkado takeover** — added `'budget'` to `BUDGET_BUILD_TABS` + `TAB_META` (the single source), so it appears automatically in both the desktop tab strip AND the mobile section sub-nav (`customer-menu.ts` derives the Explore children from `BUDGET_BUILD_TABS`). Renders in the sticky right rail (collapsible, like Compare) after the two-column S1 layout.
- **`MerkadoBudgetLens`** — a compact lens reusing the budget page's exact `buildBudgetLiveSummary` math (payment progress + soonest due milestones), then an "Open budget & payments" link to the full surface. **No new math, no new table** — the full budget (target · median-anchored allotments via `budget-allocation` · per-vendor itemization · payment schedules · **off-platform/manual line items, which already exist**) stays at `/dashboard/[eventId]/budget`.
- **Removed the standalone Budget nav item** — from `customer-menu.ts` (`planningMenus`, the source of the sidebar + bottom-nav + docked sub-nav) and its two `nav-registry-defaults.ts` slot defaults. The full budget surface stays reachable from the Merkado's Budget tab + direct links, so **no access is stranded** (the deliberate build-order: tab first, nav-removal second). Dropped the now-unused `Wallet/Gauge/PieChart/Receipt` icon imports.
- Behind `BUDGET_BUILD_ENABLED` with the rest of the takeover.

Verified: `tsc` clean · `next lint` clean · `customer-menu.test.ts` + `nav-registry-defaults.test.ts` updated + green (12 tests) — the menu-keys assertions now read `['home','guests','explore','studio']`.

Files: `apps/web/lib/budget-build.ts`, `apps/web/app/dashboard/[eventId]/vendors/_components/services-takeover.tsx`, `apps/web/app/dashboard/[eventId]/vendors/_components/merkado-budget-lens.tsx`, `apps/web/app/dashboard/[eventId]/vendors/page.tsx`, `apps/web/lib/customer-menu.ts`, `apps/web/lib/customer-menu.test.ts`, `apps/web/lib/nav-registry-defaults.ts`.

SPEC IMPACT: None — IA/composition only (surface the existing budget in the Merkado; remove the redundant nav entry). No schema, pricing, SKU, or engine change.
