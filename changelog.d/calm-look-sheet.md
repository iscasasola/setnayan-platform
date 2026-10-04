## 2026-10-04 · fix(maker): the Look sheet is calm — half height with the page visible, no in-sheet Save, no captions, dropdowns, one slim header

From the owner's live iPhone test (prod 30f9154, 5 Oct 00:11–00:14) of "Finish your Event Hub → Save the Date · 3 of 6 → Look".

- **Half height, every step.** The guided step's sheet (`MakerHalfSheet`) rests at half (≤ 50% of 375 × 812) and a sheet dragged up comes back to half on the next step (`restOn`). With the header down to one row, the field now gets the half sheet's room.
- **One slim header.** On a phone the step sheet's header row is the step ▾ ("Save the Date · 3 of 6 ▾", with All items as its last row) · Peek · ×. The progress bar, the All items button, the "SAVE THE DATE" eyebrow and the second "Theme" title are gone (`MakerHalfSheet` `head`; `GuideTop inSheet`). The desktop line is unchanged.
- **No Save inside Look.** Font › Typeface and Colours (page colour, Art direction, Magic Move) save into the draft as you go: a new `DraftsAsYouGo` sends a change through the form's own action after a short pause. It sends nothing on opening and nothing for an unchanged form, and it waits for a draft already on its way. Same `updateSiteColors` draft door, no new server action.
- **No captions under controls.** Removed: the step's "where it shows" line (all steps), the theme blurb, "Event Hub Pro — Apply will ask for it.", "Drafted — Undo steps it back…", "Until you pick a colour…", the Magic Move paragraph and each option's note, "Guests who have asked their phone for less motion…", the palette's "Styles 'Our colours'…" line (`PALETTE_STYLES_LINE` deleted), and Background › None's line. Accessible names are kept, and the theme (i) now also says "Undo steps it back, Apply puts it live".
- **Dropdowns.** Art direction (Daylight · Candlelight) and Magic Move (Nothing travels · Your monogram travels down the page) are each one `PickMenu` posting a hidden field, with the ◆ beside the name. `MAGIC_TRAVELLER_NOTE` was deleted.
- **One segmented control.** "Your page / All themes" is `ISegmented` with the wine segment.
- **Theme ▾ showing only Classic · Modern · Cyber Neon is deliberate.** That is the app-store shell (Capacitor iOS app): `tilesShown` hides Pro themes there under App Review 3.1.1 (owner decision 2026-09-05). On the web all ten are listed, Pro ones marked ◆, tried here and paid at Apply.
- Guard: `lib/the-look-sheet-is-calm.test.ts` (7 tests, each sabotaged red → green). Updated: `the-look-is-one-panel`, `details-guided-flow`, `a-free-section-tries-every-look-control`, `the-mark-travels-or-sits-still`, `one-panel-at-a-time-on-a-phone`.
- The dev lab (`/dev/details-lab?look=1`) draws the real Font and Colours parts, and each draft is recorded in `window.__labDrafts`.

SPEC IMPACT: None. This applies standing owner rules (INTERACTION_RULES §8; DECISION_LOG 2026-10-04 "FOUR FIXES BEFORE BUILD" and "ONE SEGMENTED CONTROL").

## 2026-10-04 · fix(maker): one layout for every guided step — every step's field in its sheet, no Save, one title per stage, the stage's page behind

From the owner's question "why are there so many inconsistencies" (live iPhone walk of "Finish your Event Hub" on maria-and-jose).

- **One step layout (`lib/guided-step-layout.ts`).** Every step is a half sheet with one header row (step ▾ · Peek · ×), then the step's field, then Back · Skip · Next. No heading, eyebrow or "unlocks" row sits between them.
- **One rule for what sits behind the sheet, per stage.** On a phone it is the page the stage produces, in the draft, at the part the step fills (`#site-story`, `#site-details`, `#site-entourage`):
  - Save the Date, Invitation and The Day show that stage's page (`?phase=`).
  - RSVP shows the reply page as an un-replied guest.
  - Exceptions, where the subject exists only in its own tool: Your logo shows the logo itself, Seat plan shows the floor plan, and Cover photo shows the cover photo itself (the page lays the invitation card over it), falling back to the page when there is no photo. The launch page now signs the drafted cover.
  - This removes the 5×7 print card behind names and date, and the Love Story studio with its "Change it in Event Details" line. That line is also gone from the studio in the Maker.
- **Logo step.** "Do you want a logo?" is now the step's field, in the sheet. It no longer sits in a strip over the logo, which on the phone hides in the flow. In the flow the logo studio hides its editor guide lines (`data-logo-guides`), fits the half above the sheet, and clips to its own frame. `AnswerPicker` now follows its saved value, so the two places agree.
- **No Save in any step (all draft as they change).**
  - Names, the one-name editor, ceremony time and venues use `AutoDraft`, which sends only a change after a 0.9 s pause.
  - The date in a step is `GovernedFields` `embedded`: its row is open, a pick is checked against booked suppliers and drafted on its own, and a clash still asks "Apply anyway". The record page keeps "Check & save".
  - RSVP's reply-by is the one live field (`SavedReplyByField` deleted).
  - The cover photo drafts itself after upload ("Use this photo" removed).
  - The Mood Board's Do/Don't lists draft when a row is left (`DraftsAsYouGo settle`).
  - The special message already saved as it was typed.
- **Captions removed.** The Name style line (with its "Mr. Manuel Cortez Casasola" example), "Guests see a new date when you Apply.", the one-name hint, the ceremony-time line, the venue photo line, the special message's two lines and status, the RSVP settings' "in your draft" line, the reply-by line, and the cover photo's kind, Pro and draft lines.
- **One title per stage.** The Maker's bar now says the stage being walked ("Save the Date") on every step, on Before we start and on the Ready screen, and "Finish your Event Hub" on the stage picker. It no longer flips between Look and Event Details (`MakerState.guideTitle`).
- **Live preview of the picked theme.** The Look page and every stage page wear the theme being picked (`theme=`, the shipped theme-tile door laid over the draft), so a pick shows at the tap instead of waiting for the draft round trip.
- **One Apply.** The "Almost ready" screen lost its own black Apply; the bar's ✓ is the one Apply.
- **One count.** The Maker's plan counts "done" with `guidedItemDone` over the same saved facts that Home and Event Details count from (`doneFacts`). "Before we start" now lists every fact the picker counts: in place (done, or set and "look it over") plus what is still to ask.
- Guard: `lib/the-guided-steps-share-one-layout.test.ts`, which renders every step of every stage, checks one rule per stage, one title, one Apply, the counts, per-file Save counts for each step's editor, and the logo step. Each part was sabotaged red → green. The port-controls baseline was regenerated with its generator.

SPEC IMPACT: None. This applies the owner's 2026-10-05 ruling (one shared step layout) and standing rules (INTERACTION_RULES §8; no captions; no go-edit-elsewhere links).
