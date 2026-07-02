## 2026-07-02 · feat(vendor): My Shop — Profile tile expands inline

The Profile tile on `/vendor-dashboard/shop` "Manage your shop" grid now expands
INLINE like Website / Team / Branch, instead of being the lone tile that
navigated out to `/vendor-dashboard/profile`. Reverses the 2026-07 "only Profile
navigates" rule (PR #2576) at the owner's request — all four Manage tiles are now
symmetric collapsibles, one open at a time.

- `app/vendor-dashboard/shop/_components/manage-tiles.tsx` — Profile is now a
  `ToolTile` (chevron + `aria-expanded`) driving a `'profile'` key in the shared
  one-open-at-a-time state; removed the `<Link>`/`ArrowRight` navigate-out block.
  Added an opt-in `subEmphasis` flag to `ToolTile` so the "1 doc to verify" /
  "Documents in" status keeps its orange treatment as a tile sub-line.
- `app/vendor-dashboard/shop/page.tsx` — new server-rendered `ProfilePanel`
  (handed to `ManageTiles` as `profilePanel`, matching the existing panel
  pattern). Shows the live `businessProfileChecklist` (verified badge + "X of Y
  complete · N%"), each item as done ✓ or a "Add →" deep-link to its fix surface
  (`/vendor-dashboard/profile` or `/vendor-dashboard/verify`), plus "Edit
  profile" / "Verify documents" CTAs. `ShopData` now carries `checklist`.

No schema, RLS, route, or data changes — the profile edit + document-verify pages
are unchanged and still reachable from the inline panel's links.

SPEC IMPACT: Reverses the PR #2576 "only-Profile-navigates" My-Shop-rework rule.
Logged at the bottom of `DECISION_LOG.md`; corpus is archive/decision-history
(code is canonical per the 2026-06-07 source-of-truth flip).
