## 2026-11-12 · feat(chat): event group chats — Groups in Chats, the group chat, + New group

Owner ruling (specs DECISION_LOG 2026-11-12 "EVENT GROUP CHATS APPROVED AS DRAWN"; drawing
`Build_Group_Chats_2026-11-12/event-group-chats.html`, phones A and B).

- Chats (`/dashboard/[eventId]/messages`): a Groups section on top — General · one per guest-list role group · groups a
  host makes — then the shipped Suppliers list, unchanged. Server-rendered links (no script on the page). Opening a
  host's or the coordinator's Chats opens General and the role groups (idempotent). "+ New group" for hosts only.
- `/samahan/chat/[threadId]` — one address for everyone in a group (host, coordinator, guest, supplier). The same chat
  as the supplier's: the shipped `ChatBox`, `ChatThreadHead` (name ▾ = a sheet of your groups), `ChatMessageStream`
  (strip "Group chat · N inside": a face = private to that person; own face = Leave for hosts; ＋ for hosts and the
  coordinator) and `ChatSendForm`. A host who left sees "Join this chat again?".
- A group's (+) and "/": Decision · Poll, Meeting and Photos & files drawn shut ("Not open in group chats yet"), and a
  quiet last row "Quote · Payment · Form — in each supplier's own chat, never in a group".
- `/samahan/chat/new?event=…` — a plain form: a name and the event's people with ticks.
- In a group, "mine" is the writer (`ownsBubble`): several suppliers and guests share a side.
- The ▾ sheet and the (+) rows load through `next/dynamic` on the group page only.
- Dev lab `/dev/event-group-chat-lab` (fixtures; production 404s it). Guards: `lib/event-group-chats.test.ts`.
- Migration `20271340374819` gains `chat_group_people` (the event's people, hosts/coordinator only), the per-column
  SELECT grant for the new `chat_threads` columns, and "You" on the list's last line.
- Migration also gains `chat_threads_group_fields_are_the_servers`: a browser session may only open a supplier
  conversation and never write a thread's kind or group fields (the table-level grants make a column REVOKE inert).
  Exposure baseline regenerated — every added line is a group column, a group function or the rewritten private rule.

SPEC IMPACT: None
