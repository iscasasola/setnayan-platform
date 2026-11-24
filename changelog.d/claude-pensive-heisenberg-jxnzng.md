## 2026-11-24 · perf(shell): the bell counts beside the reminders, and the public shell starts its cluster early

Speed audit batch L1 (`build-sessions/SPEED-AUDIT-2026-11-24.md`, the signed-in shell). No screen changes.

- **The bell's count no longer waits for the reminder delivery.** Every signed-in shell (`getDashboardShell`: the event
  pages, the account pages, the hub, the public pages' bell) ran the due-reminder delivery, then the unread count:
  two trips in a row on every open. `unreadCountWithDueReminders` (`lib/chat-reminders.server.ts`) starts the count
  beside the delivery. When nothing was due (the normal open) that count is exact; when a reminder was told, the count
  is asked again after the notices (uncached), so the bell still includes them.
- **Due reminders are told together.** Each reminder's link read and in-app notice used to run one after another
  (two trips per reminder, inside the render). They now run side by side; one failed notice is logged, not counted,
  and does not stop the rest. The read-before-claim order is unchanged.
- **The public shell starts the bell and account switcher with its own reads.** `app/(shell)/layout.tsx` calls
  `preloadSignedInCluster()` (signed-in visitors only), so `SignedInCluster`, drawn after the rail's reads, finds its
  per-request `cache()` reads already on their way. #8278's preload pattern.
- Guard: `lib/the-bell-counts-beside-the-reminders.test.ts` (behaviour + order; five sabotages seen red).
  `lib/a-chat-reminder-stays-in-the-app.test.ts` now also accepts the one-round helper.

SPEC IMPACT: None. Speed only: the same reads, the same bell, the same reminders. One extra count read happens only on
an open that tells a reminder.
