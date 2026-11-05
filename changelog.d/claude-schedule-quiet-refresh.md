## 2026-11-05 · feat(offline): Home and the Event Hub quietly refresh the guest's saved schedule

Owner-approved 5 Nov, item 1 of the "Your schedule saved for no signal" follow-up. Home (`/dashboard`) and the Event
Hub's other tabs (`/<slug>`, every tab but Me) now ask the existing service worker to re-render the guest's saved
"Your schedule" copy (Event Hub › Me, `/<slug>?tab=me`) in the background — at most every 30 minutes (the worker's own
`AUTO_REFRESH_AFTER_MS`, plus a per-browser last-try stamp so a failing server is not asked on every open), and only
around event days (`offlineSavingOpen`: T-3 days → the day after). Refresh-only: a copy the same viewer already saved
on Me; never a first save, so it can never wipe another person's copies on a shared phone. Draws nothing — the
freshness line (incl. amber "No signal · showing the copy from …") stays on Me alone. No live connection, no email,
no migration, no new saving mechanism (`OFFLINE_SAVE`, not forced). Item 2 unchanged.

Files: `lib/quiet-schedule-refresh.ts` (+ `.test.ts`), `app/_components/offline-ready/quiet-schedule-refresh.tsx`,
`app/[slug]/page.tsx`, `app/dashboard/(launcher)/page.tsx`, `use-offline-copy.ts` (exports its helpers).

SPEC IMPACT: None (implements an owner-approved item; no new decision).

**Owner, 5 Nov 2026 — "Yes to both":** Home and the Hub also save the FIRST copy for a guest who never opened Me — but
only when the phone keeps no unexpired copy of another viewer's (`holdsAnotherViewersCopies`; unreadable counts as
"keeps"), so a quiet save never erases somebody else's copies on a shared phone. Same 30-minute try ceiling, same
event-day window, at most four events. Cost: one background page render per such guest, then at most one every 30 min.
