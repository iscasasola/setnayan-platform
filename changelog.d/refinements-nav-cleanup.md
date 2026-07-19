## 2026-07-03 · chore(admin): remove redundant Refinements admin nav entry

The `/admin/refinements` route was retired to a `redirect('/admin/taxonomy')` in
the Taxonomy Studio program — refinements are now edited inside the Taxonomy
Studio inspector's Refinements tab. The dedicated "Refinements" admin nav item
just bounced through that redirect, so it is removed:

- `app/admin/_components/admin-sidebar.tsx` — dropped the `refinements` sidebar
  item (and its now-orphaned `SlidersHorizontal` import).
- `app/admin/_components/admin-bottom-nav.tsx` — dropped `/admin/refinements`
  from the admin bottom-nav route list.
- `lib/nav-registry-defaults.ts` — removed the `admin.sidebar.refinements` seed
  default (stops seeding into `/admin/menus`). A stale `nav_slot_override` DB row
  for this key is inert: `lib/nav-registry.ts` iterates code defaults and overlays
  overrides, so an override with no matching default is never rendered — no
  migration needed.
- `lib/routes.ts` + `lib/route-meta.ts` — removed the now-unused `refinements`
  route helper + its route-meta sibling (kept 1:1 mirror), plus the orphaned
  `SlidersHorizontal` import in route-meta.
- `app/admin/onboarding/page.tsx` — repointed the "Refinements" cross-link to
  `/admin/taxonomy` ("Now in the Taxonomy Studio").
- `app/admin/more/page.tsx` — updated the doc-comment desktop-only subset list.

The `app/admin/refinements/page.tsx` redirect stays for old bookmarks.

SPEC IMPACT: None
