## 2026-06-28 · feat(papic): adaptive capture quality on weak venue WiFi

Group A · PR A2 — the last Group-A piece. Capture encode quality now adapts to
the connection so photos/clips upload reliably on congested wedding WiFi.

- **`lib/papic-adaptive-quality.ts`** (new) — picks a tier (`full` / `reduced` /
  `queue_only`) from a rolling EMA of measured upload throughput
  (`recordUploadSample` fed by every successful PUT/POST), falling back to the
  Network Information API (`navigator.connection`) as a cold-start hint and
  optimistic `full` when nothing is known (iOS Safari has no NetInfo, then
  self-corrects from the first sample).
- **Photo:** the DELIVERY JPEG drops to q0.72 on a weak link; the clean
  face-embed frame stays at full fidelity so face descriptors aren't degraded.
- **Clip:** `MediaRecorder.videoBitsPerSecond` caps at ~2.5 Mbps on a weak link
  (undefined = browser default at full).
- **`queue_only`:** when the link is effectively unusable, the capture skips the
  doomed live upload and hands the (reduced-size) shot straight to the offline
  queue (PR A1/A1b); the foreground drain uploads it once throughput recovers.
- Wired into both surfaces (seat + per-guest camera), photo + clip paths.
- Unit tests (`papic-adaptive-quality.test.ts`): throughput→tier thresholds,
  EMA blending, degenerate-input guards, per-tier encode params. 12/12 papic
  unit tests green; typecheck + lint clean; prod `next build` green.

SPEC IMPACT: None — implements 0012's already-spec'd adaptive compression
(strong/medium/weak presets) + the weak→queue-only behavior. Completes Group A
of the Papic completion program ([[project_setnayan_papic_completion_program]]).
