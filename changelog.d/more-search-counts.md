## 2026-06-21 · feat(nav): search (+ count-badge support) in the "More" menus

The "make More nicer" follow-up. The vendor + admin "More" overflow menus are long (≈20–25 surfaces), so they now have a **search box** that filters the cards as you type.

- **`app/_components/more-search.tsx`** (new) — a small client filter. The "More" renderers are server components (Lucide icon refs can't cross the Server→Client boundary), so instead of re-rendering cards on the client it filters the already-rendered DOM: the renderer tags its root `data-more-root`, each card `data-more-card data-more-label="…"`, each section `data-more-section`, and a `data-more-empty` no-results note; the input just toggles `hidden` as you type (sections with no visible card hide too). Scoped via `closest('[data-more-root]')`.
- **`admin/_components/mobile-landing-grid.tsx`** + **`vendor-dashboard/_components/vendor-mobile-landing.tsx`** — render the search input (behind a `searchable` prop, so the shorter directory/money landings keep no search), the data attributes, and the no-results state. The admin card also gained **count-badge support** (an optional `count` on an item renders a Mulberry badge top-right) — the infrastructure for "N unread"-style counts.
- **`admin/more/page.tsx`** + **`vendor-dashboard/more/page.tsx`** — opt in with `searchable`.

Counts: most "More" items are settings/config surfaces where a count doesn't apply (the count-bearing queues live on the bottom-nav tabs + the broken-out action). So the badge *support* is shipped, but no specific count is wired yet — the obvious first one (admin Notifications unread) is a tiny follow-up, deliberately deferred to keep the static `/admin/more` page static (wiring it would add a per-load DB query).

Verified: `pnpm typecheck` 0 · `pnpm lint` 0. Best seen on the Vercel preview (admin/vendor `/more`, mobile width).

SPEC IMPACT: Nav presentation — search in the "More" menus + count-badge support. No SKU/schema/pricing/public-claim change.
