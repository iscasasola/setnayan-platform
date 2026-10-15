## 2026-10-15 · feat(hub/maker): the Cover Scene — the cover's words as one group, one background, the whole first screen

Owner-approved 2026-10-15 on `Setnayan/prototypes/maker_cover_group_background_2026-10-14_fable.html`
(DECISION_LOG 2026-10-15 "COVER SCENE APPROVED"): Framed = inset with a rounded margin on the page colour,
Full width = edge to edge · the Hero folds into the Cover Scene's Background (one background) · Scene ◆ stays Pro.

- **The group** (`lib/maker-parts.ts`): part `coverscene` ("Cover Scene", canvas `f:hero`, no `el`), Background only,
  first among the cover's words on Save the Date · Welcome · The Day › Live · Post Event. A cover word's Background
  line is now "This sits on the Cover Scene." and the toast ends in ONE door, "Select the Cover Scene ›". A tap on
  the cover's empty space selects the group (it fell to the logo before). Arriving never lands on it.
- **The whole first screen** (`lib/cover-scene.ts`): every `PahinaMasthead` design is `min-h-[100svh]`
  (`100dvh` where supported), words centred (The Letter keeps its foot column).
- **One background** (`HubSectionCanvas.ground` on the hero row, `sanitizeHubCoverGround` — no migration):
  Colour (Plain · Diagonal · Glow · Opaque · Frosted, free) · Scene ◆ (Setnayan's own loops, they play for guests) ·
  Upload ◆ (a photo — it IS the hero photo: the same save writes `landing_page_hero_image_url`, and the cover draws
  the page's `resolveHero` photo, so the poster, home card and cover never disagree). A clip is REFUSED by the
  sanitiser while `GUEST_HERO_VIDEO_PLAYBACK` is false — kept in the couple's media, never worn on the cover.
- **Drawn for guests** (`app/[slug]/_lib/cover-scene-layer.ts`, `_components/cover-scene-ground.tsx`): the layer
  behind the words, the shade veil, and the words' tone + AA scrim measured over the ground
  (`coverSceneLegibility`, free by the 2026-09-25 ruling). Nothing stored → the page byte for byte as before.
- **The toolbar** (`stage-panel/cover-words-background.tsx`): the four rows over the UNCHANGED `StageBackground`,
  reached through the existing lazy `SceneBackgroundRow` door (no new `dynamic()` stand-in).
- **Apply** (`lib/hub-draft.ts`): a 'ground' facet — a loop or a photo on the cover asks Event Hub Pro; a Colour
  and taking one off are free.
- Guard `apps/web/lib/the-cover-scene-is-one-group.test.ts` (10 claims, each sabotaged red once).

Not built (for the next step / owner): Details › Hero as a second door drawing the same rows; a parts ▾ row (the
shipped top bar is the locked Stage ▾ | Studio ▾ — there is no parts ▾ to extend); the RSVP reply form does not get
the group (its stage has its own tools).

SPEC IMPACT: None — builds the approved prototype and the 2026-10-15 rulings already in the corpus; the builder's
calls (toast door, short grey lines, no parts ▾, RSVP form left out) are recorded in the PR body for the owner.
