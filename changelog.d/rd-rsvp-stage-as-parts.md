## 2026-10-08 · feat(maker): the RSVP stage is parts — Form · When yes · When no, each pickable, never live

Owner, on the Maker's Stages › RSVP (preview checks 07–08 Oct, verbatim): *"RSVP cannot select anything"* · *"it is the
actual RSVP not an editing way"* · *"no way to access yes and no response"* · *"yes and no page for the rsvp is to show
what the rsvp looks like after the reply yes or no"*. The stage drew the real reply form with its fields inert
(345e598f8) and nothing on it could be picked: no frame, no name tab, no tools.

**What changed (new Maker, phone, behind `makerStagesStudioEnabled`; the guest's reply pages are byte-for-byte unchanged).**

- **Markers, canvas only.** `invite/reply` marks the guest's own name (`f:greeting`) and the form with its reply-by line
  (`f:rsvp`); `invite/enter` marks the couple's note (`f:yesnote` / `f:nonote`) and the ticket (`f:pass`) — the shipped
  `<span hidden data-maker-section>`, each behind the host-verified `canvas`. The masthead (`DoorShell`: the mark, the
  eyebrow, the names, the date, the place, the couple's invitation line) is the hero's parts: named by the canvas bridge
  itself (`stampRsvpCanvas`), so the door every guest is served is not edited. `MAKER_PARTS.yesnote` / `nonote` have
  canvases; the two after-screens list the mark, the names and the invitation line as parts too.
- **A tap picks; nothing is live.** `rsvp-canvas-bridge.tsx` stops EVERY click before React (no link, no button, no
  field — the one-question walker's Next included) and says which part was tapped (`rsvpPick { key, el }`, the pair the
  Event Hub canvas posts with its `edit`). ⚠ Under the RSVP stage's own message names: the work area stays mounted
  beneath this stage and answers `edit` from any frame — it would move the Maker's selection and close the stage.
  A tap on the ground lets the part go. The submit stop, the inert fields and `submitInviteReply`'s sample-guest refusal
  all stand.
- **The frame.** `PartEdits` / `partBox` / `centrePart` / the drawn-order read take the frame the page is in — on the
  RSVP stage, `iframe[data-rsvp-stage-frame="<screen>"]:not([hidden])`; `rsvpOpen` is out of the frame's gate, so the
  outline, the name tab, ↑ ↓ ✕ and the gap-middle ＋ are the ones every stage has. Tiles are only the parts the screen drew.
- **The tools are the picked part's.** The form and the two notes open the stage's own controls under "Edit the RSVP ·
  Studio ›"; the mark, the names, the date and the place show their own door (Logo · Info · Suppliers); each guest's own
  name, their ticket and the fixed opening words show their name and ⓘ.
- **Tabs as pages.** The tab bar reads Form · When yes · When no with the prototype's icons (reply · check · x). A tab
  lets the picked part go, the stage says which screen is on show (the label follows it, never a guess), and a kept
  screen is put back to its top and held there until the couple moves it (`rsvpTop`, on `hub-tab-dom.ts`'s hold).
- **Typing is a second tap.** The Maker tells the screens which part is picked; a tap on the words of THAT part
  (`makerStageMayType`, asked on the page in the tap itself) puts the caret in them; each keystroke goes into the RSVP
  panel's own save (`RSVP_WORD_TYPED_EVENT` → `saveWord` — one value, two doors; drafted, published only at Apply),
  under the one "Typing · … Done" bar. A first tap only picks. Outside the new Maker a tapped word still opens its box.
- **The "When no" sample has no ticket** (a real "no" never has one; the sample has no row to read that from).

New words (host-only, behind ⓘ): "Every reply page opens with these words." (the Title on the form) · "Your invitation
line. You type it on the Invitation’s Welcome page." (the line on the after-screens).

Guard: `lib/the-rsvp-stage-is-parts.test.ts` (19 tests, each seen red by sabotage); `the-stage-pages-are-the-prototypes`
names the three masthead parts added to the after-screens.

SPEC IMPACT: `STAGES_PANEL_BUILD_STATUS_2026-10-08.md` — "Round 5 — RSVP as parts" (corpus, this PR's status section).
