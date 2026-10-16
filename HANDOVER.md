# HANDOVER — rd/load-time-log (real-user load-time log)

Owner 2026-10-16: "can we make a page on admin that will log the loading time of each load done? or when a
loading takes more that 1.5 seconds … or when it load longer than its target loading time?"

## Decisions taken (not covered by the record — matched to locked docs/rulings)
- ONE INGEST DOOR: loads ride `/api/telemetry/client-fault` as a third body shape `{ loads: [...] }`.
  That route's own docblock forbids a second route ("the route budget is real").
- RLS: same posture as `app_fault_issues` (RLS on, no policy, REVOKE ALL from anon/authenticated);
  the admin reads through the service role behind `requireAdmin()`. An admin-read policy would be a
  widening the exposure freeze rejects (the fault-log migration documents dropping one).
- Targets: `platform_settings.load_time_targets` JSONB `{pattern: ms}`; default 1.5 s in code.
  Admin targets are clamped to 1.0–30 s, because the browser ALWAYS sends a load ≥ 1.0 s and samples
  ~10% of faster ones (weight 10) — so every load over any allowed target arrives.
- "Slow" is judged at READ time against the CURRENT target (a target change re-judges history).
- Route pattern: the browser blanks ids (`normalizePath`); the ingest maps to the app's route patterns
  (Ugat screens registry + admin routes registry); unmatched segments become `[…]`. DB CHECK is the last line.
- Signed-in flag + build SHA are stamped server-side (cookie presence; VERCEL_GIT_COMMIT_SHA).

## State
See git log. Next steps are listed at the bottom as they are done.
