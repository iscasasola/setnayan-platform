## 2026-10-28 · feat(admin): every admin route mapped to its tab — the five-tab admin's first step

The owner approved the five-tab admin on 2026-10-28 (DECISION_LOG "ADMIN DESIGN APPROVED — FIVE TABS, EACH ONE PAGE"). That decision names its first build step: a reviewed map of every admin route → tab, with redirect stubs marked, plus a CI guard. This PR adds both and changes no navigation and no screen.

- `apps/web/lib/admin-tabs.ts` — `ADMIN_TAB_MAP`: all 107 `app/admin/**/page.tsx` routes (dynamic detail pages included) → work · money · people · catalogue · insights · avatar · retire. The 36 redirect stubs carry `stubTo` with the exact address the file forwards to. `/admin/more` and `/admin/directory` are `retire: 'later'`; they keep working until the five tabs replace them.
- `apps/web/lib/every-admin-page-has-a-tab.test.ts` — reads the tree from disk and fails on: a page with no entry · an entry naming no page · a stub not marked as one (or marked with the wrong target, or a rendering page marked as a stub) · a stub whose target is missing or is itself a stub. Stub detection reuses `lib/admin-map/scan-admin-routes.ts` (`redirectTargetIn`, `rendersJsx`), so the repo keeps one definition of a stub. Sabotaged: an unmapped page goes red, and so does mapping a page that does not exist.
- Changed from the planning chat's first guess: `pakanta` Catalogue → Work (it is the songwriting and delivery queue for paid orders). `connection-logs` People → Insights (it is the "Problems" tab of App performance). The added routes are placed by what they hold; see each `note`.

SPEC IMPACT: None. The DECISION_LOG row already records this step; the map is now the record of where each route goes.
