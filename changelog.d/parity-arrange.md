## 2026-06-26 · feat(seating-3d): 2D→3D parity — auto-arrange (tidy every table + seat, one tap)

An **Auto-arrange tables** button (two-tap confirm — it's destructive) tidies every
table into a stage-out grid AND seats the guests in one go. Layout via the SAME
pure solver as the 2D editor (`computeAutoLayout`, fed the lab's live table
footprints from `tableDims`), painted optimistically; the server (`autoArrange`)
persists positions + assignments, then the one-shot resync re-derives seats from
truth. No client-vs-server drift.

SPEC IMPACT: 0008 Seating — 3D lab auto-arrange parity.
