## 2026-06-28 · refactor(admin-nav): re-skin admin sidebar to Operations / App-Engine / Settings vocabulary

Vocabulary re-skin of the admin doorway nav — **keeps the owner-signed-off
verb axis** (act / find / tune from `Admin_Console_Nav_Redesign_2026-06-08.md`),
does **not** flip to topic-grouping, and **drops zero surfaces** / changes
**zero URLs**. Frequency-first + system-last + collapsible were already in place;
this pass adopts clearer naming and breaks up an overstuffed group.

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
