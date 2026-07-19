## 2026-07-15 · fix(nav): wayfinding — 5 orphaned live surfaces get real doorways

Executes the Route Wayfinding Audit (2026-07-15): 5 shipped, reachable-only-by-URL pages get a real in-app doorway, and 3 stale reachability comments are corrected so the docs stop drifting. No behaviour change beyond the added links.

- **`/admin/integrations`** — new `Integrations` item in `ADMIN_NAV_GROUPS` Money-group settings tail (beside Compliance · Notifications · Demo-mode) in `app/admin/_components/admin-nav-groups.tsx`. Standalone idiom (plain `matchPrefix`, like `/admin/papic-storage`), `Plug` icon. Was reachable only from a tile on the `/admin` dashboard.
- **`/explore/compare`** — the live 2-up compare tool (reads `?ids=<uuid>,<uuid>`) gets a `CompareShortlistBanner` door on `app/explore/page.tsx`, rendered in both catalog + vendor-grid modes when the couple has ≥2 saved vendors (links the two earliest saves). The stale `compare_v1_2` "coming in V1.2" notice copy is rewritten to point at the shipped tool.
- **`/dashboard/year`** — the launcher "This year" strip re-links to the full Year calendar via a "See the year →" row in `app/dashboard/(launcher)/_components/year-moments-list.tsx`. Restores the door dropped by the 2026-07-13 de-link, per the owner's 2026-07-15 "nothing orphaned" directive. Strip + list de-link comments updated.
- **`/vendor-dashboard/website`** — "Open full website settings →" link added to the `/shop` Website manage-tile (`app/vendor-dashboard/shop/_components/website-editor.tsx`), the only in-app door to the standalone page's `DomainManager` (the vendor-bottom-nav reference was an `activeMatch` entry, not a link).
- **`/waitlist`** — "Join the waitlist" link added to the marketing footer Company column (`app/_components/marketing/reskin-footer.tsx`). IA-only; no marketing restyle. This makes the pre-existing `site-chrome.tsx` "footer links /waitlist" comment true.

Stale-comment corrections: `vendor-dashboard/track-record/page.tsx` ("/more landing + mobile nav" → the `/shop` More-tools card). The `event-qr/page.tsx` header ("event-home tiles grid" → `/guests/invite` link) was already corrected on `main` by PR #3249 — verified, no edit needed. `site-chrome.tsx`'s footer-links-/waitlist claim is now accurate post-fix.

Two DEAD routes (`…/studio/bundle`, `…/profile/concierge`) are deliberately NOT touched — deferred to the separate cleanup stream per the audit.

SPEC IMPACT: Route_Wayfinding_Audit_2026-07-15.md — the 5-placements section executed; audit is the design record, no corpus schema/SKU change.
