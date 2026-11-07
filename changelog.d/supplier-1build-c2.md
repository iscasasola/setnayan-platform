## 2026-11-08 · feat(supplier): THE ONE BUILD lane C2 — data (hosts, hearts, gift limit, booked loops)

Lane C2 of the supplier dashboard redesign (owner-approved prototype v113). Four migrations, allocated with
`pnpm migration:new`, each with its db test (each sabotaged once and watched red):

- `20271324946509_the_brief_names_the_hosts` — NEW internal `event_chat_hosts(event)` (couple members as
  `{user_id, first_name, name, role, label}`; joins `u.user_id = em.user_id`, emits the AUTH uid, never the
  `users.id` BIGSERIAL) and the supplier brief re-created verbatim from `20271304542745` plus a `hosts` key on every
  rung. Test: `tests/db/the-brief-names-the-hosts.db.test.ts`; the brief key-set contract gains `hosts`.
- `20271325581544_a_message_can_be_hearted` — NEW `chat_message_hearts` (RLS at CREATE, mirrors the as-built
  `chat_messages_member_read`; own-row writes; no DELETE — `authenticated`'s default DELETE grant is revoked;
  realtime on the existing publication). Its block guard is a RESTRICTIVE policy over NEW
  `chat_pair_is_blocked()` (SECURITY DEFINER, answers about the caller only), because the inline form the plan
  copied is defeated by the caller's RLS. Test: `tests/db/chat-message-hearts-rls.db.test.ts`.
- `20271326463501_the_gift_limit_is_an_admin_setting` — `platform_settings.gift_limit_pct` (default 40, CHECK
  0–100); `setnayan_gift_for_fee(BIGINT)` re-created verbatim with the 40 constant turned into a read. TS:
  `GIFT_LIMIT_PCT_DEFAULT`, `giftLimitPctOrDefault`, `setnayanGiftForFee(…, { limitPct })`. Test:
  `tests/db/the-gift-limit-reaches-the-bill.db.test.ts` (TS == SQL at 40 and 25).
- `20271327129110_a_shop_counts_its_booked_loops` — NEW `shop_booked_loop_count(vendor)`: families (keyed by their
  first booked event with the shop) who booked it on 2+ events; service_role only. Test:
  `tests/db/a-shop-counts-its-booked-loops.db.test.ts`.

SPEC IMPACT: None to the corpus from this lane (the controller writes the build's DECISION_LOG row). Flagged for
the controller: the shipped `chat_messages_block_guard` has the same caller-RLS gap (see
`build-notes/supplier-1build-c2.md`).
