# Changelog fragment — claude/monogram-frame-position

## 2026-07-17 · feat(monogram): frames are draggable + Position sliders (owner refinement)

Owner: "fixing the location of the frames can also help" — frames only auto-centered on the letters (the `tx/ty` recipe fields existed with no UI, per verdict §8.19's deferral, now pulled forward):

- **Drag a frame on the canvas to place it.** Letters keep tap priority; the frame body is grabbable anywhere its ink is, with real tolerance — paper's fill hit-testing ignores `tolerance`, so the grab uses containment + a nearest-point distance test (14/zoom), which makes thin bands (a 6-unit ring) finger-friendly. During the drag the painted paths translate directly; the boolean rebuild (weave · scallop) waits for release, so nothing re-runs per move tick. One undo entry per drag.
- **Position ↔ / Position ↕ sliders** for the selected frame in the applied box (the weave-only Offset slider is superseded; the ⤫ Weave toggle stays).
- **Tapping a frame jumps to the Frame tab** with its controls up — the same ensure-jump letters get to the Letters tab.
- Touch: the `touchstart` claim covers frame bodies, so dragging a frame on a phone doesn't scroll the page.

Verified live with a REAL pointer drag through the browser pane: grabbed the ring band, dragged +72/+48, the frame followed 1:1 and the Position sliders read exactly 72/48; a first attempt that landed 2 units inside the ring's hole exposed the fill-tolerance gap and drove the nearest-point fix. typecheck 0 · lint clean · unit tests pass.

SPEC IMPACT: verdict §8.19 (per-frame drag handles deferred) owner-pulled-forward; annotated.
