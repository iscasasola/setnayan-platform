## 2026-06-28 · fix(nav): make "Launch" a top-level sidebar item (it was an invisible Studio child)

The "Launch" surface shipped as a child under **Studio**, but the desktop
sidebar **auto-collapses a parent's children unless the active route is inside
that section** (see `sidebar-item.tsx` docstring). So from Home / Guests / etc.
the item was invisible — couples never saw it. Owner reported it as "not there".

Fix: promote "Launch" to a **top-level, always-visible** sidebar entry (after
Studio, before Budget) in `buildCustomerNavGroups`, still gated on the profile
`website` surface (`websiteEnabled`). Moved its slot key from `CHILD_SLOT_KEYS`
to `SIDEBAR_SLOT_KEYS`. The mobile bottom nav stays at its locked 5 tabs — mobile
still reaches Launch via the Studio section sub-nav child.

SPEC IMPACT: 0021 (couple dashboard nav) — "Launch" is now a top-level sidebar
destination, not a Studio sub-item. No schema/pricing change.
