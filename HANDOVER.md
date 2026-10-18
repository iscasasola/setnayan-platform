# HANDOVER — rd/maker-own-section-photos · started 2026-10-18 ~12:40 PHT by the controller

Owner today, three "build it / do it" answers:
1. OWN-SECTION PHOTOS ON THE PHONE. Owner, verbatim: "is this the one where you add scenes? we already have the
   templates, just make them work". A "Your own section" is added from a template (app/[slug]/_components/
   scene-template.tsx, custom-section-widget.tsx; lib/own-scenes-are-parts.test.ts — owner added one from template 20
   "Photo …" on 2026-10-17). #6616 made its Heading and Words editable in Edit; its PHOTOS are not addable/editable on
   the phone Maker. Make every template's picture slots work on the phone exactly as the template draws them: tap a slot
   → the shipped picture picker (Upload / your media), replace, remove; saved in the draft; shows on the guest page.
   Extend the shipped picker — never a new one. Every template that has picture slots must work (list them; test each).
2. ◆ MARKS (Pro re-gate #6623 left them): the older part sheet's Font ▾ shows no ◆ (a test pinned "no mark" — re-aim it
   to the 2026-10-16 ruling "all animate, effects, styles, accents are pro"); scene Animate rows other than Movement
   and Leaves show no ◆. Add the shipped " ◆" mark to each; Apply already names them.
3. E-GIFTS CARD ACCENT: the corner spray / lace fan accent (Vintage art kit, approved 2026-10-16) draws only when the
   couple has a way to give; with none, the Maker shows the empty gifts block with no accent. In the MAKER, draw the
   picked accent on the empty gifts card too (with the shipped "add a way to receive gifts" prompt if one exists), so the
   couple sees what they picked; guests unchanged (no way to give = no card).
Rules: Rule 0 (extend shipped components). Phone first, 375 px, light + dark where supported. Never open the owner's
cale-ice Maker. Another builder is changing Maker SAVE paths (rd/two-hosts-round-3) — don't touch save/draft-store code
beyond calling it; one is changing sign-in. Own walk folder (scratchpad/own-photos-walk/).
Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-maker-own-section-photos.md.

## BUILDER STATE (builder, 2026-10-18)
Rule 0 found (all shipped, extended — nothing redrawn):
- Template renderer `app/[slug]/_components/scene-template.tsx` `renderScene`; 16 templates have picture slots
  (1–7, 13–15, 17–21; 5 and 14 are clip slots). Desktop picker = `SceneSlotsPanel` (Content tab). Phone Edit =
  `stage-panel/stage-edit.tsx` (rows 1–2 = Heading · Words since #6616; row 3 free).
- Picture picker on the phone = the Background tool's Upload row (`stage-background.tsx` tiles, `FileUpload` into
  `scene-background/`, the couple's photos + clip) and `RsvpPictureSheet` (MakerSheet + FileUpload). Reused.
- Write = the background row's pattern: whole canvas → `hubDraftAction` intent=save, `makerRedrawSave`, `noteDraftedCanvas`.
- Apply held slot pictures from `scene-background/` as not_your_photo (slots checked against ownRefs only) → widen
  to the scene-upload folder (same rule a scene background already has).
Plan / decisions:
1. Photos: Maker canvas draws every slot in place (empty = the template's own box + "＋ Photo"), each `data-scene-slot`.
   Tap a slot → Edit opens with that slot's sheet. Edit row 3 "Photos": one tile per slot. Sheet = Upload + your
   media (+ clips where the template takes one) + Take it off. ◆ per makerProMark; hidden in the store shell.
2. ◆: element-sheet Font ▾ wears the sheet's own Pro mark (re-aim free-vs-pro-redrawn test); StageAnimate's other
   named controls get " ◆".
3. Gifts: Maker-only empty gifts block draws the kit's divider + card accent around the shipped prompt.

## Progress
- [x] Item 2 ◆ (commit below): element-sheet Font ▾ = the sheet's one mark, hidden in the shell; StageAnimate's
  every named control via `animatePro` (Fade · Blur · Move · Size, While on screen, From/To, Band, Plays, Rows,
  Words/Reveal, Delay, Leaves). Guard `lib/every-animate-control-wears-the-mark.test.ts` (sabotage: Delay unmarked →
  red; restored → green). 9 pinned-label tests re-aimed (marked RE-AIMED 2026-10-18). Not walked yet.
- [x] Item 3 gifts accent: `MakerWelcomeGiftsEmpty` `kit` → the prompt in one bank-card-shaped `li` with the
  KitSlot first (the kit's own corner CSS); `guest-welcome.tsx` Maker branch draws the divider + card kit. Lab switch
  `lab_gifts=none` (cookie) draws it in /dev/maker-lab. Guard `lib/the-empty-gifts-wears-its-accent.test.ts`
  (sabotage: kit not passed → red; restored → green). Not walked yet.
