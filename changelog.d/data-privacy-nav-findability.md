## 2026-07-16 · fix(admin): surface Data Privacy in the mobile Overview tab match set

The `/admin/data-privacy` board (PR #3309) renders in the desktop sidebar via the fails-open path (like `corrections`/`integrity-watch`, which carry no nav-registry entry), and under mobile "More" (the 6-menu landing from ADMIN_NAV_GROUPS). This adds its route to the mobile bottom-nav Overview active-match set so the Overview tab highlights when you're on the page. The page itself was already live + reachable at `/admin/data-privacy`.

SPEC IMPACT: None.
