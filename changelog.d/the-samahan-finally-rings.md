## 2026-08-25 · feat(samahan): the group can reach its own members — and three notices the database has been refusing

**The samahan was silent.** 61 files call `emitNotification` and not one of them was on the
samahan surface, so a member recorded a 3-second story that expires in 24 hours, or wrote in
Usapan, and nobody was told. A 24-hour feed nobody is told about is a feed with no audience: by
the time somebody happens to open the page, the clip has already gone.

Two new notification types (`samahan_story`, `samahan_message`), one shared fan-out
(`lib/samahan-notify.ts`) called from the story route and the Usapan post action through
`after()`, so the poster never waits on it and a failure can never unmake the post.

- **One unread notice per samahan per person, within an hour.** Group chat is bursty; a row per
  message would bury every other notification under a conversation the person is already in.
  🔑 **The hour is what stops the collapse becoming a permanent mute** — the tray's Open button
  does not mark anything read, and clearing is a separate press many people never make, so
  collapsing on "has any unread notice" would have silenced a samahan for good for anybody holding
  one stale notice. Bursts are minutes apart; a mute is forever.
- **The collapse read fails toward ringing.** Supabase resolves with `{ error }` and an empty
  list, which is indistinguishable from "nobody is ringing" — treating that as "everyone is
  already notified" would silence the feature the moment the query broke.
- **No message preview.** Take-down is a soft delete; a preview copied into a notification row
  has no inverse and would outlive the take-down in every recipient's tray.
- **Neither type is on the email or push allowlist.** The tray rings; nobody's phone buzzes at
  2am until the owner rules on quiet hours (`WHATS_NEXT_Samahan_2026-08-24.md` § 3.2).

🚨 **Found while adding them: three notification types the app emits have never existed in the
database.** Measured two ways that agree exactly — 70 enum labels parsed out of
`supabase/migrations`, the same 70 read out of production `pg_enum`, against 72 values in the
`NotificationType` union. `connection_request` (2 emit sites), `connection_confirmed` and
`order_cancelled` are in the app and in neither. An INSERT naming a label that does not exist is
**refused, not thrown**; `emitNotification` console.errors it by design, so nothing crashed and
CI stayed green while: somebody adding you to their people never reached you, confirming a
connection never reached the person who asked, and "your bill was cancelled with the celebration
you removed" never reached the buyer. `lib/connection-notifications.test.ts` has 11 passing tests
about two of those types and could not see it.

New guard `lib/every-notice-type-exists-in-the-database.test.ts` derives BOTH sides from the code
— the union out of `lib/notifications.ts`, the labels out of every migration — and is floored so
an empty parse fails instead of reporting a clean sweep. Six mutations, each measured by
occurrence count before → after, all red.

SPEC IMPACT: None. No price, SKU, scope or locked decision moves. The hourly story nudge and its
quiet hours remain the owner's call and are NOT built here.
