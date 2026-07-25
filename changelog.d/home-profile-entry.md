## 2026-07-13 · fix(launcher): give the account profile a visible door on the home hub

Owner report: "I cannot find where to place the profile account information — it
should be here [the `/dashboard` launcher], not in an event."

Diagnosis: the account-level profile page (`/dashboard/profile` — personal info ·
security · notifications · privacy · account deletion) already exists and is
correctly account-scoped (the `(account)` group, NOT under `[eventId]`). It was
just orphaned from the launcher: the `YOUR ACCOUNT` row had no Profile tile, and
the top-bar account menu's "Profile · Settings" footer link was dropped on
2026-07-10 when the switcher panel was slimmed to a home-hub jump — and never
replaced. Every remaining link into `/dashboard/profile` was buried inside other
pages (Memories Hub, privacy page, admin nav), so from the home screen a user
could not reach their own account info at all.

Restored two entry points:

- `app/dashboard/(launcher)/page.tsx` — new **Profile & account** `AccountTile`
  (→ `/dashboard/profile`, `UserRound` glyph) leading the `YOUR ACCOUNT` row.
  Grid widened `sm:grid-cols-2 lg:grid-cols-4` to seat the 4th tile cleanly.
- `app/_components/account-switcher/account-switcher.tsx` — restored a
  **Profile & settings** link in the shared `SwitcherPanelBody` footer (covers
  both the desktop drawer and the mobile bottom sheet), pushed left with Sign out
  kept apart on the right. Fixed the two stale docstrings that still claimed the
  footer carried Profile/Settings after the 2026-07-10 slim removed it.

Presentational only — no schema, route, action, or data change; the destination
page is unchanged.

SPEC IMPACT: None (navigation/discoverability fix; the profile surface itself is
already specced in 0025_profile_settings and unchanged).

## 2026-07-13 · fix(account-chrome): retire the old `(account)` sidebar for the launcher paradigm

Owner follow-up: tapping the new Profile tile "goes to a user-home with a side
bar. again. an old menu … not [designed for] the … user home." The launcher at
`/dashboard` is the home (owner 2026-07-09 "we do not want side bar and menu bars
here"), but every account SPOKE still wrapped itself in the old universal
`SidebarShell` (owner 2026-06-20), resurrecting the retired user-home left rail
each time you opened Profile / People / Memories Hub / etc.

- `app/dashboard/(account)/layout.tsx` — rewritten to render the SAME slim
  chrome-less top bar as `(launcher)/layout.tsx` (Wordmark → home · notifications
  bell · account menu) instead of `SidebarShell` + `AccountSidebar` +
  `DoorwaySidebarHeader` + `AccountMobileNav`. Removes the sidebar from ALL
  account surfaces at once. Every spoke page already carries its own `mx-auto
  max-w-* px-*` container, so content self-centers under the top bar.
- `app/dashboard/(account)/people/page.tsx` + `.../setnayan-ai/page.tsx` — added
  a "Back to home" link (matching the pattern the other spokes already had), the
  only two account pages that lacked one, so hub-and-spoke return nav is
  self-contained without the sidebar.
- `app/dashboard/(launcher)/layout.tsx` — corrected the now-stale docstring that
  claimed account surfaces "keep the `(account)` sidebar".

The account nav cluster (`account-sidebar.tsx` · `account-mobile-nav.tsx` ·
`account-nav-config.ts`) is now orphaned but LEFT IN PLACE — `scripts/
lint-nav-icon-source.mjs` scans it, so its deletion is a separate follow-up.
Presentational/navigation only — no schema, route, or data change. Typecheck clean.

SPEC IMPACT: None (chrome/navigation consistency; no SKU, schema, or pricing change).
