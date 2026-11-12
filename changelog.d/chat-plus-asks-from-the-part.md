## 2026-11-12 · feat(chat): an ask starts from the part it changes · the (+) and picker sheets open at half (rulings 6076 · 6106)

- **6076** — the host's (+) loses its generic "Ask for a change" row (and `/ask`). An ask now starts from the part
  being changed and carries it: the shipped `AskChangeDoor` (`ask-change-card.tsx`) is offered on each quote line,
  on the payment plan and on a sent form, pre-attached to that part. Poll (`pollRow`) is unchanged.
- **6076 · swipe-to-remove your own file** (owner 12 Nov: *"delete it outright"*) — your own file bubble in a chat
  swipes left to Remove (THE ONE SWIPE + Undo, `chat/chat-file-swipe.tsx`). After the Undo window the row is deleted by
  the new SECURITY DEFINER `remove_my_chat_file` (migration `20271341904583`: only the sender, only a message that
  carries a file, only while they can read the chat) and the R2 object by `DELETE /api/chat/attachment/[messageId]`.
  A deliberate, owner-signed exception to the chat's immutable-evidence posture — still no DELETE policy on
  `chat_messages`; the exception applies even where the event has an order.
- **6106** — the (+) sheets (supplier `thread-tools-sheet.tsx`, the hosts' equivalent) and the picker sheets opt in to
  the shipped `Sheet` `half` + `snap` (open at half, drag up to full, drag down back).

SPEC IMPACT: DECISION_LOG needs a row — "a member may delete their OWN chat file outright (owner 12 Nov 2026), an
exception to the chat-as-immutable-evidence lock (migration 20270926679942), including chats under the order legal
hold". Not applied from this cloud session (the spec corpus is not in it) — flagged for the owner/controller.
