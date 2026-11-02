# Changelog fragment — claude/monogram-drag-perf

## 2026-07-17 · fix(monogram): letter drags stop re-running frame geometry per tick (owner: "dragging ink is lagging")

`fast()` — the per-drag-tick redraw — was rebuilding the frame layer on every pointer move so auto-fit could follow the letters live. With a weave or scallop applied that meant boolean geometry (unite/intersect/subtracts) re-running every ~8px of movement: dragging a letter through a woven ring+diamond stuttered hard.

Frames now hold still during the gesture and re-fit ONCE on release (`full()` → `drawFrames`). Verified live on the heavy case (woven ring + diamond): a real pointer drag of the letter M produced **zero long tasks during the drag** and exactly one ~240ms geometry pass at release (PerformanceObserver longtask probe); frame drags likewise. The one release hitch is the honest cost of the weave recompute.

SPEC IMPACT: None.
