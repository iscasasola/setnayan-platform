## 2026-09-11 · fix(story): a refused tap's "why" is drawn on the screen, not below it

Found by the Story's step-8 drive against the LIVE Story Maker (testnayan1, 1280×860): in Automatic, a tap on a photo shows why nothing moved — and that sentence was drawn at y≈924, below the bottom of the screen. The hint is `position: fixed`, but on the live page two ancestors make "fixed" relative to the page instead of the screen: the editor's own root (`container-type: inline-size`, which the sheet's `cqw` units need) and the dashboard's `.sn-page-enter` wrapper (the identity `transform` its entrance animation leaves behind — the trap `canvas-maker.tsx` already documents). The stand-in page steps 4 and 6 drove had neither, so it passed there: 114 of 115 live checks passed and this was the one.

- `make-it-yours.tsx` — the hint (and its Undo) is portalled to `<body>`; Cmd/Ctrl+Z from its Undo still counts as inside the editor.
- `make-it-yours.module.css` — the editor's tokens are shared with the portal's `.layer`, which inherits nothing from the editor once outside it.
- Pinned in `make-it-yours-keeps-what-the-browser-found.test.ts` (rules 24 → 25). Sabotage: removing the portal (1 → 0 `createPortal(`) → the rule reports missing 1, fail 1; restored → pass.

SPEC IMPACT: None — makes the shipped design true on the live page (10a M-R3-15 / RL-20: the explanation for a refused tap is shown where the person is looking).
