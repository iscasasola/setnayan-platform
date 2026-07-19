## 2026-07-10 · fix(admin): close the Insights Studio loading + title gaps

Follow-up to the Insights Studio (App Performance → tabbed `/admin/app-performance`). Two gaps from folding 8 routes into one:

1. **Per-tab loading skeleton lost.** Each standalone route shipped its own `loading.tsx` (Grid for the stat dashboards, Table for funnels/ops/logs, List for the offline daemon). After the fold-in, the one route-level skeleton (Grid) showed for every tab. Fix: the tab strip now renders synchronously and the active surface is wrapped in its OWN `<Suspense>` (keyed by tab) with the tab-shaped skeleton — so switching tabs paints the strip instantly and streams the correct skeleton. Deleted the 6 now-dead redirect-dir `loading.tsx` (those routes are instant redirects; the skeleton never showed).

2. **Per-tab `<title>` lost.** The shell set one static "App Performance · Admin" title for all tabs. Restored via `generateMetadata` → `<TabTitle> · Admin` per active tab.

Also corrected the stale count (six→seven legacy routes, 7→8 pages) in the original Insights Studio changelog fragment.

Verified: production build passes; each tab shows its own skeleton + title.

SPEC IMPACT: None.
