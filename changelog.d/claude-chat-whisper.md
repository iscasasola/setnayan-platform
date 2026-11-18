## 2026-11-19 · feat(chat): Message ⇄ Whisper — one box, drag it right to whisper to the co-hosts

Owner, 19 Nov: *"message and whisper approved"* (drawing v16, specs `prototypes/chat_send_to_private_2026-11-19.html`),
*"Yes, add it"* (the mis-send reminder), *"we also show the someones typing... so we know to expect something?"*, and
*"add the builds including whisper as well"*.

- **One box** (`app/_components/chat-send-form.tsx`): the ＋ sits inside the message box at its left end and Send inside
  it at its right end, on every composer. Send is **ink at rest** (it was the brand colour).
- **Whisper** — a HOST's composer in a supplier's chat only. Drag the BOX right (never Send; a press that starts on a
  control inside the box is not a drag) and the next lines reach the **co-hosts in this chat only**; the supplier never
  sees them. It stays on until the box is dragged again, and the switch never sends. Placeholders "Message" /
  "Whisper"; the ＋ folds away and every attach leaves the page (a whisper is words only); no lock anywhere. The 🔒
  picker button is gone from the host's composer (a face in the strip is still private to one person; the supplier's
  composer keeps its 🔒). A keyboard / screen-reader twin of the drag: a real `role="switch"`, shown when focused.
- **The Send icon** (`chat/whisper-send-icon.tsx`, paths and order in `lib/chat-whisper.ts`): triangle → rounded square →
  the line swings down to the chat tip → dots one by one; back: dots break into specks and go → square → triangle → the
  line completes the plane. Overlapping, two-ended, no bounce; speeds from the motion table (Tap · Quick · Move). The
  drawing's SMIL `<animate d>` is ONE frame loop here (CSS `d:` does not exist in Safari, and a second drag mid-change
  must turn around from where it is). Reduced motion: the icon swaps at once.
- **Mis-send reminder**: back to Message with words typed → the words turn ink and one line says "Everyone will see
  this, including <supplier>."; the first Send after that asks once, "You left Whisper. Send to everyone?" (the house
  `ConfirmDialog`). Cancel keeps the words.
- **Typing**: "X is typing…" as before. While whispering nothing is tracked on the chat's presence channel (the
  supplier sits on it); the co-hosts see "X is whispering…" in sky blue, sent as a broadcast on the event team's
  PRIVATE channel (`event-team:<event>`, `event_team_presence_can_access` — hosts and moderators only).
- **NO NEW SCHEMA.** A whisper IS the shipped private line (`chat_messages.recipient_user_ids`, RESTRICTIVE policy
  `chat_messages_private_reaches_its_people`, migration 20271340374819). New is WHO DECIDES THE LIST: the send core
  (`lib/chat-send.ts`, `whisperRecipients`) reads the hosts in the chat (`chat_thread_members`, `left_at IS NULL`),
  leaves out the sender and every shop login, ignores any posted `private_to`, and **refuses** a whisper nobody can
  hear or from a non-host — it never falls through to a line for everyone. A refused whisper throws at the action, so
  the box says "Not sent".
- **Guards:** `lib/a-whisper-never-reaches-the-supplier.test.ts` (the list, the refusal, the typing channel, the box,
  the reminder, the icon's paths and order) and `tests/db/a-whisper-never-reaches-the-supplier.db.test.ts` (the
  supplier, its team, a host on the shop's team, a host who left, the coordinator and a stranger read no whisper row
  and get no notice; the typing channel refuses the shop; a sabotage row proves the harness can see).
  `lib/a-private-message-looks-private.test.ts` updated for the two spec changes (Send = ink at rest; the `whisper` prop).

SPEC IMPACT: None new — builds DECISION_LOG 2026-11-19 rows "MESSAGE ⇄ WHISPER APPROVED", "ONE BOX: ＋ AND SEND INSIDE
IT", "SWIPE THE BOX, NOT SEND; SEND LIVES INSIDE THE BOX", "PLANE → WHISPER, IN ORDER", "WHISPER → PLANE, IN ORDER",
"CHAT PLACEHOLDERS — FINAL", "MIS-SEND REMINDER + WHISPER TYPING" and "WHISPER UN-PARKED" as written.
