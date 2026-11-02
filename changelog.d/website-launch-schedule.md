## 2026-06-28 · feat(website): scheduled launch + launch-now for the couple's site, plus phase-preview polish

Couples can now "align when the website will launch" and step through a clearer
preview of each part — owner ask 2026-06-28.

**Scheduled / launch-now go-live**

- New `events.scheduled_launch_at timestamptz` (migration `20270308199698`). NULL
  = no schedule; cleared the moment the page goes public.
- **Cron-free** by design (project lock: no polling crons). The public `/[slug]`
  gate evaluates the schedule at READ TIME: a still-private page whose
  `scheduled_launch_at <= now()` renders as public for that request, and a
  deferred `after()` task persists the flip (visibility → `public`,
  `std_launched_at` stamped, schedule cleared) + fans out the Save-the-Date
  emails (idempotent per `guests.std_sent_at`). So visibility is exact at the
  scheduled instant; the DB write-through + email push land on the first load
  past it. Shared `lib/launch-save-the-date.ts` (`isScheduledLaunchDue` /
  `resolveEffectiveVisibility` / `publishSaveTheDate`) keeps the manual launch
  and the scheduled auto-launch from drifting, and is used by both
  `generateMetadata` (robots/index) and the page body.
- New host-gated actions in `studio/save-the-date/actions.ts`:
  `scheduleSaveTheDateLaunch` (Manila wall-clock pick → stored UTC; PH is fixed
  +08:00) and `cancelScheduledLaunch`. "Launch now" (`launchSaveTheDate`) now
  also clears any pending schedule.
- `launch-std-button.tsx` rebuilt as a state-aware launch panel: private →
  Launch now / Schedule for later · scheduled → countdown + change/cancel/launch-now
  · live → launched block. A read-only launch-status banner mirrors this on
  Website → Privacy (controls stay single-sourced in the Save-the-Date studio).

**Phase-preview polish** (`site-editor.tsx`)

- Per-phase one-line captions ("what this is + when guests see it") under the
  Settings / RSVP / Event / Editorial tabs, and the same on the standalone phase
  editors.
- "Open … preview" link over the (pointer-events-none) preview iframe so couples
  can view any phase full-screen in a new tab (carries the host-gated `?phase=`).
- Deliberately did NOT re-add a device toggle — it was previously removed here as
  a "review-only prototype affordance" (code note at site-editor.tsx top);
  flagged for owner.

SPEC IMPACT: 0024 (Save-the-Date) + 0002 (invitation site) — launch is now
schedulable (cron-free read-time flip) in addition to launch-now; new
`events.scheduled_launch_at` column. Corpus notes applied to both iteration .md
files + a DECISION_LOG row.

## 2026-06-28 · feat(nav): "Launch" is now a first-class sidebar surface for every event

Owner follow-up 2026-06-28: launch + preview should be on the sidebar for ALL
users/events, not buried in the Save-the-Date studio.

- New route `/dashboard/[eventId]/website/launch` — a couple-gated surface that
  composes the launch panel (reuses `LaunchStdButton` so the scheduling control
  + `scheduled_launch_at` semantics never fork) with a standalone phase preview
  (Live / Invitation / Wedding-day / After tabs over a host-gated `?phase=`
  iframe + open-full-screen links). Plus "Edit your website" / "Who can view".
- Added "Launch" as a Studio child on BOTH nav SSOTs — desktop sidebar
  (`customer-nav-config.ts`) and mobile section sub-nav (`customer-menu.ts`) —
  with nav-registry default slots (`customer.sidebar.launch` /
  `customer.studio-subnav.launch`) so it's admin-editable from `/admin/menus`.
- **Event-type aware**: the item + the page are gated on the profile's `website`
  surface (`surfaceEnabled(profile,'website')`, threaded through `layout.tsx` →
  `CustomerSidebar` + `CustomerSectionSubnav`). Weddings show it; vendor-free
  Simple Events (no website surface) don't — defence-in-depth (nav hidden AND
  the page redirects).
- Website → Privacy launch-status banner now links to the new Launch surface.

SPEC IMPACT: 0021 (couple dashboard nav) + 0024/0002 — new couple-facing
"Launch" sidebar surface; nav-registry slots added. No schema/pricing change.
