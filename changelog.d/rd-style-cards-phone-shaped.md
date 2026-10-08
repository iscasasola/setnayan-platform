## 2026-10-08 · feat(maker): every style card is phone-shaped — the shared 3:4 frame on every look picker, and a None card for the Reveal

Owner, 08 Oct, on picture cards drawn as short wide strips: *"we are on mobile view, so show in mobile view, not
like a header that is short and wide or at least square or 4:3 or 3:4"* · *"on all style across the market hub"* ·
and on the Reveal's Look strip (one card, 543 × 104 at his width): *"and none. and again these styles with preview
of the effect needs to be in a ratio 1:1 4:3 or 3:4"*. Stacked on #6428.

- **The frame.** Every look / style picture card in the Maker wears the ONE shared frame, `.sn-phone-card`
  (`globals.css`, Builder L1's commit, cherry-picked alone): 3 : 4 portrait, a fixed width, never flexed — the strip
  scrolls. Framed here: the shared look cards (`StyleCards` — every part's scene styles on every stage, the hero's
  parts, E-Gifts, the for-each-guest and day parts, the palette looks and Do's & Don'ts of #6428), the Reveal's
  openings, the Camera's looks, the Digital pass's ticket styles and the Themes gallery's page picture. The
  62 % / follow-the-part card (`SP_LAYOUT_CARD` + `spCardWidth`) is no longer worn by any look picker.
- **Inside the frame is the phone's view.** A look card's miniature is the page at phone width, cut to the frame
  from the part's top (`phoneViewFit`) — a tall scene is cropped at the frame's foot, a short part sits in its
  middle; a wide part is no longer shrunk until it fits. The Reveal's picture is the same drawing laid at the
  frame's portrait shape (its pieces are percentages; no new artwork); the Camera's screen fills the frame; the
  ticket is 3 : 4 already and now covers it.
- **The Reveal's None card** (one commit, droppable alone). None is the first card. It IS the state that already
  means "no reveal anywhere" — `events.reveal_stages = []`, every stage switch off — so the card and the three
  switches cannot disagree (`lib/reveal-none.ts`): None is ringed exactly when every switch is off (or under the
  older `std_reveal_template = 'none'`, honoured, never written); picking an opening from None turns on the stage
  being edited; the couple's opening is kept. No new column, no migration.
- **Only one opening is offered — by the admin map, not a fault.** The list is `REVEAL_LIBRARY` less what
  `reveal_studio_config.templates` switches off (`maker-made-once.tsx`); production's row (read-only, 2026-10-08)
  has `veil-sheer` on and the other four off since 2026-06-19. Turning them on is `/admin/reveal-studio`.
- **Audited, NOT framed (reported):** the scene-layout / Post Event preset schematics (`scene-thumb.tsx` — the
  sheet's own Phone · Desktop · Both views; the desk schematic is wide by design) and Studio › Papic's event-look
  swatches (not the Maker). Words stay one dropdown; the Prints grid shows paper, not a style.

Guard: `lib/every-style-card-is-phone-shaped.test.ts` walks the audited pickers (anchored per component, the count
printed); `the-stages-panel-is-the-prototypes` §14 holds the None card.

SPEC IMPACT: `STAGES_PANEL_BUILD_STATUS_2026-10-08.md` gains "Round 6 — every style card is phone-shaped" (the
audit table, then the build). No decision changed; the owner's ruling is DECISION_LOG 2026-10-08 "A BACKGROUND CARD
IS PHONE-SHAPED".
