## 2026-11-08 · fix(chat): the block guard sees past the caller's RLS

Security fix, live since 20270223909213 (build-notes/supplier-1build-integration.md §7 item 11, found by lane C2).
`chat_messages_block_guard` looked up "who is on the other side of this thread" inline, under the caller's RLS. A
couple cannot see an UNPUBLISHED shop's `vendor_profiles` row, so the lookup came back empty and the guard passed —
a couple who blocked an unpublished shop could still post into its thread.

- Migration `20271327631190_a_chat_block_sees_past_the_callers_rls.sql` re-points the RESTRICTIVE INSERT policy at
  the SECURITY DEFINER helper `chat_pair_is_blocked(event_id, vendor_profile_id)` — the one hearts already use
  (`20271325581544`). No new helper, no data change. Fails loudly if the helper is missing.
- Behaviour delta: the helper also counts the shop's team (`vendor_team_members`) as the other side, as hearts do,
  so a team member in a block is now held by the send guard too.
- `apps/web/tests/db/a-chat-block-sees-past-the-callers-rls.db.test.ts`: precondition (the couple really cannot see
  the shop), no block → both post, couple-blocks-shop and shop-blocks-couple → both refused, unblock → posts again.
  Sabotaged once with the old inline check: 4 of 6 red, including "the couple posted into the thread of a shop they
  blocked".

SPEC IMPACT: None — enforces the existing block rule (Apple 1.2 UGC) as already specified; no product decision changes.
