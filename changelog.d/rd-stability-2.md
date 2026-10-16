## 2026-10-16 · fix(stability): stability sweep 2 — nothing network at server start; one retry for a connection that never opened

Follow-up to #6571, from production's fault log after it went live (`e14cca1`).

### 1 · The booking-fee minting stamp runs after a response, never at server start

#6571 awaited the stamp in `register()` with a 1.5 s ceiling. Production then read
`DB_UNREACHABLE platform_settings · AbortError: This operation was aborted` 57 times in 12 h, beside
`write ETIMEDOUT` and `ECONNRESET … before secure TLS connection was established`. The database was
never slow: `pg_stat_statements` shows that very UPDATE at 0.8 ms mean, 98 ms max over 378 calls. The
instance's start-up is run and FROZEN before it serves anyone, so a network call there is suspended
mid-flight and its ceiling has long passed when it wakes. The stamp now leaves `instrumentation.ts`
entirely: the root layout calls `scheduleBookingFeeMintingStamp()` (`lib/booking-fee-minting-stamp.server.ts`),
which hands it to Next's `after()` once per instance — after the response, inside `waitUntil`, on
nobody's wait. A write that did not land is retried by a later request (at most 3 per instance); never
during `next build`; never outside production. Its ceiling is now 10 s, so an abort is a real failure.
Guard: `lib/booking-fee-minting-stamp.test.ts`.

SPEC IMPACT: None.

### 2 · One immediate retry for a connection that failed — only where sending twice cannot do anything twice

#6571 made `DB_UNREACHABLE` keep undici's cause, and the causes are now visible: `ECONNRESET … before
secure TLS connection was established` and `write ETIMEDOUT` on `rpc/record_app_fault` (a POST, which
postgrest-js never retries) and `platform_settings`. `createLoggingFetch` (`lib/supabase/db-error-log.ts`),
the one fetch every server Supabase client rides, now tries ONCE more, at once, on a fresh connection,
when the request never left (refused, DNS, connect timeout, reset before TLS — any method), or when the
connection dropped after it may have been sent and the request is a READ (GET/HEAD). Never an abort,
never a stream body; a failure the retry absorbed is a warning line, not a fault. Guard:
`lib/supabase/a-connection-that-never-opened-is-tried-again.test.ts`.

SPEC IMPACT: None.
