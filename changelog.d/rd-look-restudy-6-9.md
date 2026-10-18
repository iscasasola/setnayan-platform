## 2026-10-18 · feat(maker-look): the Look restudy's last four rows — 6 · 7 · 8 · 9

Contract: corpus `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 6 rows 6–9 (approved DL 2026-10-08 "restudy is good")
and its amendment `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` (approved the same day).

- **Row 9 · Magic Move → the Logo's Action.** The cover's Logo (Stages › the cover › Logo › Animate › Action ▾)
  offers **"Travels to the bar ◆"** beside Still · Drift. It writes the SAME column Look's Magic Move wrote
  (`events.site_magic_traveller`, through the draft) — one fact, one home; the guest page and the traveller's
  script are unchanged, so an event that already travels keeps travelling. One Action at a time: the journey hands
  the part back to Still, and Still or Drift ends the journey. `MagicMovePick` is gone from every Look/Details form
  (`pro-panels.tsx`); Apply names it "Travels to the bar · Logo" and its Go to opens the hero. Guards re-aimed, not
  deleted: `the-mark-travels-or-sits-still`, `the-look-is-one-panel`, `the-look-sheet-is-calm`,
  `a-free-section-tries-every-look-control`. Port-control baseline regenerated (`MagicMovePick` removed on purpose).
- **Row 6 · The Save the Date film wears the main background; its own background retires.** Guest page: the film is
  handed the main background's picture (`mainGroundStillFor` — the SAME picture resolver as the page's layer, now one
  `pictureOf`), else the page colour (`stdFilmOnMain`); the couple's Readability is kept. The loader no longer
  resolves a film background of its own. The Save the Date studio's background picker (`StdBackgroundPicker`) and its
  presign door are gone; Readability stays; the studio preview wears the main background too; its action stores only
  "follows" (+ Readability). Launch page stops handing `filmOwnBackground`/`filmLegibility`. **Migration
  `20271277600211_the_film_wears_the_main_background`** (pipeline only): a 30-day copy in the new
  `events.std_background_retired` (service role only — deny-listed in `lint-events-column-grants`), a ready-made scene
  or a public-bucket photo moved INTO the hero's main background only where none is set (the main wins), then the
  film value cleared to "follows". Measured on prod first (read-only): 2 events hold a film background, both already
  have a main background → nothing moves, both copied. Exposure baseline unchanged. Guards: new
  `the-film-wears-the-main-background.test.ts`; `the-guided-steps-share-one-layout` (9) and (23) re-aimed.
- **Row 8 · The Effects block gets "The picture": Parallax ◆ · Blur ▾.** Under the shipped overlay carousel, How much
  and Colour, Look › Background › Effects now draws the approved amendment's "The picture" section — Parallax ◆ (the
  app's one switch) and Blur ▾ (one dropdown that opens), each with the prototype's line — on EVERY source; on a
  colour or a pattern both are shown OFF with the reason ("Needs a picture — a plain colour has nothing to move /
  blur"), never hidden. The closed Effects row says what is on ("Lanterns · Parallax · Blur · Soft"). The Studio's
  separate Motion and Blur rows are gone (one control, one place). Parallax is widened from an own photo to every
  picture — a scene, a video of ours, the couple's clip, the cover — on the shipped page-scroll parallax: the
  sanitiser keeps `motion` on every picture (`readMainLook`), the resolver draws it, a theme loop carries it, and
  `MainGround` moves the still AND the clip in one wrapper outside the blur's own scale. Adding it is Pro at Apply on
  any picture (`mainGroundChange`). No new key, no migration. Guard: new `the-picture-is-an-effect.test.ts`;
  `the-background-has-one-source` and `the-main-background-offers-every-choice` re-aimed (a clip may now move).
  Port-control baseline regenerated for row 6's deliberate removal of `StdBackgroundPicker`.
- **Row 7 · A part's own background offers the main background's sources — Video ◆ joins.** "Same as main" shipped
  with the 2026-10-09 toolbar in the owner's later words (`Maker_Two_Bars_LOCKED_2026-10-09.md` § BACKGROUND: Source ▾
  first choice "The Event Hub's"; picking it is "Back to main"), with Colour · Scene ◆ · Upload ◆ — but not the
  lock's **Video ◆**. A part's Source now offers it between Scene and Upload: Setnayan's own theme loops as moving
  cards (their stills), stored as the clip each part already keeps (`{kind:'snippet', media, poster}`) — no new
  shape — and read back as Video. Apply admits exactly our loops by a closed list (`lib/theme-loop-refs.ts`
  `isThemeLoopRef`, as `isStdLibrarySrc` does for scenes), never a folder pattern. Guard: new
  `a-part-wears-our-videos.test.ts`; `scene-upload-media` (7) re-aimed.

SPEC IMPACT: None — builds the approved restudy rows as drawn; no new decision.
