## 2026-11-17 · fix(memories): a chapter heading link presses at 44px

From the couple-dashboard audit (memories-lab at 390px): each event chapter on the Memories wall ("Cale & Ice · 12") is a link whose box was its 12-px text line — a **16-px press** inside a 56-px row. `memories-chapters.tsx` › the heading `Link` gains `py-3.5` (16 + 28 = 44), inside the row's existing `min-h-14`, so nothing moves.

SPEC IMPACT: None
