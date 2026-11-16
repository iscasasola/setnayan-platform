## 2026-11-16 · fix(a11y): the "How it works" demo phone is a picture, not the app

Full-page audit, 16 Nov 2026, fix list 2 (owner: *"Yes, start both"*).

The About pages' demo phone draws scenes of the app, and those scenes draw the app's buttons ("Save palette", "Render reel", "Connect Google Drive" — 17 of them) as real buttons with nothing behind them. A keyboard user could tab onto each and a screen reader announced "button" for a control that does nothing.

The scene now renders inside one wrapper that is `inert` + `aria-hidden` on a `display: contents` box: out of the tab order and out of what a screen reader reads, pixel-for-pixel the same picture. The step caption above it still says what is happening. Play/pause and the step dots are the card's real controls and are untouched. The scenes themselves are not edited (the capture scripts record them into the demo videos).

Measured: every feature currently ships a recorded video, so the drawn scene is the fallback the card shows when a video is missing — this makes that fallback correct.

Guard: `app/_components/app-store/studio-card-demo-is-a-picture.test.ts` — the scene renders in exactly one place and that place is inert; the look-alike buttons are counted so the check cannot pass empty; React is checked to write `inert`. Sabotaged twice (wrapper's `inert` removed → red; a second unwrapped render → red).

SPEC IMPACT: None.
