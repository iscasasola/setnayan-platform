## 2026-11-13 · feat(admin): Work › All is the one Needs-action list — the old Exception desk goes (slice 1b)

Owner, on live `/admin` under the new five-tab bar: *"fix that. we do not want the old page"*. `/admin` now renders
the shipped work list itself (the same component as `/admin/work`) — the drawing's Work › All
(`prototypes/admin_five_tabs_2026-11-13/work.html`). Gone from Work: the Secrets & Rotation / Integrations pills, the
dark Exception desk (count · past SLA · ring · top-3 · "Open the work list" · "Platform upgrades"), the lane tiles,
"More queues", the KPI strip, What you change, Recent admin activity and the directory tiles.

- The list gains the drawing's **Next card** (the #1 ranked queue with its own Open) and a calm **"Nothing needs
  you"**; lane chips print "—" over an unread queue instead of a sum that leaves it out ("All 0").
- **Also waiting**: the Apple-secret reminder and the email-delivery strip ride the list's lead (both addresses).
- **Insights › Overview** now carries Standing totals, What you change and Recent admin activity (moved verbatim,
  `app-performance/_surfaces/admin-totals-surface.tsx`).
- Secrets & Integrations live under the avatar (`ADMIN_AVATAR_ROWS` › "Secrets & integrations"); both URLs answer.
- `/dev/admin-shell-lab?at=/admin` draws the real list on fixtures (busy · `counts=empty` · `counts=fail`).
- Guard: `app/admin/work-all-is-the-one-list.test.ts`. Retired with their subject: `the-overview-shows-what-it-counts`
  (BASE_ROWS coverage is pinned by `lib/admin/work-rows.test.ts`) and `a-tile-with-work-looks-like-work`
  (`ActionQueueTile` no longer exists).

SPEC IMPACT: None — implements DECISION_LOG 2026-11-13 "ADMIN WORK PAGE — THE OLD EXCEPTION DESK GOES".
