## 2026-11-21 · feat(unichat): Mute this chat — per person, phone notices only

Built to the approved drawing `unichat_live_v3_2026-11-20.html`: a "Mute this chat" / "Unmute this chat" row in ⋯, a bell-off after the name while muted, and the toast "Muted. Cards that need you still show." The controller's ruling of 21 Nov sets the rules: per person, on all of that person's devices, and nobody else is affected. Unread counts stay; only the phone notice stops.

**Data (migration `20271356402294_a_chat_can_be_muted_by_one_person.sql`)**
- New table `chat_thread_mutes(thread_id, user_id, muted_at)`. RLS uses Pattern A (own rows only); signed-in users get SELECT, INSERT and DELETE only.
- New nullable column `vendor_push_tokens.user_id`, so a shop device says whose phone it is.

**Who gets told**
- **Per-person notices:** `emitNotification` gains `silent`. The bell row still lands, but the push is skipped. The chat notice sender (`notifyChatRecipients`) reads the chat's mutes once and passes `silent` on all 7 of its notices.
- **Shop-wide push (`/api/notify`):** it now leaves out the devices of anyone who muted that chat (`tokensToBuzz`).
- **Old devices:** a device registered before this change has no person yet, so it is still sent. It gains its person the next time it re-registers.
- **Failed mute read:** silences nobody.

**The switch**
- It goes in ⋯ before Report a problem on both picked pages. It's a new `control` row kind: a row that is its own button.
- It is drawn only when the viewer's mute was actually read.
- The write is folded into `savePushSubscription`, so no new server action is added.

**Privacy and erasure**
- Export: `chat_thread_mutes` is exported as `chats_you_muted`, like `invite_mutes`.
- Erasure: `chat_thread_mutes` is deleted with the person. Their own devices on any shop (`vendor_push_tokens.user_id`) are now deleted too.
- `vendor_push_tokens` becomes an export KNOWN_GAP, like its twin `push_subscriptions` (device tokens are credentials). This raises `KNOWN_GAP_CEILING` from 68 to 69, deliberately.

**Guards**
- `lib/mute-this-chat.test.ts`: 5 sabotages, each turned it red.
- `tests/db/a-chat-can-be-muted-by-one-person.db.test.ts`.

SPEC IMPACT: None. This builds the approved drawing per the controller's ruling of 2026-11-21.
