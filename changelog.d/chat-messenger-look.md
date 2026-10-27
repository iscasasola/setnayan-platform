## 2026-10-28 · feat(chat): the Messenger look — full-screen thread, one ＋ per side, no calls, one Share a file, instant open, Sent → Seen

Chat slice **C1** of the approved chat prototype (corpus `prototypes/chat_messenger_2026-10-28/`, DECISION_LOG 2026-10-28
"CHAT APPROVED — MESSENGER LOOK, ONE ＋, NO CALLS" + the three 2026-10-27 chat rows). Extends the shipped thread pages,
`ChatBox`, `ChatMessageStream`, `ChatSendForm`, the supplier's ＋ sheet and the couple's Chats inbox — no new chat.

- **Thread** — on a phone an open thread is full screen (`data-chat-takeover`; the named `.sn-vt-page` stops capturing it
  while a thread is open): slim head ‹ · avatar · name · event line · ⓘ (the ⋮ menu, now ⓘ), the folding safety line,
  Messenger bubbles (runs, the other side's avatar by the last of a run, one centred time per stretch), the shop member's
  first name on a supplier's run (couple side, revealed shops only — already stored per message, no schema).
- **Composer** — ＋ · 📷 · 🖼 · round field · send on both sides. 📷/🖼 hand the file to the ONE attachment input (same
  compression path). A sent message shows at once, faded, "Sending…"; a failure says "Not sent · Try again"; an ok whose
  row never arrives is re-read once and then said as not sent (`lib/chat-optimistic.ts`). "Delivered" → **"Seen"** from
  the other side's `chat_thread_reads` (`lib/chat-thread-receipts.server.ts`).
- **One ＋** — the couple's sheet (Deal or meeting · Share a file "File · photo · video") and the supplier's sheet grouped
  Money · Plan · Talk & files · Just you, with the shipped greyed/shut rules; ONE "Share a file" ("File · photo · video ·
  the contract").
- **No calls** (owner: "remove both voice and video call") — the Call row, the call panel + its anchors, the composer
  `call` affordance and the customer page's "Call" deep link are gone. LEFT IN PLACE, unused by the chat, for the owner:
  `app/_actions/thread-call-actions.ts`, `app/_components/thread-call-room.tsx`, `app/_components/thread-call-launcher.tsx`,
  `lib/thread-calls-gate.ts`, `app/_components/appointment-join.tsx` (appointments' video join, not the chat).
- **Inbox** — big title, All · Unread · Suppliers, frameless rows (56px round · name · stage tag · "You: …" · time · bold +
  dot) each with its event line (owner: "i want isolation per event"); the ONE search in the frosted thumb row
  (`ThumbRow`/`ThumbDock`, eases to 70 % while scrolling) matching names via `lib/chat-inbox-search.ts` (the seam C5's
  message-text search lands in); ✎ opens "Message a supplier" — this event's suppliers only (owner: "users can only chat a
  supplier inside an event").
- **Fast** — a thread's `loading.tsx` is `ThreadArrival`: the last-known messages (sessionStorage, same viewer only) in
  the thread's own shape, at once.
- Lab: `/dev/chat-lab` (inbox) and `/dev/chat-lab/t/<id>` (thread; `?side=vendor`, `?seen=1`, `?send=fail`, `?delay=`).
- Guards: `lib/the-chat-has-no-calls`, `lib/a-sent-message-shows-at-once`, `lib/the-chat-inbox-is-one-search`,
  `lib/the-chat-is-messenger-shaped`, `lib/a-supplier-chat-starts-inside-an-event` (new); `one-chat-box-like-messenger`,
  `the-chat-tools-are-one-sheet`, `the-thread-tools-open-what-they-name`, `deal-waits-for-a-quote`,
  `one-chat-box-everywhere`, `an-open-tool-cannot-flatten-the-stream`, `the-tappable-mark-is-the-accent` moved to the new
  property. No migration; +0 exported "use server" functions.

SPEC IMPACT: None beyond the 2026-10-28 rows already recorded (C1 builds them). Open for the owner: whether to delete the
unused call code; the booking-fee lines in the supplier's quote composer / booking-ask panel are untouched (see PR).
