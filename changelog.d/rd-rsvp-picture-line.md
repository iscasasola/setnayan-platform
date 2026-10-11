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

### fix(maker): the RSVP card opens whole, its name tag off the guest's name, and a line's words have Done

- "RSVP opens with the card cut" and "the CARD label covers the guest's name" were ONE thing, measured in the lab at
  375 × 812 and 375 × 667: the stage opens with the card picked, and a second later the page sat at 122 px — the
  card's frame is drawn round the WHOLE card while the stage's centring brought up the form's own section (under the
  guest's name), so the couple's names and the date were scrolled off and the frame's tag, clamped to the visible
  top, lay on the guest's name. A picked card is now shown from its top — the hold a screen opened by its tab gets
  (`RSVP_TOP_MESSAGE`), sent a beat after the pick and to a frame that comes up while the card is picked.
- "Question has no Done": a line's words box is the RSVP panel's (over the toolbar, outside it), so the toolbar's
  typing bar never came. The panel has the stage's own typing bar for it — "Typing · Question" and Done
  (`RsvpPanelTypingBar`), shown by rule only while a box is open; Done leaves the box, which keeps.
- Guard `lib/the-rsvp-stage-shows-the-card-and-done.test.ts`, sabotaged four ways (red), restored (green).

SPEC IMPACT: None.
