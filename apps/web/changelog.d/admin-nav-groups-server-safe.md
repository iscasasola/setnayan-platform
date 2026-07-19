## 2026-07-12 · fix(admin): extract ADMIN_NAV_GROUPS to a server-safe module

Owner-reported production crash: `/admin/money` (and `/admin/more`,
`/admin/directory`, `/admin/studio`, `/admin/accounts`, `/admin/app-performance`)
threw `TypeError: groups.find is not a function`.

Root cause: `app/admin/_components/admin-sidebar.tsx` starts with `'use client'`
and exported the plain data array `ADMIN_NAV_GROUPS`. When a Server Component
imports a value from a `'use client'` module, React RSC replaces it with a
client-reference proxy — so server-side `ADMIN_NAV_GROUPS` was not a real array
and `.find()` threw.

Fix (pure move, no content change):
- New server-safe module `app/admin/_components/admin-nav-groups.tsx` (NO
  `'use client'`) now owns the `ADMIN_NAV_GROUPS: NavGroup[]` array plus its 62
  lucide-react icon imports (incl. the `Tag as TagIcon` alias) and the
  `NavGroup` type import.
- `admin-sidebar.tsx` re-imports `ADMIN_NAV_GROUPS` from the new module and
  drops 58 now-unused icon imports (6 icons — Home/Activity/Banknote/Users/
  Clapperboard/Network — stay; still used by the sidebar's own code).
- The three Server Component landings that import the array
  (`admin/money`, `admin/directory`, `admin/more` page.tsx) now import it from
  `../_components/admin-nav-groups` instead of the `'use client'` sidebar.

Verified: `tsc --noEmit` (no new errors) + `next lint` clean; all six admin
landings return HTTP 200 on the dev server (were crashing).

SPEC IMPACT: None.
