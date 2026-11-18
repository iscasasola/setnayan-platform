## 2026-11-18 · perf(launch): the Maker starts the event entitlement read beside the other early reads

The Hub Maker page (`/launch`, and `/prints`, which renders it whole) awaited `eventEntitlementClient` only after the viewer read — one database trip in single file. It now starts with the other event-only reads and is awaited at the line that always awaited it. No read added, no screen changed.

MEASURED, same day: a production build of main gives `/prints` and `/launch` the SAME client JS (1,407,391 vs 1,407,392 B raw across 34 files; page entry 218 B vs 219 B; first-load 430 kB each), so the slowness is server render depth, not bundle size. `/prints` rendering the Maker page whole is NOT changed here (the canvas registers the draft door into the shell — see the PR's owner question).

SPEC IMPACT: None.
