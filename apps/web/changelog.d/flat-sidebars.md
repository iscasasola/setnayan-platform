## 2026-07-15 · fix(nav): flatten all desktop sidebars — solid menus, no submenus (owner directive)

Owner 2026-07-15 ("solid menu with no submenus"): every desktop sidebar is now a
flat list of top-level doorways — sub-navigation lives INSIDE pages (tab strips,
hub bodies, landings), never as expandable children in the rail. Extends the
vendor 5-page IA (2026-07-12, #3163) + the couple Overview/Guests plain-leaf
decision (2026-07-10) to the whole couple + admin rails.

- **Couple rail** (`customer-nav-config.ts`): dropped the Merkado item's 5 Build-tab
  children (Summary · Shortlist · Build · Compare · Lock — they live only in the
  `/vendors` page's own tab strip now) and the Studio item's 6 children (Event
  page · Website · Mood Board · Monogram · Live Wall · E-Gifts). Both are plain
  leaves. `/vendors?tab=*` still lights Merkado (query-less prefix match). PLAN /
  GO LIVE section headings kept (flat groupings, not expandable parents).
- **Studio hub doorways** (`studio/page.tsx`): Mood Board / Monogram / Website stay
  reachable as App Store catalog rows; the three surfaces that are NOT catalog
  SKUs (Event page · Live Wall · E-Gifts) got an explicit "Set up & manage"
  doorway block on the hub so nothing orphans (E-Gifts had no other in-app door).
- **Admin rail** (`admin-sidebar-menu.tsx` + `admin-sidebar.tsx`): the six menus
  (Overview · Accounts · Studio · Ugat Console · App Performance · Money) render
  as plain doorways to their hub landings — no chevron, no inline children. Child
  routes still light their parent (active-state is computed across the group's
  items, since they live on disjoint path roots the hub matchPrefix can't cover —
  e.g. `/admin/pricing?tab=token-bands` lights Money) and the rolled-up queue
  badge still shows. Removed the `collapsedWhenActive` expand/toggle machinery.
  Every child destination stays reachable from its landing / tabbed studio /
  the `/admin/work` list.
- Shared `<SidebarItem>` child/tab mechanism is UNTOUCHED (no data feeds it now,
  but it's a shared primitive — data removed, mechanism left).

SPEC IMPACT: DECISION_LOG.md row appended (all desktop sidebars flat, no
expandable submenus; sub-nav in-page). Corpus `Route_Wayfinding_Audit_2026-07-15.md`
principle applied ("a page ships with its doorway or it doesn't ship").
