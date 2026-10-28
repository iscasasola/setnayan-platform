# HANDOVER — "chat arrives instantly" (paused 2026-10-29, controller asked: Mac load ~15, account ends tonight)

(`HANDOVER.md` at the repo root is a TRACKED file from another build on main — not overwritten; this is the handover.)

Branch `claude/chat-arrives-instantly` · worktree `~/Documents/Claude/Projects/wt-chat-instant` (pnpm install done) ·
draft PR labelled `do-not-auto-merge`, auto-merge disabled. **DELETE THIS FILE before the PR leaves draft.**
Model: Opus · effort: high.

## State — what is written (WIP, NOTHING RUN YET)
| File | State |
|---|---|
| `supabase/migrations/20271296339552_chat_messages_ping_their_people.sql` | written (allocated with `pnpm migration:new`). Partial index `event_members_couple_by_event_idx`; `chat_message_recipient_ids(event, vendor, sender)` SECURITY DEFINER, REVOKEd from anon/authenticated; AFTER INSERT trigger `chat_messages_ping_recipients` → `realtime.send({thread_id,message_id,at}, 'chat_message', 'user:<uid>', true)` per recipient, guarded by `to_regprocedure` + `EXCEPTION WHEN OTHERS` (never blocks a send); predicate `user_topic_is_mine(text)` (INVOKER, GRANT authenticated); SELECT-only policy `user_topic_owner_can_read` on realtime.messages (no INSERT policy). |
| `apps/web/tests/db/chat-pings-reach-only-their-people.db.test.ts` | written, **never run** (the run was queued on the heavy lock and stopped). Stubs `realtime.send` in its own DB. Its last test reads `lib/user-live-channel.ts`, which does not exist yet → fails until step 1. Check `chat_thread_reads` has a UNIQUE (thread_id, user_id) for its ON CONFLICT. |
| `apps/web/lib/chat-live-flag.ts` | `isChatLiveEnabled()` ← `NEXT_PUBLIC_CHAT_LIVE_ENABLED` via `envFlagEnabled`. DEFAULT OFF. |
| `apps/web/lib/user-live.ts` | pure state machine `createUserLive({transport, env, random})`: joins only while visible, leaves after 30 s hidden, first join jittered 0–1.5 s, on CHANNEL_ERROR/TIMED_OUT/CLOSED tears down and retries with exp backoff + full jitter (2 s ×3ⁿ, cap 5 min), gives up ('off') after 6; `coalesce(fn, gapMs)` folds a burst into 1 leading + 1 trailing run. Not yet type-checked. |

