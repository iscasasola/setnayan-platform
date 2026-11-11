## 2026-11-11 · fix(chat): a message sent from the shop's chat speaks as the shop, even when the sender also hosts the event

Live fault (owner, 11 Nov, with a screenshot): his one login owns the shop "SetnaProd" and hosts the test event
"TEST SetnaProd walk". A "Hello" typed in the shop's picked-client chat came back as "Indalecio · IC" on the host's side,
and the strip showed one face — "You · Shared chat · 1 inside". Owner: *"instead of the shop messaging my user account,
it's just me messaging myself"* · *"It should be the shop and then you."*

**Cause.** `tg_chat_messages_derive_sender` derived the side from `auth.uid()` alone, couple first — one person on both
sides always landed as the host, whichever screen they typed in. The strip was keyed by person, so the shop's face and
the host's "You" collapsed into one (and the host page's reader dropped a shop whose owner was the viewer).

**Fix.**
- Migration `20271338442002_the_shell_decides_who_a_message_speaks_as`: new nullable `chat_messages.sent_as`
  (couple|vendor), INSERT-granted to `authenticated`. The trigger honours it ONLY when the sender holds that side, else
  refuses (42501); NULL = the old derivation. `sender_role`/`sender_user_id` stay un-nameable.
- Every supplier send path asks for the shop side: the supplier composer (`sentAs="vendor"`), its quick replies, the
  supplier app's JSON endpoint, the waitlist message. `lib/chat-sent-as.ts`. The host's screens send nothing.
- Bubbles pick the face on the message's own side (`hostForMessage`), never by uid alone.
- The strip draws the shop's face first, then "You", two inside, on both sides (`stripOrder` + `shopLabel`); your own
  shop's face is not a private-message target; "in the chat now" counts people.
- Lab: `/dev/supplier-chat-lab?m=chats&pick=…&self=vendor` and `/dev/chat-lab?pick=…&self=vendor` (`self=couple` = the old rows).

Guards: `lib/one-person-on-both-sides-speaks-for-the-screen.test.ts`,
`tests/db/one-person-on-both-sides-speaks-for-the-screen.db.test.ts`.

Messages already stored as the host before this ships stay as they are (the chat is append-only).

SPEC IMPACT: None — restores the locked behaviour that the shop speaks as the shop; no decision changes.
