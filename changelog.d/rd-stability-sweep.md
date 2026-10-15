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
