## 2026-09-09 · fix(chat): a file can actually be attached to a conversation again

PR #5339 added `chat_messages.attachment_r2_key` with SELECT and no INSERT.
`chat_messages` uses per-column grants and the send path inserts under the
caller's own session, so naming that column was a hard permission failure —
every attempt to attach a file, by a couple or a supplier, was refused and the
message went with it.

Grants INSERT on the one column to `authenticated` only, matching its four
siblings. Not to `anon`, and no UPDATE.

The existing grant guard is extended to DERIVE its column list from the payload
`chat-send.ts` actually inserts, because the hand-written list is why it stayed
green throughout.

SPEC IMPACT: applied — `DECISION_LOG.md` 2026-09-09.
