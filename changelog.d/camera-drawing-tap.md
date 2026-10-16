## 2026-10-15 · fix(maker): a tap on the Camera page's drawing picks the Camera

The Camera page's stand-in drawing carried no Maker marker, so a tap on it sent nothing (only its tile picked it).
`stage-tools.tsx` now binds the stand-in like the Reveal's drawing: a tap calls `pickRef.current('camera')`. One source guard added.

SPEC IMPACT: None
