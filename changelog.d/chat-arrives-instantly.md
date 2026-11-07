## 2026-11-08 · feat(chat): chat arrives instantly — one private broadcast channel per signed-in person, behind a kill switch (default OFF)

Owner 2026-10-29 ("how long does it take for us to receive a chat… is this optimized already?" → yes) and
2026-11-08 ("Finish this first now"). PR #7035.

- **Database** (`supabase/migrations/20271323859288_chat_messages_ping_their_people.sql`): an AFTER INSERT trigger on
  `chat_messages` sends one content-free ping (`thread_id · message_id · at`, event `chat_message`) to each recipient's
  PRIVATE Realtime topic `user:<uid>` via `realtime.send`. Recipients = `count_unread_message_threads()` read backwards
  (couple members, shop owner, shop owner/admin team) minus the sender — O(recipients) on three keyed lookups (new
  partial index `event_members_couple_by_event_idx`). The body is wrapped so a ping can never fail a send. Gated by
  `platform_settings.chat_live_pings_live`, which the PRODUCTION app stamps from `NEXT_PUBLIC_CHAT_LIVE_ENABLED`
  (`lib/chat-live-stamp.ts`, on the booking-fee stamp's after-response scheduler): flag off → one primary-key read per
  message and nothing sent. `user_live_send()` / `user_live_pings_on()` are the one sender and the one gate, so a
  second event on the same channel (chat hearts) is one more trigger. SELECT-only policy `user_topic_owner_can_read`
  on `realtime.messages` (predicate `user_topic_is_mine`, granted to authenticated); no INSERT policy.
- **Client**: `lib/user-live.ts` (the machine: joins only while the tab is in view, 0–1.5 s jittered first join after
  paint, lets go 30 s after hidden, backoff 5 s × 3ⁿ ×0.5–1.5 capped at 5 min, gives up after 6; failures forgiven only after 60 s live, so a flapping server cannot earn endless rejoins),
  `lib/user-live-channel.ts` (per-tab singleton, `private: true`, token primed, one listener per `USER_LIVE_EVENTS`),
  `lib/unread-follow.ts` (envelope: no poll while live, a ping re-asks — coalesced to 1 leading + 1 trailing per 1 s —
  the 60 s poll whenever not live; inbox: `router.refresh()` at most once per 5 s). The envelope calls
  `followEnvelope`, which with the flag OFF is `pollEnvelope` itself — nothing live is fetched. `LiveInboxRefresh`
  mounted on the couple's Messages and the supplier's Chats pages only.
- **Guards**: `lib/chat-arrives-instantly.test.ts` (20 fake-clock + map tests, each sabotaged once),
  `tests/db/chat-pings-reach-only-their-people.db.test.ts`, the socket census and the burst guard amended for the one
  named per-user channel. Load model `apps/web/scripts/loadtest-chat-live.mts` (no network): 200 users · 50 msg/min ·
  5 min → main 1000 unread RPCs, live 947 + 200 joins + 750 broadcast rows; total Realtime outage → 755 rejoins
  spread by backoff, then today's poll.

SPEC IMPACT: None to a locked decision — the kill switch ships OFF; turning it on is an owner call recorded in the PR
body (CAPACITY + pass-bar table). Amends the 2026-10-21 "no socket in the chrome" rule with ONE named exception (the
person's own private broadcast channel, visible tabs only) — held in `lib/a-socket-only-where-something-is-live.test.ts`;
corpus DECISION_LOG row is the controller's (one writer).
