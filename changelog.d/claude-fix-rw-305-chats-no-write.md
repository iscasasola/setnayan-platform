## 2026-11-14 · fix(chats): opening the Chats list no longer creates group chats (RW-305)

Live 02c3b18: just opening a couple's Chats list created an empty "General" group (and every role group) with no
press — the list's server component called `chat_group_open` / `chat_group_open_role` on every render. Now the list
only READS: a General or role group nobody has opened yet is drawn as the same row, and its press posts a new server
action `openGroupChat` (a form, so it is never prefetched) that opens it and lands in it. A refused open comes back to
the list with "Couldn't open that group just now". `openEventGroups` is gone; `groupsToOpen` (read-only),
`unopenedGroups` and `openOneGroup` replace it, and a role group's name and roles are re-derived server-side, never
taken from the form. Guard: `lib/a-chats-list-never-writes.test.ts` (render makes no RPC and no write; the component
names no opener).

SPEC IMPACT: None — the approved Groups list looks the same; a group now exists from its first tap instead of first view.
