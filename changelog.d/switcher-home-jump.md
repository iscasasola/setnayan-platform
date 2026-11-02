## 2026-07-10 · refactor(account-switcher): slim panel to a home-hub jump

The account switcher no longer re-lists every event, add-event, and Collection —
all of which the home hub already shows. The panel is now a slim account menu:

- **Home** — full-width primary action that jumps to `/dashboard` (the home hub).
- **Console rail** — kept for vendor / Setnayan-team accounts only, now offering
  just **Shop / HQ** (Home covers the former "User" tile).
- **Footer** — **Sign out** set apart at the bottom (red, no confirm), plus Hosts
  (co-hosting) and "Secure your plan" (anonymous) as before.

Both the mobile bottom-sheet and desktop drawer now share one `SwitcherPanelBody`
so they can't drift. Removed the events list, per-event monogram/role badges, the
Collection row, and the now-unused imports (`Plus`, `LayoutGrid`, `User`,
`EventMonogram`, `formatEventDate`).

SPEC IMPACT: None — presentational refactor; the switcher's destinations
(`/dashboard`, `/vendor-dashboard`, `/admin`, sign-out) are unchanged, only the
in-panel event list was removed since the home hub is now the canonical events
surface.
