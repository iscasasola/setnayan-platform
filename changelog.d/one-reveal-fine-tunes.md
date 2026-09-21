## 2026-09-21 · feat(monogram): one reveal, at the bottom — and it fine-tunes

Owner: *"please add that fine tune on the lower part reveal which will be the official reveal"* ·
*"on the upper editors should both not have reveal. just the one at the bottom."*

- The official reveal (row 3, `animate-rows.tsx`) gains a **Fine-tune** fold — Speed · drawing pace,
  Delay · between letter starts, Smoothness — the studio's three sliders with the same ranges
  (`REVEAL_FINE_TUNE`). Folded shut by default; a slider replays the effect when let go; "▶ Play the
  reveal" inside.
- The save stores them: `commitMonogram` takes `timing`, resolved by `resolveRevealTiming` (clamped to
  the slider ranges; a preset's name only when the numbers are that preset, else `custom`). The page
  starts the sliders at the saved values.
- The studio's **Reveal tab** is hidden (with `#animbox`, already hidden) — kept in the DOM because
  engine.ts walks all three tabs; Letters · Frame stretch to fill. The uploader already had no reveal.
- Verified in a browser harness with the real component and markup: Reveal tab `display:none`, panel
  hidden, sliders start at the saved 6.0s / 0.3s / 90%, a moved slider replays at the new timing, and
  Apply sends exactly the slider values. Guard `lib/one-reveal-fine-tunes.test.ts` (5), sabotaged 3 ways
  (tab visible · save ignores sliders · no clamp), each caught.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-21 🎚 row — amends the same day's "four rows" ruling: the three
Fine-tune sliders return, in the official reveal only.
