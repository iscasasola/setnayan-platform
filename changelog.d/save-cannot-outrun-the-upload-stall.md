## 2026-08-19 · fix(upload): an upload that dies in silence now says so

A photo upload that stopped mid-transfer left the progress chip at 0% with a
spinner, forever. No message, no retry, no way back except reloading the page.

The uploader handled every failure that announces itself — a network `error`, a
user `abort`, a non-2xx response — and had nothing at all for the failure that
announces nothing: a transfer that simply stops. No event fires, so `setError`
was never called, and "still working" and "dead" rendered identically.

Adds `lib/stall-watchdog.ts`: a clock that measures SILENCE. It is reset by
every progress event, so a slow-but-healthy large upload is never killed; it
fires only when no byte has moved for 45 seconds, aborts the request, and shows
the person what happened.

Measured first, so the cause is on record rather than guessed at: the presign
endpoint answers 200 in ~0.5s and a real presigned PUT of a 171 KB file
completes in ~1s with progress events firing. R2 CORS is correct. The transport
is sound — what was missing was any way to notice when it stops.

7 unit tests with an injectable clock; 5 mutations run, 4 RED. The 5th
(the callback's own settled-check) stays green because it is unreachable by
design — `settle()` disposes the clock and `arm()` refuses to schedule after
it — which is recorded in the code rather than claimed as coverage.

SPEC IMPACT: None.
