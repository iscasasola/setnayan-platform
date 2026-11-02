## 2026-07-10 · feat(admin): Insights Studio — fold the App Performance menu into one tabbed surface

Owner: "what else can we integrate to each other?" → picked all four remaining flat menus for studio consolidation. This is the first (the strongest — all read-only analytics, zero mutation risk).

The **App Performance menu's 8 standalone pages are now 8 tabs of one `/admin/app-performance` studio** (Overview cockpit · Growth · Intelligence · SEO & GEO · Funnels · Operations & Hiring · Connection logs · Offline daemon), matching the shipped Accounts + Studio pattern (page shell + `_surfaces/*` + `?tab=`). Each page body was re-homed byte-identical into `app-performance/_surfaces/<tab>-surface.tsx` (its `actions`/`_components` stay put; relative imports rewritten to absolute). The seven non-cockpit legacy routes (`/admin/growth`, `/admin/intelligence`, `/admin/seo`, `/admin/funnels`, `/admin/operations-hiring`, `/admin/connection-logs`, `/admin/offline`) are now param-forwarding redirects into the studio. The App Performance menu parent already landed on `/admin/app-performance`, so it now opens the Overview tab.

- Sidebar items repointed to `?tab=<key>`, `matchPrefix` kept on each legacy path so deep-links/detail routes still light the row.
- Mobile Insights landing (`/admin/insights`) card hrefs repointed to the studio tabs so mobile matches desktop (it stays — it's the bottom-nav Insights-tab landing with the peso-per-lead + won/lost scorecards, NOT a duplicate cockpit as first assumed).
- `connection-logs` actions' `revalidatePath` repointed from the redirect stub to `/admin/app-performance` (the live surface).
- Bottom-nav Performance tab already umbrella-matched `/admin/app-performance` — unchanged.

Net: the App Performance menu goes from 8 separate full-page loads to one tabbed surface; no data/query changes.

**Remaining (owner picked all four):** Catalog Studio (Money pricing pages) · Settings studio (Money's settings tail) · Ugat tabbed studio — same pattern, follow-up PRs.

SPEC IMPACT: DECISION_LOG.md row appended (2026-07-10) — admin console studio-consolidation program continues (App Performance → Insights Studio); no product-surface/catalog change.
