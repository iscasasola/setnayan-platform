## 2026-07-24 · fix(photo-delivery): autonomous drainer so big Drive releases stop stalling (gap audit)

Gap audit 2026-07-23 · Batch B2. A couple's "Release to Drive" copies their
Papic media to Google Drive via an after() drain on the release click — but that
drain is BOUNDED (40 ticks × 6 = 240 uploads) and no scheduler was ever wired
(`/api/cron/photo-delivery-tick` never ran). So a release of >240 photos stalls:
the job stays 'running', ~160+ artifacts keep `drive_file_id IS NULL`, and
nothing advances it without another user click.

Adds `lib/photo-delivery-drain.ts` — a CRON-FREE drainer matching every other
sweep in `admin/layout.tsx` (admin traffic + a ~10-min `claimPeriodicJob` claim).
It finds events with an unfinished delivery job and keeps calling the SAME
`processBatchForEvent` primitive the click-time drain uses — no re-enqueue (so no
duplicate jobs; `enqueueRelease` inserts a fresh job each call, so widening its
status gate was the wrong lever), bounded per invocation (≤3 events × 20 ticks)
so one admin pageview never runs unbounded Drive uploads.

Non-destructive: the batch processor keeps its own OAuth-token + retry-cap
safety, and a dead token flips the job 'failed' (ending the loop for that event).
Never throws. No migration.

Verified: tsc/lint clean.

SPEC IMPACT: None — completes an existing background delivery path.
