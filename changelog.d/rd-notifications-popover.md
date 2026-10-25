## 2026-10-25 · feat(notifications): the bell opens a pop-over; "View all" is the same calm rows

Owner, 25 Oct: *"shouldn't it be a pop up to see the notifications and an option to view all?"* · *"view all
notifications simpler"* · approving `Setnayan/prototypes/notifications_popover_2026-10-25/index.html`: *"Build it"*.

- **The bell** (`app/_components/unread-bell-badge.tsx`) is now a `<button aria-haspopup="dialog">`, not a link. It
  opens the account menu's own panel shape (`renderPanel()` in `account-switcher.tsx`): a card under the bell on
  desktop, the house bottom sheet with a drag handle on a phone, over `OverlayBackdrop` (a tap on the dark closes it)
  with `useModalA11y`. Inside: "Notifications" + a quiet gold "Mark all read" (hidden when nothing is unread), the
  latest 8 grouped Today / Earlier, and "View all ›" to the bell's `href` — one component for the couple, supplier and
  console bells. Rows are read when it opens, in the browser, through `fetchOwnNotifications` (limit 8); the count and
  its poll are unchanged. A refused read says "These did not load", never "You're all caught up". The list rides in its
  own chunk, fetched on the first press.
- **The row** (`app/_components/notifications/notifications-list.tsx`, now a client component): 38px icon circle ·
  bold title (two lines) · one truncated line · short time ("18h") · gold unread dot. The whole row is ONE submit
  button of one `markNotificationRead` form, returning to `related_url ?? this page`. The type pill, the per-row
  "Open" and "Mark read" buttons and the per-row frame are gone; the type's short name (RSVP · Message · Order ·
  Payment · Guest request · Added) is the icon's aria-label. Mark read alone: swipe left on a phone; ⋯ on hover on
  desktop (one-item menu).
- **The pages** (`dashboard/(account)/notifications/page.tsx`, `vendor-dashboard/notifications/notifications-view.tsx`):
  a visible "Notifications" title with the same quiet "Mark all read" (`NotificationsHead`). The supplier page's
  "Recent" line left (the rows carry Today / Earlier).
- `lib/notifications.ts`: `NOTIFICATION_TYPE_SHORT_LABEL` / `notificationShortLabel`, `NOTIFICATION_TYPE_ICON` /
  `notificationIcon`, `relativeTimeShort` (no " ago"), `isTodayNotice`. `NOTIFICATION_TYPE_TONE` stays — the console's
  notifications surface still reads it.
- New lab `/dev/notifications-lab` (`?view=all` · `?empty=1` · `?fail=1`) draws the real bell and list on the
  prototype's sample notices; `LabShell` takes `notices` / `bellUnread`.
- Guards: `the-bell-opens-a-pop-over.test.ts` (bell is a dialog button · closes on the dark · View all present · a row
  is one press · no per-row Open/Mark read · a failed read is not "caught up"); `the-message-gets-the-whole-width.test.ts`
  re-anchored on the icon/message/time row. `slim-phone-top-bar.spec.ts` finds the bell as a button.

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — 2026-10-25 row "THE BELL OPENS A POP-OVER; VIEW ALL IS THE SAME CALM ROWS"
(the owner's words + the approved prototype).
