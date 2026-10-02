## 2026-10-02 · feat(ugat): Screens · Doors layer of the Ugat map (slice 1)

Owner, DECISION_LOG 2026-10-02 "ONE MAP OF THE APP" (+ "THE APP MAP STARTS FRIDAY", "THE UGAT MAP IS
ALSO THE APP'S OWN DEFINITION OF WHAT IT DOES"). Extends the Ugat map — never a fourth one — with every
host / guest / supplier / onboarding / public page, every in-app way in to each one (links, router
pushes, redirects, `routes.*` builders, the menu registry with phone vs desktop, email links, URL
helpers), and the entity-map node(s) it belongs to (from the tables its code reads, through the same
table → node binding concept-coverage uses).

- `apps/web/lib/ugat/scan-screens.ts` (scanner, modelled on `scan-admin-routes.ts`) →
  `apps/web/lib/ugat/screens.generated.json` (one screen per line, so sibling branches merge) via
  `pnpm --filter @setnayan/web ugat:screens`. `--report <file>` writes the owner's fix list.
- Admin › Set up › **Screens** tab (`/admin/ugat?tab=screens`, server component, no new route, no
  action, no client JS) with connected / no door / unmapped badges, grouped by area.
- CI: `node apps/web/scripts/check-ugat-screens.mjs` fails only when the committed map is stale and
  prints the counts. REPORT MODE: the ratchet against `lib/ugat/screens-no-door.baseline.txt` turns
  on in slice 2 (`RATCHET_ENFORCED`).
- First run: 328 screens · 266 connected · 24 no door · 38 legacy stubs · 33 unmapped · 1 door to
  nowhere (`lib/vendor-email-triggers.ts` → `/vendor-dashboard/settings/notifications`, no such page).
  Written to the corpus as `UGAT_MAP_FIRST_RUN_2026-10-02.md`.

SPEC IMPACT: None
