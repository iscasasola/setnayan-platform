## 2026-07-09 · feat(panood): source multiview — every camera live in the control-room rail

Phase 2, PR #3. Extends the walking skeleton so the control room shows **every** publishing camera live, not just the PROGRAM feed: `SourceTileBody` renders a `<video>` for each camera's stream, threaded through both the desktop `SourcesRail` grid and the mobile camera strip. The viewer (`watchPanoodCameras`) already collected every camera's stream — this just renders them into their tiles (multiview).

Flag-gated behind `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED` (default OFF) — inert in prod (tiles show the icon placeholder). The "video tiles are placeholders" honesty banner now hides once real streaming is ON.

SPEC IMPACT: None — controller build per `Live_Studio_Repackaging_2026-07-08.md`.
