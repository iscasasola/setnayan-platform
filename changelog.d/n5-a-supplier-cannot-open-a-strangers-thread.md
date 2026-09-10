## 2026-09-11 · security(chat): a supplier cannot drop a conversation into a stranger's inbox (N5 · part C)

Found by N4 (#5435 "found, not fixed"), measured by N5 on origin/main in the replay as a
real `authenticated` supplier: follow your own shop (no rule against it — that satisfies
the RESTRICTIVE follow gate), then `INSERT INTO chat_threads` with ANY couple's
`event_id` → 1 row. `chat_threads_member_insert`'s supplier arm admits any event.

- Migration `20271222816187`: `tg_chat_threads_guard_sides` (N4's side guard) gains one
  INSERT clause — a browser session opens a conversation only from the event's side:
  the couple on their own event, or a shop's agent on a customer event they were given
  (the insert policy's other two arms, unchanged). Refused with the guard's own marker
  (42501). Body otherwise byte-for-byte 20271222263716.
- Every opener kept, and proven: the couple's inquiry and resume-upsert, the agent arm,
  the service role (the claimed invite's pre-seeded thread, admin demo inquiries,
  auto-accept), and the supplier answering a thread the couple opened. No function in
  production inserts into chat_threads; no supplier browser path opens one in the app.
- Guard: `tests/db/a-supplier-cannot-open-a-strangers-thread.db.test.ts` (11).

SPEC IMPACT: None
