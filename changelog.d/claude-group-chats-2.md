## 2026-11-12 · feat(chat): private messages — two doors, several people

Owner ruling (specs DECISION_LOG 2026-11-12 "PRIVATE MESSAGES — TWO DOORS, SEVERAL PEOPLE"; "EVENT GROUP CHATS APPROVED
AS DRAWN" (3)). Reverses the 11 Nov "one icon" door.

- Door 1: a face in the "who is on" strip (`chat-host-strip.tsx`) is a private message to that one person again (never
  your own face, never your own login behind the shop's face).
- Door 2: the composer's 🔒 (`private-people.tsx`) is a list of ticks with ONE button — "Message Ana privately" ·
  "Message 3 people privately". It opens with the same people ticked when you are replying to a private line (its
  sender + its other recipients).
- Words: `privateBoxPlaceholder` / `privateStripLabel` take a list — "Private message to Miguel and Tita Lu",
  "Private · only you, Ana and Miguel"; each reader sees the other people, never their own name.
- Still words only (the ＋ and every attach hide while private, `PRIVATE_WORDS_ONLY_MESSAGE`); a private line never opens
  the filing picker.
- Server: one `private_to` field per person; one recipient keeps `recipient_user_id`, several go in
  `recipient_user_ids`; each recipient must be a host, a coordinator or the shop's people; each is told once.
- Guards: `lib/private-to-several-people.test.ts` (new) and the updated `a-private-message-looks-private`,
  `a-supplier-chat-starts-small`, `a-private-message-never-reaches-a-third-person` pins.

SPEC IMPACT: None
