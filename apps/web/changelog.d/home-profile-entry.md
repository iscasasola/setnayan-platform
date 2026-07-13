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
