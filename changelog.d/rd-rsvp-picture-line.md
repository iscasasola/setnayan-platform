## 2026-10-12 · fix(maker): an Undo reaches the RSVP stage's canvas

- A tester, the night of the release: RSVP stage → ＋ a Message → typed → ↺ ↺. Both steps were taken back and the
  reply card on the canvas still showed the added line until the Maker was reopened.
- It was the product AND the lab. The RSVP stage re-posts its own copy of the config to its frames and nothing told
  it the draft had moved on the server; undoing the only step of a visit also left the Maker's own copy standing
  (`lib/maker-draft-store.ts` reads a render equal to its base as "nothing newer"), so the next edit wrote the undone
  line back. The lab handed the stage a constant config, so no render there could show an undo at all.
- `lib/rsvp-stage-truth.ts`: the first render that lands after a write the canvas did not draw (↺ · Restore · Reset ·
  Apply) with no RSVP write on its way is the truth — the stage drops its copy, tells its frames, re-seeds its panel.
  The lab hands the draft's own config, a new object each render (`?rsvp_const=1`: the lab as it was).
- Walked in the lab at 375 × 812, touch: as fixed (two steps back · the only step of a visit back · a new edit after
  it does not bring the line back · another stage and back) — and with the remedy switched off and with the lab as
  it was, both of which show the fault. Sabotaged four ways (red), restored (green).

SPEC IMPACT: None.