## Decisions so far (and why)
- **Broadcast from DB, not postgres_changes** (owner cost bar; 18 Oct audit). Ping carries ids only; client re-reads the SAME honest RPC `count_unread_message_threads` → never a false 0, no content leak.
- **Recipients = `count_unread_message_threads` read backwards**: couple members (event_members.member_type='couple'), vendor_profiles.user_id, vendor_team_members role owner/admin; minus sender. chat_messages carries event_id + vendor_profile_id → no chat_threads read. Agents/viewers/guests are NOT pinged (their badge doesn't count the thread).
- **Open thread stays on its existing postgres_changes** (unchanged; another builder is moving the supplier thread page to ChatBox — do not edit thread pages). Moving the thread onto pings = follow-up.
- **Bell stays a 60 s poll** (chat only).
- **Many tabs:** one channel per tab (module singleton) and ONLY while visible → connections ≈ windows in view (typically 1). Cross-tab leader election (Web Locks + BroadcastChannel) considered, not built — next step if the controller wants a hard 1.
- **Kill switch = env flag, default OFF**: the real-Realtime DB-load bar (200 users) cannot be measured here (no Docker → no local Supabase/Realtime). Ship with the flag OFF and say so (controller: "If any bar fails, ship with the flag OFF and tell me what failed").
- Reconnect jitter planned in `lib/supabase/client.ts`: `realtime: { reconnectAfterMs: (t) => ([1000,2000,5000,10000][t-1] ?? 10000) * (0.5 + Math.random()) }` — mind the shared-bundle budget (201.8/202 KB on #6752).

## Exact next steps
1. `lib/user-live-channel.ts`: `subscribeUserLive(supabase, userId, listener)` — per-tab singleton → `createUserLive` with transport: `getSession` → `supabase.realtime.setAuth(token)` (supabase-js does not set it on INITIAL_SESSION; panood-webrtc.ts does this) → `supabase.channel(\`user:${userId}\`, { config: { private: true } }).on('broadcast', { event: 'chat_message' }, m => onPing(m.payload)).subscribe(onStatus)`; close = `removeChannel`. (The db test regex expects exactly this shape.)
2. `lib/unread-polls.ts`: add `followEnvelope({supabase, userId, onValue, live = isChatLiveEnabled()})`: `if (!live) return pollEnvelope(...)` (the gate); else poll runs in joining/down/off, stops in live/paused; reread (coalesced 1 s, `readUnreadMessageThreads`, null never drawn) on ping, on →live, on →down. `app/_components/unread-messages-badge.tsx` imports `followEnvelope` instead of `pollEnvelope`.
3. `app/_components/live-inbox-refresh.tsx` (client, renders null): flag-gated, dynamic-imports user-live-channel, `router.refresh()` coalesced ≥5 s on ping; catch-up refresh on live after down/paused. Mount on `app/dashboard/[eventId]/messages/page.tsx` and `app/vendor-dashboard/customers/page.tsx` (NOT thread pages).
4. Guards: update `lib/a-socket-only-where-something-is-live.test.ts` (LIVE += user-live-channel.ts; LAYOUT_MAY_REACH += it with gate `/if \(!live\) return pollEnvelope\(/` in unread-polls.ts; envelope regex → followEnvelope; docblock: owner 29 Oct amended "the chrome is not live" to ONE per-user broadcast channel, visible-only) and `lib/the-unread-badge-asks-once-per-burst.test.ts`. New `lib/chat-arrives-instantly.test.ts`: one `user:` channel file + private; no file under `app/[slug]` reaches user-live-channel (import walk); fake-clock tests of createUserLive (hidden→leaves at 30 s, visible→rejoins, failure backoff jittered + gives up at 6, own-close CLOSED ignored), followEnvelope (flag off = no channel; live = zero poll reads over 5 min; down = poll at 60 s; null read never drawn). Consider a `flag-chokepoint-scan.test.ts` registry entry. Sabotage each once.
5. Run (heavy lock, ONE at a time): the new db test + `realtime-policy-predicates-are-callable`, `ugat-schema-claims`, `ugat-concept-coverage`, exposure freeze; regenerate baselines (port, Ugat screens, exposure, design-rules) — never hand-merge; all `apps/web/scripts/lint-*.mjs` + `check-ugat-screens.mjs`; unit tests from `apps/web`.
6. Measure (lab, realtime stub like `~/Documents/Claude/Projects/shots-2026-10-21/live-conn/work/scripts/stub.mjs`): sockets/channels per page before/after, poll requests per 5 min live vs down, join after first paint, stub-ping → badge redraw ms (390, Chromium + WebKit). PGlite: per-insert cost with vs without trigger. Commit a localhost-only load script (`scripts/ci-chat-live-load.mjs`). Request math for 200 users + 50 msg/min (main: 200 envelope RPCs/min; after: ≤ online recipients of 50 msgs, coalesced).
7. Screens 375/390/768/1280 light+dark (badge unchanged visually) → `~/Documents/Claude/Projects/shots-2026-10-29/chat-instant/`.
8. Changelog fragment `changelog.d/claude-chat-arrives-instantly.md`; corpus DECISION_LOG "AS BUILT" row via a separate corpus worktree off origin/main (pull --rebase, add only that file, push).
9. PR body: Rule-0 table, pass-bar table (✅/⚠/❌), timing table, DB-load numbers, CAPACITY section, push-notification report, check card.

## Pass bars (controller, owner verbatim) — each needs a number in the PR body
1. DB load: 200 signed-in + 50 msg/min — DB CPU/time + connections ≤ main; no new postgres_changes; trigger O(recipients). ⚠ real-Realtime measurement impossible here → flag OFF.
2. Requests: no new per-page polling; 60 s poll only when channel is down; reconnect backoff + jitter; one channel per user (or a cap); join after first paint.
3. Failure: Realtime down/slow = today's behaviour (poll), no console errors, no retry storms, no blank badges; kill-switch env flag (default ON only if bar met, else OFF).
4. Guests: zero Realtime from `app/[slug]/**` (guard); `the-guest-hub-stays-cacheable` green.
5. Load test script committed (localhost-only) + before/after table.
6. (Owner "millions") connect ONLY while foreground + signed in (grace on hidden, reconnect on visible; idle = 0 connections); CAPACITY section. Supabase Realtime limits (docs, read 2026-10-29): concurrent connections Free 200 · Pro 500 · Pro no-cap/Team 10,000; messages/s 100 · 500 · 2,500; channel joins/s 100 · 500 · 2,500; 100 channels/connection. Benchmarks: broadcast_changes 80k users @10k inserts/s median 46 ms, p95 132 ms; postgres_changes is single-threaded with RLS (Micro+RLS: 3,000 clients, 3,000 msg/s max). This project's plan is unverified (max_connections 60 ⇒ Micro compute). Gotchas: realtime.send needs today's realtime.messages partition (created by a connecting client); Broadcast-from-DB reads realtime.messages through a publication/replication (watch `pg_replication_slots`). Past the limit (describe only): web/APNs push for backgrounded users, a dedicated pub/sub tier, a fan-out queue.

## Rule 0 (measured on origin/main cd137db2ee)
- EXISTS: open thread live via postgres_changes (`app/_components/chat-message-stream.tsx`); envelope = 60 s `startCountPoll` via `pollEnvelope` (`lib/unread-polls.ts`, `lib/tab-return.ts` COUNT_POLL_MS); honest null-read `readUnreadMessageThreads`; private-channel pattern `call_rtc_can_access` (20271118012278) + grant guard (20271187719883); census guard `lib/a-socket-only-where-something-is-live.test.ts` (#6752, 21 Oct: no socket in the chrome).
- MISSING: any per-user channel; any `realtime.send` (first Broadcast-from-DB use in the repo); inbox rows refresh only on navigation.
- DELTA: the files above.

## Not done yet
- Push-notification report (brief step 5, report only): grep `push|APNs|FCM|web-push|Capacitor|PushNotifications|serviceWorker` across apps/ and src-tauri.
