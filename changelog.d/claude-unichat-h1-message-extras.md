## 2026-11-20 · feat(chat): Unichat part H1 — edit and unsend your own message, voice notes, "Remind me"

The message half of row H of `UNICHAT-BUILD-PLAN-2026-11-20.md`, on the approved live drawing
(`build-sessions/UNICHAT-LIVE-2026-11-19.html`; DECISION_LOG 2026-11-20 "Unichat live prototype v3 APPROVED": "…
edit/unsend, seen-by, failed-send retry, voice notes, reminders …"). Stacked on #8047. The other half of row H
(receipt card, terms at Accept, crew for the day, handover + review) is part H2, a different PR.

**Edit and unsend**

- Hold your own bubble (touch), right-click it, or press the ⋯ beside it (pointer and keyboard): **Edit · Unsend ·
  Remind me** (`chat/message-extras-menu.tsx`). A tap is still a heart and the 🔒 beside the box is still the one
  private door — the menu carries neither.
- **Edit** puts the words back into the one message box ("Editing your message · Send saves it"; Escape or Cancel
  leaves). The bubble then wears a small **edited**.
- **Unsend** acts at once; everyone who could read the message reads the quiet line **"… unsent a message"** in its
  place (the drawing's words).
- **15 minutes** after sending, as the drawing has it (`Date.now()-m.born < 900000`); the database measures it on its
  own clock (+30 s grace). A voice note has Unsend only.
- **The database is the rule, not the screen** (migration `20271354347259`): `edit_my_chat_message` and
  `unsend_my_chat_message` are SECURITY DEFINER writers for ONE message — the caller's own, while they can still read
  the chat, words only (never a card; a photo/video/document still leaves by its own swipe, `remove_my_chat_file`),
  never a message filed under a decision. An edit passes the send's own contact screen. There is **still no UPDATE or
  DELETE policy on `chat_messages`**.
- **The chat is still the record**: what a message held before an edit or an unsend is kept in
  `chat_message_revisions` (RLS on, no policy, no grant — nobody in the chat reads it). Nothing is deleted and an unsent
  voice note's file does not leave storage; the row just stops naming it.

**Voice notes**

- An empty box turns Send into a **mic**: hold to record, slide left to cancel, release to send; the box shows the time
  while recording (`chat/voice-mic.tsx`). From a keyboard: Enter starts, Enter sends, Escape cancels. Capped at 59 s
  (the drawing's clamp) — at the cap the note sends itself.
- A voice bubble has **play / pause, its bars and its length** (`chat/voice-note.tsx`); a note that will not play says so.
- **No new storage path**: a voice note is a chat file — same private bucket and per-sender folder, same
  `prepareChatFile` → `/api/upload` → send action, same guard trigger, same `/api/chat/attachment/<id>` read route.
  New: three audio types on the server's allowlist (`CHAT_VOICE_MIME`, never offered by the file picker) and
  `chat_messages.voice_seconds`. Supplier chats only — a group chat takes no files yet.

**Reminders**

- **Remind me** on any bubble: Later today · Tomorrow · Pick a date; one per person per message, movable and
  removable (`chat_message_reminders`, own rows only; an insert needs a message the caller's own RLS returns).
- It comes back as an **in-app notification** (`chat_reminder`, new enum value in `20271354187586`) to the person who
  set it — **never an email** (`a-chat-reminder-stays-in-the-app.test.ts`). Cron-free: the signed-in shells deliver
  what is due beside their bell count (`lib/chat-reminders.server.ts`) — read the message under the person's own RLS,
  then claim atomically (`claim_my_due_chat_reminders`), then tell. Someone who can no longer read the message is told
  nothing.

**Tests**

- `tests/db/your-own-message-edit-unsend-voice-and-reminders.db.test.ts` — only the sender edits/unsends; the other
  side, a co-host and an outsider are refused alike; the window; cards/files/filed/contact refused; history kept and
  unreadable; no UPDATE/DELETE policy; voice insert rules; reminders are per-person; a removed co-host changes nothing,
  reads nothing, and their due reminder finds no message.
- `lib/chat-message-extras.test.ts`, `lib/chat-reminders.test.ts`, `lib/a-chat-reminder-stays-in-the-app.test.ts`,
  `app/_components/chat/a-message-has-its-extras.test.ts`.

**Not in this PR / open for the owner**

- The drawing gives the three reminder choices but no clock times: this build uses **3 hours on** for "Later today"
  and **9:00 AM Manila** for Tomorrow / a date (`lib/chat-reminders.ts`, one place).
- The brief's "Message removed" line is drawn as **"… unsent a message"** (the approved drawing's words).
- The drawing's **Setnayan-sent reminders** ("Quote ends in 2 days · Remind me later") are a different thing from
  "Remind me" on a message and are NOT built here (19 Nov ruling: the app sends no nudge by itself).
- Reply · Heart · Make it a decision · Copy in the drawing's hold menu are other parts; "Remind me" on a card (quote,
  meeting…) is not offered yet — bubbles only.

SPEC IMPACT: None — implements rulings already in DECISION_LOG (2026-11-20 "Unichat live prototype v3 APPROVED",
"UNICHAT BUILD STARTS"). Two build choices are flagged above for the owner (reminder times; the 59 s voice cap).
