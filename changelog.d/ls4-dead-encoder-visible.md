## 2026-09-03 · feat(live-studio): a dead encoder is now visible on the controller

`getYoutubeStreamStatus` (lib/panood-youtube.ts) has existed since Wave 9,
costs 1 quota unit, and had zero callers — YouTube knows within ~10s when a
couple's encoder (OBS today) stops sending frames; the controller said
nothing, and the operator found out from a guest. Wired end to end:

- `lib/live-studio-ingest-health.ts` — pure decider, four named states
  (`waiting_for_encoder` · `receiving` · `degraded` · `no_data`), poll
  interval derived from the documented quota ceiling (150s, arithmetic in the
  file), staleness threshold that never lets a cached "active" reading render
  as still-fine.
- `lib/live-studio-ingest-health-server.ts` — the read. Read-only (never
  checks a pool channel out), fails honest to `streamStatus: null` on any
  error rather than guessing.
- `app/api/live-studio/ingest-health/route.ts` — host-gated polling endpoint
  (`isLiveStudioSetupHost`, same predicate the controller page itself uses).
- `app/panood/control/[eventId]/_components/ingest-health-strip.tsx` — the
  render. Persistent, beside the transport row, mounted only when a
  Setnayan-managed broadcast exists (`liveAir.source === 'broadcast'`).

Correct under OBS today and under any future encoder (native desktop, relay)
per `Live_Studio_Encoder_Scope_2026-09-03.md` §7 — this is that document's own
recommended first slice.

SPEC IMPACT: None — this reports a fact the product already had access to and
never read.
