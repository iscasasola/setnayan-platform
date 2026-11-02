## 2026-07-03 · fix(marketing): fit the Setnayan AI comparator pop-up to its content

Owner: "does not stretch on popup well" — the comparator sat in the 880px default overlay card
with its content capped at 460px, leaving a dead right half. The card is now fitted
(`maxWidth: 620`) and the inner blocks (intro line, slider, results) fill it — full-width
slider + edge-to-edge bars. Verified in a local preview screenshot.

SPEC IMPACT: None.
