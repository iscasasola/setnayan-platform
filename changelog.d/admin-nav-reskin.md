## 2026-06-28 · feat(admin-nav): live queue-count badges on the Work nav + one shared count source (+ sidebar re-skin)

Headline: the always-on admin nav now shows **live open-work counts** so the
95%-of-sessions "is there work in this queue?" question is answered *without
opening the page*. Plus a vocabulary re-skin of the same nav surface.

### Live queue-count badges (the throughput win)
- New `lib/admin/queue-counts.ts` → `getAdminQueueCounts()`: the **single source of truth** for every Work queue's open count (keyed by nav-item key). The same head-count `Promise.all` had been copy-pasted **three times** (`/admin/work`, `/admin` overview, per-page) and had **already drifted once** (verify counted `coming_soon` vs `pending_review`); this consolidates it.
- `app/admin/layout.tsx` fetches counts (parallel with nav slots, **fails open to `{}`** — a count error never blanks the chrome) and passes them to both nav surfaces.
- `admin-sidebar.tsx`: each Work item badges its count — **red** for SLA-critical queues (disputes · force-majeure · account-deletions · approvals · user-reports), **amber** otherwise. Uses the already-shipped `NavBadge` → `<Badge>` render path (no new UI).
- `admin-bottom-nav.tsx`: the mobile **Work** tab badges the **sum** of all queue counts.
- `app/admin/work/page.tsx` refactored to consume the helper — **net code reduction** (~75 lines of duplicated query deleted).

### Vocabulary re-skin (secondary)
Keeps the owner-signed-off **verb axis** (act/find/tune, `Admin_Console_Nav_Redesign_2026-06-08.md`) — does **not** flip to topic-grouping — and **drops zero surfaces** / changes **zero URLs**.

- **Desktop sidebar** (`app/admin/_components/admin-sidebar.tsx`):
  - `Money & Catalog` → **Monetization** (key `money` preserved for localStorage continuity).
  - The 21-item **Platform** mega-group split into three scannable collapsibles:
    - **Data Structure** (key `content` kept — Platform's successor): Menus & icons · Taxonomy · Event Types · Refinements · Onboarding · Wedding types · Wedding traditions · AI brain.
    - **Content & Media** (new key `media`): Website · Hero video · Same-Day Edit · Reveal Studio · Real Stories · Recaps · Patiktok · Songs · Moodboard library.
    - **Settings** (new key `settings-group`): Settings · Notifications · Demo mode · My account.
  - Spine (Home · Work · Directory) and Insights unchanged.
- **Mobile parity** (`app/admin/more/page.tsx`, `app/admin/money/page.tsx`, `app/admin/_components/admin-bottom-nav.tsx`): the `/admin/more` overflow re-split into the same Data Structure / Content & Media / Settings sections; `/admin/money` landing relabelled to Monetization; bottom-nav route-matching unchanged (matches on routes, not group labels). Pre-existing mobile subset gap (menus · refinements · hero-video · sde · reveal-studio · recaps · patiktok are desktop-only) is preserved and documented, not introduced here.
- No registry-defaults change: groups are code-structure, not registry slots; every item `key` is unchanged so the `admin.sidebar.<key>` / `admin.bottom-nav.<key>` overlays and the `/admin/menus` editor are unaffected. `lint-nav-icon-source` + `lint-bottom-nav` guards pass.

SPEC IMPACT: None. Implementation-only nav relabel/regroup; no SKU, schema, price, or scope change. Verb-axis decision (2026-06-08) is respected, not overridden. Logged in `DECISION_LOG.md` for lineage.
