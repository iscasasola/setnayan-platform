## 2026-11-10 · feat(maker): Studio leaves the Event Hub Maker — one stage pill · Prints in ⚙ · the ring opens the Logo Maker · ▶ "Play this scene" (Build 6 Lane F, slice 1)

Owner, 10 Nov: *"Studio technically is gone since the pages there will be inside the different scenes it covers."*
Picks settled the same day (DECISION_LOG "ALL YES — BUILD 5 OPEN CALLS SETTLED", Lane F). Contract: the approved
prototypes `maker_scenes_tap_to_edit_2026-11-09` (frame 8) and `event_hub_stages_scenes_2026-11-10` (M1 · M2 · M3 · H4).

- **The bar's selector is the stage pill alone** (frame 8 pick B). `StudioSideSwitch` (Stages ▾ | Studio ▾) becomes
  `MakerStageSwitch`: one pill, `● Invitation ▾` (● only while guests meet that stage), or the editor's name inside an
  editor a scene opened; a tap is the list of stages, and a pick from inside an editor goes back to the stages. The
  "Studio pages" sheet, its "n of N ready" and its ⚙ row are gone; so is the Studio home of cards (`StudioCover`).
  A door that used to land on that home (`makerDoorLanding`) lands on the stage.
- **Prints is a row in ⚙ › Your Event Hub** (pick B): one link to the shipped Prints page (`printsPageHref`), in Home's
  Prints line's own words (`PRINTS_HOME_LINE`, moved to `lib/prints-page-href.ts` so the ⚙ chunk stays light). Not on
  the Prints page itself.
- **The cover's ring opens the Logo Maker at once** (pick: ring → Logo Maker, the rest → cover editor).
  `makerTapOpensEditor` (`lib/maker-parts.ts`): only the cover's mark (`logo`, `f:hero` · `mark`) opens an editor on a
  tap, through the same door Edit's row opens ("Done · back to Logo"). Every other part of the cover still only picks
  itself, and its Edit is the cover's own fields.
- **▶ is "Play this scene"** — the fifth thumb button's name (`STAGE_PLAY_SCENE`), the Preview menu's own words.
- **An editor a scene opened is full screen on a phone** (owner 9 Nov, *"full screen always loses the bottom nav"*):
  `EditorChromeAway` runs the shipped `useChromeAway` while it covers the page. It is lazy, so it adds nothing to the
  Maker's first load, and it never runs on the Prints page.
- **No words send anyone to "Studio" any more.** The doors name the editor they open (`MAKER_EDITOR_DOOR_WORDS`: Open
  the Logo Maker · Open Palette + Dress Code · Open the Schedule · Open the Love Story · Open E-Gifts · Open Info). Also
  fixed: the outfit line, the dress-code notes, two help answers, the remove-scene sheet and the tool-with-nothing-to-do
  line. `no-copy-names-an-old-place.test.ts` now catches "Studio › Logo/Palette/Love Story/Schedule/E-Gifts/Look",
  "Open in Studio", "edit it in Studio" and "stay in Studio". This also closes the one exception it used to carry.
- Guards (new): `lib/studio-is-gone-from-the-maker-bar.test.ts` · `lib/the-ring-opens-the-logo-maker.test.ts`. Each
  check was sabotaged once and went red. Tests that pinned the two-halves switch, the Studio home landing or the old door
  words were updated on purpose and cite this ruling. `studio-menu-ends-with-hub-settings.test.ts` is deleted because
  its subject (the Studio ▾ sheet's last row) no longer exists. The port baseline was regenerated for the three
  deliberately removed controls (`StudioCover`, `StudioHome`, `StudioSideSwitch`).
- **Not in this slice (follow-up):** ↺ as a history list with stepped-past rows greyed until the next edit (frame 6 · M9).
  That needs a stepped-past list in the draft engine, a redo action and history rows built on the server. It touches
  live drafts, so it ships as its own PR. Also left for follow-ups: the per-scene full-screen editors with their own
  thumb rows (M4–M8; today a scene's Edit opens the shipped editor through its door) and scenes playing in place as the
  page scrolls (frame 1).

No migration. No guest-side change: the guest Hub's render path (ISR, no live connection) is untouched.

SPEC IMPACT: None. This implements DECISION_LOG 2026-11-10 ("SIX ANSWERS" item 5 and "ALL YES", Lane F) as ruled.
