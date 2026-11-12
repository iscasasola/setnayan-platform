## 2026-11-12 · fix(chat): an admin reads a chat only while an open dispute ties the event to the shop (task 6119)

- Migration `20271341658320` adds ONE helper, `admin_disputed_thread_ids()` (SECURITY DEFINER, empty for anyone who
  is not an admin): the threads an open `vendor_disputes` row ties to — the same link as `chat_private_in_dispute`.
- The bare `OR is_admin()` arm on every chat-content read is narrowed to it: `chat_decision_messages_read`,
  `chat_decision_topics_read`, `chat_polls_read`, `chat_poll_choices_read`, `chat_poll_votes_read`,
  `chat_thread_members_read`, `booking_change_asks_members_read`, `thread_calls_member_read`, and the definer reader
  `change_asks_read` that restates the asks policy. Every other arm is byte-identical; nobody is widened.
- Left as they are, on purpose: `chat_messages` / `chat_threads` reads never had an admin arm (adding one would widen);
  the private-line restrictive policy was already dispute-gated; `chat_message_flags` (moderation metadata, no words)
  and `chat_blocker_shows` (banner counts) carry no chat content. The admin dispute console reads through the service
  role, which RLS does not govern, so it reads what it read before.
- Tests: `tests/db/an-admin-reads-a-chat-only-inside-an-open-dispute.db.test.ts` (admin reads nothing → everything in
  an open dispute → nothing once resolved; host and shop identical throughout; sabotage: 4 of 5 fail without the
  migration) and section 4 of `lib/a-private-message-never-reaches-a-third-person.test.ts` (the latest definition of
  every chat-content read carries no bare admin arm). Exposure baseline regenerated (8 predicates narrowed, 1 helper).

SPEC IMPACT: None (implements the owner's existing ruling that an admin reads a private conversation only through a
dispute — DECISION_LOG 🔒 2026-11-09 — on the rest of the chat's content).
