# Changelog fragment — claude/ugat-console-slice1

## 2026-07-19 · feat(admin): Ugat Console live entity map (slice 1) at /admin/ugat/map

- New admin surface: the Ugat entity map — the nine platform entity types as
  live-counted nodes on a dark canvas, the schema-audited connections between
  them as clickable edges/joints, and the 2026-07-05 audit's health findings as
  an overlay (labelled static; live telemetry is slice 2). Paginated live entity
  tables (guests aggregate-only, threads without message bodies — off-limits
  locks in the queries), ⌘K omnibox with live server search + three saved
  questions, cross-links to /admin/taxonomy, vendor admin pages, and the
  payments queue.
- MOUNT (merge-conflict adaptation, 2026-07-19): originally built at
  /admin/ugat (PR #2788, 2026-07-04); while the PR was open, main took that
  path for the Ugat Studio (the tabbed config shell, 2026-07-10). The console
  now lives at the standalone sub-route **/admin/ugat/map**, linked from the
  Ugat Studio's section strip ("Entity map") — standalone because it is a
  full-viewport dark-canvas app with its own topbar + fixed side-card overlays,
  the same linked-out treatment the studio pattern gives detail sub-routes.
- Adapted to main's gates: the page calls the shared `requireAdmin()`
  (council fix #1 — layout ≠ auth boundary) in front of its service-role reads;
  the server actions use the shared `requireAdminAction()` instead of the PR's
  local hand-rolled copy.
- Nav: "Entity map" item in the Ugat Console nav group (mobile landing card +
  active-state lighting; the flat desktop sidebar keeps its six doorways),
  `admin.sidebar.ugat` registry slot repointed to /admin/ugat/map, and a
  `routes.admin.ugatMap()` helper.

SPEC IMPACT: DECISION_LOG.md 2026-07-05 row said "#2788 = Ugat Console slice 1
LIVE at /admin/ugat" — the PR had not actually merged; it lands now at
/admin/ugat/map. Logged as a new DECISION_LOG.md row (corpus) per the relaxed
2026-07-02 sync mandate.
