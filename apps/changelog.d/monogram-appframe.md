# Changelog fragment — claude/monogram-appframe

## 2026-07-17 · feat(monogram): the app frame — one-screen editor, scroll-free toolbars, draggable imagespace (owner refinement)

Owner: "make everything legible and clean … toolbars scroll-free and an imagespace for the logo that's draggable, like the Adobe Photoshop app where the overall fits neatly in a screen."

- **The editor is now a fixed app frame** (`min(100dvh−170px, 900px)`; desktop 920px cap): the canvas is the dominant, always-visible imagespace; nothing inside the frame page-scrolls.
- **Scroll-free toolbars:** desktop/tablet gets a fixed 312px right toolbar with `overflow: hidden` — verified zero overflow even with the Frame tab open and a frame applied. Card sets that outgrow a column ride **horizontal 2-row carousels** (the Photoshop tool-row grammar); the contextual letter/crossing/symbol boxes now **float over the canvas** like a contextual bar instead of pushing the sidebar past the fold.
- **Phones:** the three tabs become a **bottom tab bar** (thumb territory, safe-area padded); the active panel is a compact sheet capped at 46dvh — Letters and Reveal both measure **zero overflow** at 375×812; the canvas keeps the majority of the screen.
- **Draggable imagespace:** inside the frame there is no page beneath the canvas, so a background finger **pans the artboard again** on touch (`appFrame: true` engine mode; canvas `touch-action: none` within the frame). The D5 page-scroll politeness remains the non-frame default.
- Density pass: tighter boxes, slimmer cards, compact labels — legibility via hierarchy, not size.

Verified live at desktop (1280) and mobile (375×812): frame fits both, toolbar scroll-free in every tab, bottom tabs on mobile, carousel frame cards, style thumbnails rendering per-face in the strip.

SPEC IMPACT: None beyond the benchmark verdict's staging direction (recorded as an owner layout refinement).
