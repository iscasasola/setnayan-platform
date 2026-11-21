## 2026-11-21 · fix(batch-d): two mechanical gaps found when #8093 met main

- `app/_components/chat/mute-chat-row.tsx`: the refresh after muting carries its `// one-render: keep (no-revalidate)` marker (`lib/a-save-renders-once.test.ts`); `muteChat` revalidates nothing.
- `lib/export-completeness.ts`: `vendor_push_tokens` is person-keyed since #8093 added `user_id`. It is excluded for the same reason as `push_subscriptions`: a live delivery credential (`tests/db/every-person-keyed-table-is-decided.db.test.ts`).

SPEC IMPACT: None
