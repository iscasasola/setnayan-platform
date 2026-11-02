## 2026-06-28 · feat(papic): Auto-Recap slot selection (Group B prototype)

The second pure half of the Auto-Recap renderer (pairs with the 30s FFmpeg
command builder). Picks which ≤30s of an event's captures to use.

- `apps/web/lib/render/recap-select.ts` — `selectAutoRecapSlots(candidates)`:
  divides the event timeline into equal-TIME windows and takes the best capture
  per window (most-tagged = quality proxy; ties → earliest), so the recap COVERS
  the day instead of over-sampling one busy moment. Clips clamped to the 5s cap;
  total guaranteed ≤30s; output chronological. No DB/box — the worker builds the
  candidate list from a papic_photos+photo_tags query and calls this.
- Time-windowing (not count-windowing) is deliberate: a burst at one instant
  lands in one window so it can't dominate (caught by a unit test).
- Tests: 30s budget, timeline spread vs a tagged cluster, in-window quality
  pick, clip-cap clamp, chronological order. tsc 0, lint clean.

SPEC IMPACT: None on shipped product (unimported pure module). Sharpness/exposure
scoring deferred (not computed yet) — tag count is today's signal. Plan:
`0012_papic/Render_Prototype_Oracle_30s_2026-06-28.md`.
