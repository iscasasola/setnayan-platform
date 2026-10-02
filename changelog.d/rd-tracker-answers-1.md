## 2026-10-02 · feat(tracker): the owner's tracker answers d1 · d2 · d4 · d5 · d9 · d11

Owner answers on the change-tracker's "Decide" page (DECISION_LOG row "OWNER
ANSWERS ON THE TRACKER'S 'DECIDE' PAGE (d1–d11"), built:

- **d1 — the full-page More Services is gone; the More menu is the one place.**
  `/dashboard/[eventId]/suite` and the `/studio` index (which had redirected to
  it) are deleted, with their only-used components. The menu's address is Home
  with `?more=services` (`studioHubHref`): the phone opens the More sheet on it,
  the rail opens the More Services row on it. The two old paths forward 308
  through `lib/legacy-redirects.ts` (the middleware map, same shape as #6265).
  Every hand-typed "Back to services" link and card now goes through
  `studioHubHref`. A service with no door (a day-of service after the day, not
  bought) is no longer listed in the menu. Thank-You Video and Playlist — parts
  drawn under their cards on the old page — now sit on the Papic and Music
  Maker pages (`ServiceParts`).
- **d2 — "Live Studio" → "Live Watch" in the catalogues, names only.** Migration
  `20271260381748` (prod: one description still said Live Studio; titles were
  already renamed in Admin). A db test snapshots every other column before and
  after.
- **d4 — "Plan it myself" in Your info › Your event**, for every host, free. It
  writes `events.planning_mode` through `setPlanningMode` — the same store and
  action the Setnayan AI page uses. The suppliers page stops ignoring it.
- **d5 — the credit warning shows on Today.** The 7-day email + tray notice
  already shipped (`maybeSweepVendorCreditWarnings`, once per term); Today now
  draws the same warning, same rule, same words, while the window is open.
- **d9 — inner-radius free transport is enforced on quotes by default.**
  `NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED` was never set in production, so
  the enforcer was dark; it is now armed unless set to 0/false/off.
- **d11 — a reminder email 3 days before the 30-day draft delete**, once per
  draft (`app_metadata`), to the first real email the draft holds; a draft with
  no email is skipped and logged (every live draft today).

SPEC IMPACT: None — the controller already logged the rows.
