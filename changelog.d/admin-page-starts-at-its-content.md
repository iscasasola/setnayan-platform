## 2026-08-24 · refactor(admin): the admin console stops drawing its own page-name row (1/4)

The app-wide "a page starts at its content" sweep (owner-locked 2026-08-21, PR #4664 + #4669)
reached 133 files — but only the ones that were already `PageMasthead` call sites. A page that
hand-rolled `<header><h1>Title</h1><p>lede</p></header>` was invisible to it. Measured on
`origin/main` @ `c65c64e77`: **54 files under `app/admin` still draw a visible `<h1>`**, in eight
different type treatments, two of them painting a hardcoded hex.

This is the first of four PRs. It lands the guard (bill of 50, can only shrink) and converts:

- `_components/mobile-landing-grid.tsx` — the renderer behind `/admin/more`, `/admin/directory`
  and `/admin/money`. It drew **all three retired rungs at once**: a mono "Admin" eyebrow, a 30px
  name, and a subtitle. The `subtitle` prop is removed along with its three call sites.
- `connection-logs/connection-logs-client.tsx` — the tab strip already named the surface. One
  sentence of the lede was load-bearing (the resolve convention) and moved down beside the tabs it
  governs, per rung four.
- `studio/_surfaces/moodboard-library-surface.tsx` — its **error branch** kept the old row while
  the success branch was ported months ago, so the page drew a different heading depending on
  which way the read went.
- `_components/mobile-landing-accordion.tsx` — **deleted.** Built 2026-06-08 to replace the flat
  grid, never mounted, zero importers for eleven weeks, superseded when the grid itself gained
  grouping, search and a desktop width. It carried its own copy of the retired header row.

⚠ The same debt exists in 65 more files under `app/dashboard` and `app/vendor-dashboard`. Out of
this session's territory and named in the guard so a green admin run is not read as "the app is
done".

SPEC IMPACT: None.
