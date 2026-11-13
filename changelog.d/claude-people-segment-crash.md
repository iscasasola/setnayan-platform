## 2026-11-13 · fix(people): the People page no longer crashes after a partner confirms

Live fault: the owner tapped the `connection_confirmed` notice "They confirmed — they’re your Partner" on Home and
landed on the global crash screen (Problems log: PAGE_CRASH · crash global · /dashboard · build b1bbbf8a07,
`TypeError: undefined is not an object`, Safari). The server render of `/dashboard?seg=people` returned 200 with no
error logged, and every People read already degrades to an honest line — the fault is above the page's error
boundary, at the tap itself.

- `markNotificationRead` / `markAllNotificationsRead` revalidated `return_to` verbatim — `/dashboard?seg=people`, a
  query, not a path — and then redirected to the page the person was already on. They now revalidate the path
  (`lib/notification-return.ts` · `revalidationPathOf`) and still redirect to the full address.
- `confirmLabel`'s notice title falls back to the confirmer's account name (`users.display_name`) when the person
  node has none, and says "Your partner confirmed" when neither does — never "They confirmed"
  (`labelConfirmedTitle` in `lib/people-label-handshake.ts`).
- Held by `lib/a-confirmed-notice-names-who-confirmed.test.ts`.

SPEC IMPACT: None
