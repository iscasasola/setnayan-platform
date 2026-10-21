## 2026-10-21 · perf(realtime): a live socket only where something is live

The unread bell and the Messages envelope are drawn by every signed-in layout, and each held a Supabase Realtime
`postgres_changes` channel — so every plain page (a guest list, a budget, a settings form) held a websocket open all
day, in every tab, and the database evaluated every notification and every chat message for each of them.

- **Bell + envelope** re-ask their count on a one-minute timer while the tab is in view, and at once when the person
  comes back to the tab (`startCountPoll`, `lib/tab-return.ts`). A hidden tab asks nothing. The bell still refreshes an
  open page when a "made a host" / "invited" notice arrives (owner 2026-09-28) — it checks when its count goes up.
- **A failed read changes nothing.** The re-reads used `countUnread` / `countUnreadMessages`, which answer 0 on a
  refused read — a refused read wiped a real count (measured in the lab: seeded 2 and 3, drawn as nothing within a
  second). New `readUnreadNotificationCount` / `readUnreadMessageThreads` answer `null` for "could not read", and the
  poll never draws it.
- **Budget** re-reads when the tab is looked at again (`onTabReturn`) instead of holding a channel on two tables.
- **Live surfaces keep their channels.** The chat thread, the run-of-show header, the day-of announcement, the
  supplier's payments-to-confirm and the view-only seat plan let theirs go after 30 s hidden and open again (which
  re-reads) on return (`pauseWhileHidden`); the socket itself closes ~50 s later (realtime-js's empty-socket grace). Calls, Panood, the wall, presence and the demos are unchanged.
- The thread call launcher opens no channel when calling is locked (it draws no incoming banner then); the home page's
  Papic demo closes its channel when the overlay closes.
- `lib/settle-burst.ts` retired (its only caller is gone; a timer asks once a minute whatever lands).
- Guards: `lib/a-socket-only-where-something-is-live.test.ts` (census of every file that opens a channel; nothing a
  layout draws reaches one except three gated cases; one browser client per tab), `lib/tab-return.test.ts`.
- `/dev/*` labs: the lab shell's bar carries the real badges, so a plain page's sockets can be measured without a
  sign-in.

SPEC IMPACT: None — no product decision changes; the bell/envelope/budget stay current (within a minute in view, at
once on return) without a socket.
