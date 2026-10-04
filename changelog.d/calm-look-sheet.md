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
