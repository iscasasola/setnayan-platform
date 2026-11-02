# Changelog fragment — claude/monogram-frame-weave

## 2026-07-17 · feat(monogram): intertwined frames + accent frames (owner refinement of council verdict §4)

Owner direction on first look at the v2 frame shelf ("we want frames that can intertwine to each other. and accent frames also") — an explicit override of the verdict's stack-of-two/one-enclosure ruling (§4.4, §8.12):

- **Intertwine:** up to TWO band enclosures may stack, and where their bands cross they **weave over/under alternately** — the letters' dilate-and-subtract cut applied frame to frame (crossing lobes sorted by angle, alternating which band is cut, gap scaled from the thinner band). Adding a second band enclosure auto-offsets the pair apart and lands them **pre-woven**; a "⤫ Weave the two frames" toggle and an "Offset ↔" slider live in the applied box (offset 0 = concentric stack). Organic kinds (laurel/wreath/sampaguita) layer without weaving.
- **Accent class:** three new patterns — *Side sprigs* (mirrored leaf fans), *Cardinal marks* (N·E·S·W diamonds), *Sparkle pair* (asymmetric NE/SW sparkles) — a third frame class that layers WITH enclosures + corners.
- **Stack rule now:** ≤4 frames — 2 enclosures + 1 corner set + 1 accent; at cap the OLDEST of the class makes room. `MAX_FRAMES` 2→4, `weave?: boolean` on `StudioFrame`, 3 kinds added to `FRAME_KINDS` (sanitizer extended in the same PR, per the §6 binding rule). Weave output is still filled boolean geometry — export/sanitizer path unchanged.

Verified live: 15 shelf cards; ring+diamond auto-offset + pre-weave; toggle repaints the crossings; sprigs stack third, corners fourth; a third enclosure replaces the oldest only. typecheck 0 · lint clean · unit tests pass.

SPEC IMPACT: `Monogram_Maker_Council_Verdict_2026-07-17.md` §4.4/§8.12 owner-overridden (annotated in the doc) — stack of two → 2+1+1 with weave.
