## 2026-07-04 · fix(nav): sidebar active-state is query-aware (?tab=) for studio menus

- The shared SidebarItem matcher now lights an item whose href carries a query string (e.g. /admin/accounts?tab=users) when the current pathname AND that query param match — so the Accounts Studio tabs light the correct sidebar sub-item without double-lighting siblings. Plain-href and matchPrefix behavior unchanged (no regression to any doorway). Unblocks the Accounts Studio consolidation's sidebar lit-state.

SPEC IMPACT: None.
