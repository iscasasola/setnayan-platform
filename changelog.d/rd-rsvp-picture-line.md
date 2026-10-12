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

### feat(rsvp): the picture line — ＋ "Heading · Message · Picture"

- The owner's ruling of 2026-10-09 (`Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md` § 3, the approved
  prototype `maker_rsvp_add_drag_group_2026-10-09.html`), built to the four decisions of 2026-10-12 (DECISION_LOG):
  (a) the shipped scene upload — the file lands in the event's `scene-background` folder and counts in its 100 MB;
  (b) free; (c) decorative, `alt=""`; (d) a file that is gone draws nothing.
- Reader: an added line `{ id, k: 'p', p }` is kept only with a ref into an event's own scene-background folder
  (`lib/rsvp-picture-ref.ts`); its look is Look (`l: 'tall'`) and Build in only. The ref cap is 240 (the upload route
  can mint 238).
- Look: Style › Look ▾ Wide (112 px, nothing stored) · Tall (176 px, one rule in the page's one <style>).
- Drawing: the reply page, the Event Hub's reply sheet and the page after a reply sign the files once
  (`lib/rsvp-pictures.server.ts` — asked of storage first; a gone file is left out and nothing is drawn); the Maker's
  canvas shows a new picture at once from the picked file. Apply holds a picture outside this event's folder.
- Chooser: ＋ › Picture opens the shipped uploader in the app's sheet; only the landed ref makes the ONE add (one undo
  step; never an empty picture line). Edit on a picture: Replace, and the same last row.
- Walked in the lab (375 × 812 and 375 × 667, upload stood in): ＋ › Picture › upload → the picture at once, 112 px,
  `alt=""`; Look ▾ Tall → 176 px; ↺ ↺ → gone and the draft empty. The walk found two faults, both fixed: one upload
  made TWO picture lines (the uploader reports from inside a state update, run twice in development — each ref is
  now handed on once), and after ↺ ↺ the toolbar kept the gone line picked (a picked added line or group the truth
  no longer holds is now let go).
- Guards: `lib/the-rsvp-picture-line.test.ts` (8 sections), `couple-media-cap-is-enforced.test.ts` § 2c; the room
  fixture carries a real picture ref and look.

SPEC IMPACT: None — built to the locked record and the 2026-10-12 DECISION_LOG row; no corpus edit needed.
