## 2026-10-15 · fix(stability): the stability sweep — production's own fault log, worked from the top

Owner, 2026-10-15: "speed and stability fix". Every open issue in `app_fault_issues` seen in the last
seven days was read and ranked by guest/couple impact × frequency; each fix below names the issue it
closes, and each has a guard that was sabotaged once (break → red → restore → green).

### 1 · `DB_UNREACHABLE platform_settings — TypeError: fetch failed` (116 hits in 34 h) + `rpc/record_app_fault` (5)

Not a read at all. Vercel's log carries `[booking-fee-minting-stamp] stamp failed: TypeError: fetch
failed` beside it: the cold-start PATCH that tells the database whether this build makes booking fees
(`lib/booking-fee-minting-stamp.ts`, owner 2026-10-13) was fired and forgotten from `register()`, frozen
with the instance once its first response went out, and found its socket dead when the instance woke.
First seen 06:47 on 2026-10-14, one minute after the first production deploy that carried it. The stamp
is now AWAITED inside `register()` (which Next awaits before the first request) with a 1.5 s ceiling, the
write is aborted rather than abandoned at the ceiling, and a transport failure is retried once (the
write is idempotent). The recorder now keeps undici's cause (`UND_ERR_SOCKET: other side closed`) on
every `DB_UNREACHABLE`, so the next "fetch failed" says why. Guards:
`lib/booking-fee-minting-stamp.test.ts`, `lib/telemetry/every-failure-is-recorded.test.ts`.

SPEC IMPACT: None.

### 2 · `GuestPageDidNotLoad: slug/invitation-body: event_wish_items did not answer in time` (2026-10-15 08:50)

A guest saw "This invitation didn't load". Vercel's log for that minute shows a genuine Supabase stall
(`/api/health/deep` → `supabase_timeout` five times in seven seconds; `/vendor-dashboard` took 18.8 s) —
but on the first render only ONE read lapsed: the Welcome door's open-wish count, whose own caller
already answers "unread → name no list". It is now a decoration read (`lib/read-limit.ts`
`DECORATION_READS`): alone it leaves its line out instead of taking the invitation down. Every other read
stays essential; the event read itself still fails honestly. Guard: `lib/read-limit.test.ts` § 2c.

SPEC IMPACT: None.

### 3 · `DB_READ_REFUSED GET events — 22P02 invalid input syntax for type uuid` (75 hits)

Vercel's log named the pages: every crawl of a `/realstories/<sample>` story sent
`events?event_id=eq.sample-jack-and-jill`. `EditorialContent` resolves its words through
`resolveProfileByEvent` before any of its sample guards, and `readEventTypeRow` asked twice (its refusal
path retries without the new column). The one shared reader now answers a non-uuid exactly as an absent
row, without asking (`lib/event-type-profile.ts`, `isUuid`). Guard:
`lib/a-sample-story-asks-the-database-nothing.test.ts` (also proves a real uuid still reads).

SPEC IMPACT: None.

### 4 · `DB_ZERO_ROW DELETE event_category_decisions — the write matched no row` (1 hit, 2026-10-15 15:00)

Undoing a supplier lock clears the category's `complete` decision — "deleting an absent row is a no-op",
says the code — and clearing an already-clear decision is the cleared state. RLS's DELETE and SELECT
doors on that table are the same policy (`current_event_ids`), so "matched nothing" there cannot be a
silent refusal. Both cleanups now carry `ABSENT_IS_FINE_HEADER` (`lib/supabase/db-error-log.ts`), which
excuses a zero-row DELETE and never a PATCH. Guards: `lib/telemetry/every-failure-is-recorded.test.ts`
(the mark excuses only a marked DELETE; the mark sits only on a DELETE chain).

⚠ `DB_ZERO_ROW DELETE event_schedule_blocks` (6 hits, 2026-10-14) is deliberately NOT marked: that table
lets a moderator with view-only access SELECT what it cannot DELETE, so a zero-row delete there can be a
refusal in silence — the case the fault exists for. Its request logs are past Vercel's retention.

SPEC IMPACT: None.

### 5 · A failed `platform_settings` read was remembered for an hour as the admin's choice

`lib/brand-settings.ts` and `lib/loader-settings.ts` — the two settings reads on every page, both already
cached (`unstable_cache`, 1 h) — RETURNED their defaults from inside the cache when the read failed, so
the data cache kept the gold defaults / stock loader for an hour. The house rule
(`lib/global-settings-cache.ts`) is "a refused read is never remembered": the failure now throws inside
the cache (nothing stored; a stale entry keeps serving) and the default is used for that one request.
Guard: `lib/a-failed-settings-read-is-never-remembered.test.ts` (AST of each cached loader).

SPEC IMPACT: None.
