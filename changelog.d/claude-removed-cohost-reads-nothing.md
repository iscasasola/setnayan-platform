## 2026-11-19 · fix(chat): a removed co-host reads no chat

A co-host removed from an event kept a live `chat_thread_members` seat, and `current_thread_ids()` admitted any live
seat without asking whether the person was still on the event — so they kept reading the supplier conversation
(quotes and payments included), could still be picked for a private line, and were still told when a message arrived.

- Migration `20271352461498_a_removed_cohost_reads_no_chat.sql`:
  - `chat_seat_is_held(thread, user)` — one rule: a supplier-chat seat is held while the person is a host
    (`event_members` 'couple'); a group seat while `chat_group_person_kind` still names them (host · coordinator ·
    guest · supplier — a supplier in a host-made group has no `event_members` row and keeps their seat).
  - `current_thread_ids()`: the live-seat arm also requires `chat_seat_is_held`; the coordinator and General/role arms
    are byte-for-byte unchanged.
  - Trigger on `event_members` (delete · member_type / user_id / event_id / guest_id change) sets `left_at` on seats
    that stop being held, so the private-line recipient check, the ping fan-out and the ChatHostStrip follow too. No
    `left_note`, no system line, no notice.
  - One idempotent backfill of seats already orphaned.
- `readThreadHostPeople` (`lib/chat-shop-people.server.ts`) lists a seat only while its person is still a host, via
  the pure `threadHostPeopleFrom` rule.
- Tests: `tests/db/a-removed-cohost-reads-no-chat.db.test.ts` (fails 4/5 without the migration, passes 5/5 with it) and
  `lib/a-removed-cohost-is-never-listed.test.ts`.

Owner go: "yes fix the co-host leak today" (19 Nov).

SPEC IMPACT: None
