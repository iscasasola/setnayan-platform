## 2026-11-09 · feat(chats): one picked shell for both sides; Chats lists one row per event, unread pinned on top (Supplier Build 3 · Lane A)

Owner, 8 Nov (DECISION_LOG ✉️ 🪞): the supplier's envelope lists *"all the events (no dupes)"* in Messenger order with unread pinned above, and a row opens the picked client on Chat. The host's chat icon lists this event's suppliers by the same rule, and a supplier opens in *"the same full screen effect"*.

- **One picked shell.** `app/_components/picked/picked-shell.tsx` is now the only picked screen. It owns the portal on `--sn-z-pop`, the `pickedMotion` open and its reverse on ✕/Esc, the `history.replaceState(?tab=)` page switch, the swipe and the thumb layer. `PickedClientShell` (supplier) and the new `PickedSupplierShell` (host) are thin wrappers that pass menu, icons and doors. `picked-motion.ts` and the nav context moved beside it; the old path re-exports them. Guard: `app/_components/picked/one-picked-shell.test.ts`, sabotage-checked.
- **Supplier Chats.** `readSupplierChats` folds threads by event (`lib/chats-by-event.ts` `foldByEvent`). Each row goes to `/vendor-dashboard/clients/<eventId>?tab=chat`, which `vendor-dashboard/messages/@client/(..)clients/[eventId]` intercepts, so the picked client rises over the still-mounted list. The Clients list still opens on Details.
- **Host Chats.** For a supplier with a workspace row, the row goes to `vendors/<id>/workspace?tab=chat`, intercepted by `messages/@supplier/(..)vendors/[vendorId]/workspace`. With the relationship flag on, the workspace now draws the picked shell with Details · Chat · Schedule · Quotation · Payment · Forms · Files · Inspiration. It opens on Details by default and no longer redirects `?tab=chat` to the thread page. Chat embeds the host thread page (`__embed=chat`, read-marked only while shown, the `SupplierThreadBody` pattern) through `CoupleThreadBody`.
- **Messenger order in the shared inbox.** `ChatInbox` groups rows under "Unread · pinned" and then "Recent", using `messengerOrder`. It gains `opensPicked` (records the row as the open origin) and `needsYou` (🚦 dot: blocker stronger than due-now). The level is read from Lane B's `needsYouLevel()`; until that lands no row passes one, so no dot is drawn (TODO in `lib/chats-by-event.ts`).
- **The host strip on every chat.** The host's picked Chat now draws the shipped `ChatHostStrip` under the pinned row, as the supplier's does. It has one source (`event_chat_hosts` plus the shop's owner, `lib/chat-strip-people.server.ts`), keeps the green ring and "Shared chat · N inside · M in the chat now", and says "Couldn't load" when the read is refused. Strip order (owner, 9 Nov): Supplier · coordinator(s) · You · the other hosts. "You" sits in your own slot and is never shown twice (`stripOrder`, `lib/chat-members.ts`). Faces are 44 px, and the no-clip `p-1 -mx-1 scroll-px-1` stays.
- **🔒 Private messages (DECISION_LOG 2026-11-09 🔒).**
  - Three doors open one composer chip, "Messaging [name] privately ×":
    - tap someone else's face → Message privately;
    - the composer's 🔒 beside the ＋, which lists the strip's people;
    - press and hold a message → Reply privately, which pre-picks the sender.
  - Any pair can message privately, host↔host included.
  - Private messages are words only: while the chip is on, the ＋ and every attach control step aside, and the server refuses a file (`private_words_only`).
  - They are BLUE. The bubble fill, its strip "🔒 Private · only you and [name]", the 🔒 in the time row and the chip all use the `--color-info` token. Measured contrast: AA in light and dark. No normal bubble uses that token.
  - No auto-reply; only the one recipient is notified.
  - The recipient column is `CHAT_PRIVATE_RECIPIENT_COLUMN` (`lib/chat-private.ts`) — Lane B's migration owns the column and its RLS rule; `fetchMessages` falls back to today's select until it lands.
- **👥 A supplier chat starts small (DECISION_LOG 2026-11-09 👥).**
  - The strip's ＋ comes last, only for hosts and coordinators, never the supplier, and only while an event host is missing.
  - It lists every missing host, including those who left, with ticks, plus "Add all" when two or more are missing.
  - The system lines are "Lea added Marco (back)", "Lea added everyone" and "Marco left".
  - A host leaves by tapping their own face (Leave chat, confirmed). Coordinators and planners never leave and are never listed.
  - Rules: `lib/chat-members.ts`. The writes (`memberAdd` / `memberLeave`) and the thread-scoped members read are Lane B's; the pages carry TODOs, and the labs draw stand-ins.
- **📞 Call · Video call in the picked chat head.** Inside a picked page the routed head is not drawn, so `BookedCallButtons` now stands at the strip's end. It uses the same component and props, `booked={shopBooked}` and the existing phone helper, with no new gate.
- **🚦 Needs-you dot** on a Chats row's avatar corner. Blocker is stronger than due-now. It is prop-driven until Lane B's `needsYouLevel()`.
- No chat-head thread picker (owner: one shared chat per supplier per event; switching chats is the Chats list only).
- Guards (each sabotage-checked):
  - `lib/a-private-message-looks-private.test.ts`;
  - `lib/a-supplier-chat-starts-small.test.ts`;
  - `lib/every-chat-head-has-its-calls.test.ts`.
- Updated guards (the old contract changed by the owner's ruling, not loosened):
  - `the-chats-page-is-full-screen` now checks the event fold and the picked door;
  - `one-chat-box-everywhere` allows the one lab part only while its importers are the two 404-first lab pages;
  - `questions-for-every-supplier` counts the Forms page's `?? (…)`.
- Labs: `/dev/supplier-chat-lab?m=chats&pick=…` and `/dev/chat-lab?pick=…` draw the picked shell over the list, sharing one Chat body, `app/dev/_components/lab-picked-chat.tsx`.
- Regenerated: `lib/ugat/screens.generated.json`, `scripts/port-control-baseline.json`.

SPEC IMPACT: None to the corpus. This implements the 2026-11-08 ✉️/🪞 rows as recorded. These choices need the owner's eye:
- the host's tab order follows the DECISION_LOG/brief (Details first), not the prototype's host order (Chat first);
- the host keeps a Files tab;
- the host list title stays "Chats";
- Lane B must supply, in the integration:
  - the recipient column name and its INSERT grant and SELECT rule;
  - the thread-scoped members read and the add/leave writes with their system lines;
  - `needsYouLevel()`.
