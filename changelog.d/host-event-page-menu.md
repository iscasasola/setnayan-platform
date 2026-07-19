## 2026-06-26 · feat(customer-nav): host menu entry to view the live event page

Owner ask 2026-06-26 — *"Host should get on their menu to see the same event
page that we created."* The couple could previously only reach their public
`/[slug]` page indirectly (a "View your page" link buried in the Save-the-Date
launcher). This adds a first-class **"Event page"** entry under the customer
**Studio** menu — on both the mobile docked sub-nav and the desktop sidebar —
that opens the same page their guests see.

- New couple-gated route `app/dashboard/[eventId]/event-page/page.tsx`: resolves
  the event slug (replicating the `event_members` couple-membership check, same
  pattern as `website/page.tsx`) and **redirects to the live `/[slug]`** (same
  origin, relative). The signed-in host passes the slug page's private gate
  (`isAuthedHost`) and sees the real event page — hero · monogram ·
  Save-the-Date film · story · schedule · widgets. No slug yet → redirects to
  the Website hub instead of 404.
- Menu wiring: a `route` child `event-page` (icon `Eye`) added to the Studio
  menu in `lib/customer-menu.ts` (mobile docked sub-nav) and a Studio child in
  `customer-nav-config.ts` (desktop sidebar), with the sidebar child slot mapped
  in `customer-sidebar.tsx`.
- Nav registry: registered two slot defaults in `lib/nav-registry-defaults.ts`
  — `customer.sidebar.event-page` + `customer.studio-subnav.event-page` (both
  `Eye`, admin-editable via `/admin/menus`). nav-icon-source + bottom-nav lints
  and the nav-registry-defaults unit test pass.

Limitation (intentional): the host sees the event-page CONTENT, not the
per-guest `GuestHubBar` (My QR · Camera · Photos of you) — that bottom bar is
keyed to a guest identity (a `guests` row + guest-session cookie) the couple
doesn't have. Rendering it for a host was rejected as it would require
fabricating a guest identity and a large edit to the hot ~4000-line
`app/[slug]/page.tsx` (left untouched).

SPEC IMPACT: None (UI/nav-only; redirect to existing public surface; no schema,
SKU, or pricing change).
