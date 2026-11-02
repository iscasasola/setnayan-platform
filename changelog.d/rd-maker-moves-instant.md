## 2026-10-12 · perf(maker): a drop, a step, ＋ and their ↺ show at once and save in the background

Owner, on the batch preview: after letting go of a dragged scene, a drop on the bin or ＋, the page took 3–6 s to
show it (rules: "the Maker never slow, ≤100 ms per tap, saves in the background" · "a press shows pressed and what is
loading"). Measured in the Maker lab with production latencies (`?slow=1`): the drop was slid into place at once, but
"Saving…" ran ~7.7 s, ↺ stayed grey ~6.7 s, then the whole Maker re-rendered and the canvas loaded a NEW page; every ↺
and every ＋ waited for that render and that page (≈7 s).

- A move the page already shows (the drag's slides, the tag menu's Move up · down) is saved HELD: no Maker render, no
  new page. Once the save lands the page on show redraws ITSELF in place (`CANVAS_REFRESH_MESSAGE` to that frame only),
  and the slides come off in that redraw's own commit (`CANVAS_REDRAW_COMMITS_EVENT`, fired by the bridge's
  `BeforeRedrawCommits`), so the order is never drawn twice. The bridge says `{ t: 'redrawn' }` when it has painted.
- ＋ beside a picked scene holds the part's place at once ("Adding <part>…", above / below), is saved held, and the page
  redraws with the part as soon as the save lands; the one Maker render its list still needs follows in the background
  with the canvas kept.
- ↺ of a step the page drew is drawn too (`lib/maker-drawn-undo.ts`): the move slides back, a scene taken off is shown,
  a part added is taken off — at the press — and the draft bar's save is held. A refused save or ↺ puts the page back
  and says so.
- A redraw that never answers is asked for again, then the page reloads to the truth.
- Walk F1 (2026-10-12): the gap is never scrolled off the screen once it can go no further (`sceneEdgeScrollKept`), and
  a dropped scene is brought into view (`sceneBringIntoView`). F4: the bin's word wears the bin's line.

Lab, before → after (visible after the press · page settled): drop 214 ms · 7.7 s (new page) → 252 ms · 2.1 s (no new
page) · bin ↺ 8.3 s → 176 ms · Move down 138 ms · 6.9 s → 141 ms · 2.0 s · its ↺ 6.8 s → 218 ms · ＋ 7.3 s → 80 ms
(its place) / 2.4 s (the part) · ＋ ↺ 6.9 s → 170 ms.

SPEC IMPACT: None — builds the owner's standing speed rules (DECISION_LOG / INTERACTION_RULES "the Maker never slow",
"a press shows pressed and what is loading"); no new decision.
