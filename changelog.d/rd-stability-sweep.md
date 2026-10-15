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
