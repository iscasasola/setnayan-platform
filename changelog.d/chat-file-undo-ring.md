## 2026-11-13 · feat(chat): your own file — a 10 s ↺ undo ring on send, and a swipe to Delete for everyone (5 min) or Delete for me

Builds the approved prototype `chat_file_undo_ring_2026-11-13` v3 (DECISION_LOG 2026-11-13 "CHAT FILE: UNDO RING SHOWS
AT ONCE ON SEND…" + "CHAT FILE UNDO DRAWING APPROVED"), replacing the PR's earlier swipe + Undo-toast hard delete.

- **Undo ring** (`chat/chat-file-swipe.tsx`): the moment you send a file, a 44px ↺ ring sits left of your bubble, its arc
  emptying over 10 s with the seconds under it (motion-safe only). Tap = deleted at once for both, no line. Reads the
  message's own time, so coming back shows the time left or nothing.
- **Swipe** opens "Delete this file?": Delete for everyone (red, first 5 min, "· N min left", from the server's clock) ·
  Delete for me · Cancel; after 5 min only Delete for me with the line why. Booking files: "This file is part of the
  booking, so it stays for everyone." and Delete for me only. A failure keeps the bubble: "Couldn’t delete your file.
  Try again."
- **Server** (migration `20271341904583`, edited in place — never on main): `remove_my_chat_file(message_id, mode)`
  enforces undo ≤10 s (+5 s grace), everyone ≤5 min (+30 s grace) on the row's created_at, refuses booking files
  (`chat_message_is_booking_file`: decision cards/filings, "This booking" filings, payment proofs, contracts, an order
  on the event) for undo and everyone, and keeps the words (only the attachment columns clear). New
  `chat_file_removals` (RLS at create; own rows + for-everyone rows to whoever reads the message) carries "… removed a
  file · time" and the per-viewer hide. `chat_file_removal_options` feeds the sheet. Route
  `DELETE /api/chat/attachment/[id]?mode=…` · `GET …?removal=options`. Exposure baseline regenerated.
- Lab: `/dev/chat-lab/t/<id>?file=ring|sheet|late|booking`.

SPEC IMPACT: None — the corpus already carries the 2026-11-13 rows.
