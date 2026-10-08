## 2026-10-08 · feat(studio): Look is Background · Elements · Music (restudy 1/9)

Owner, verbatim (2026-10-08): *"colors here is not color of the background but
the colors of the different fonts, and buttons and highlights"* · *"Button style
is also on this global look. so how do we arrange this? Background, Elements
(combine the font color and styles?) and Music?"* · *"i see a hero video on
music. this should be for the background"* · *"and no save button"* →
*"restudy is good"* (DECISION_LOG "APPROVED — THE LOOK RESTUDY: BACKGROUND ·
ELEMENTS · MUSIC"; contract `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 6 row 1).

Arrangement only — every control is the one that shipped, moved; no new data, no
migration, no new server action.

- **Three sections** (`lib/maker-look-sections.ts`): `LOOK_SECTIONS` is
  `background · elements · music` (it was Background · Colours · Buttons · Font ·
  Music). Each section is drawn from its parts (`LOOK_SECTION_PARTS`):
  Background = the main background · the page fill · the hero video; Elements =
  Colours · Font · Buttons, each under its own small name; Music = the song.
- **The page fill moved from Colours into Background** — the one colour as
  Plain · Dawn · Diagonal · Glow (`ColorsPanel part="page"`, the same
  `bg_color` field and `updateSiteColors` door). Colours keeps Candlelight and
  Magic Move (`part="art"`). The Event Details record row keeps the whole
  `part="colours"`.
- **The hero video moved from Music into Background** (`SiteChromePanel
  part="video"`; Music is `part="music"`). Two forms, each posting only its own
  field — `updateSiteChrome` already writes a column only when the form carried
  it, so neither can clear the other.
- **No Save anywhere in Look**: the song, its on/off and the hero video post
  themselves into the draft the moment they change, in both Makers (round 3 did
  it for the new Maker's Studio only). ✓ Apply publishes.
- **The Save the Date film's "Same as the Event Hub" line left Look**
  (`film-follows-theme.tsx` deleted). The film's own background is still handed
  back in its own studio ("Same as theme") until it retires (plan row 6).
- **The Studio's bar** reads Background · Elements · Music; its extras ride
  under the part they belong to (the main background's Pattern · Focus · Blur ·
  Shade under the main background; the five main colours under Elements ›
  Colours).
- **Event Details' Look rows** follow the same list (Background · Elements ·
  Music); an address written before today (`?item=colours`, `?item=font`) opens
  Elements.
- **The Apply sheet** names the moved changes where they live now: "Look · Page
  colour", "Look · Hero video"; the hero video's "Go to" opens Look.

Guards: `lib/the-look-is-one-panel.test.ts` rewritten to the new shape (8 tests;
every older assertion re-aimed, none dropped) and re-aimed assertions in
`studio-round-3-follows-the-owner`, `the-guided-steps-share-one-layout`,
`the-main-background-extras-reach-the-page`, `every-fact-has-one-editor`. Each
seen red once under a sabotage.

Not in this PR (plan rows 2–9): Source ▾ and picture cards, the role rows /
Pairing ▾ / AA badges (new column), the one colour picker, the music settings,
the Save the Date background migration, a part's "Same as main", Effects, Magic
Move → Logo.

Guests: nothing changes — same stored values, same pixels (no guest file is
touched).

SPEC IMPACT: None beyond the approved contract — status recorded in the corpus at
`LOOK_RESTUDY_BUILD_STATUS_2026-10-08.md`.
