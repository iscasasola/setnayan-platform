## 2026-11-12 · feat(chat-db): event group chats and a private line to several people — schema + RLS

Owner rulings (specs DECISION_LOG 2026-11-12): "EVENT GROUP CHATS APPROVED AS DRAWN", "PRIVATE MESSAGES — TWO DOORS,
SEVERAL PEOPLE", "FIVE GUARDS APPROVED" (guards 1 and 2). Drawing: `Build_Group_Chats_2026-11-12/event-group-chats.html`.

- `20271339978803` — `chat_sender_role` gains `guest` (alone in its file: an enum value cannot be used in the
  transaction that adds it).
- `20271340374819`:
  - `chat_threads.kind` (`supplier` | `group`). A group has no supplier (`vendor_profile_id` NULL, the NOT NULL kept for
    supplier chats as CHECK `chat_threads_a_supplier_chat_has_a_supplier`) and a `group_kind`: `general` (hosts +
    attending guests, derived), `role` (hosts + the guests holding its roles, derived), `made` (member rows only).
  - `chat_group_member_ids()` is the one answer to who is in a group; `current_thread_ids()` gains a group branch and its
    coordinator branch narrows to supplier chats (a coordinator is in a group only when added).
  - Group rows are hidden from every table read (RESTRICTIVE `chat_threads_groups_read_through_functions`), so the ~90
    shipped event-scoped `chat_threads` reads never see a row without a supplier. Read through `chat_group_list` /
    `chat_group_head` / `chat_group_members`; written through `chat_group_open` · `_open_role` · `_create` (hosts) ·
    `_add` (hosts + coordinator; General takes no supplier) · `_leave` (hosts only). `chat_thread_add_host` /
    `chat_thread_leave` refuse a group.
  - `chat_messages_group_rules`: a group line names no supplier and carries no quote / change / amendment / offered
    service card.
  - `chat_messages.recipient_user_ids uuid[]` — a private line to several people, on the row (a junction table would
    leave the line shared for an instant: realtime, the push webhook and the bump trigger fire on INSERT).
    `recipient_user_id` stays its first entry (CHECK `chat_messages_recipients_agree`), so every "IS NULL = shared" test
    keeps its meaning. Backfilled.
  - Read rule rewritten: `chat_messages_private_reaches_its_people` — shared, or sender, or a recipient, or an admin
    ONLY while an open `vendor_disputes` row ties the event to the supplier. No branch for moderators / helpers.
  - Alerts: one tray row per recipient (never the words); the live ping reaches recipients / group members; the shop's
    push webhook fires for shared supplier lines only; the three unread counters read the list.
- App: the personal-data export reads the private lines where the subject is any of the recipients; the Ugat map's
  conversation joint carries the new kind, columns and checks.
- Guards: `tests/db/event-group-chats-and-a-private-line-to-several.db.test.ts` (21 tests, 14 sabotage runs each RED,
  then restored). Updated audit pins (new definer readers, the 'guest' costume in the forgery loop, the webhook's WHEN,
  the export's array filter, the tripwire now also matching `recipient_user_ids`).

SPEC IMPACT: None
