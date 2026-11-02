## 2026-10-08 · fix(maker): the Reveal panel's default opening is the one that really plays

Stacked on #6446 (`rd/style-cards-phone-shaped`), which already gave the Reveal's
Look strip its phone-shaped cards and the **None** card. No migration · +0
server actions · no new client code (one server component and one pure rule).

Owner's live Maker, 2026-10-08 (Stages › Invitation › Welcome › Reveal › Look):
one card, "Sheer veil ◆" — `openings` held one entry, `current` "veil-sheer",
`defaultOpening` "two-flap-horizontal", theme "Cyber Neon".

- **Why one opening — by design, nothing changed.** `MakerRevealPanel`
  (`maker-made-once.tsx`) offers `REVEAL_LIBRARY` less what the Reveal Studio's
  map switches off (`reveal_studio_config.templates`, `/admin/reveal-studio`;
  DECISION_LOG 2026-06-17 "Reveal Studio — admin customizes + activates/
  deactivates the Save-the-Date reveal from Setnayan HQ"). The guest page obeys
  the same map (`revealAllowedFor`, rule 4), so a switched-off opening could
  not play. The code's own default is all five ON; which are off is the stored
  row — an owner switch at `/admin/reveal-studio`, not a filter to fix.
- **What was wrong, fixed:** the panel was told the default opening was the
  THEME's own even when the map had switched it off — the guest page would
  play the house default instead. For a couple who had chosen nothing, the
  strip then ringed no card and named a "theme's opening" that was not on it.
  The panel now asks the guest page's own rule (`revealAllowedFor`) what plays
  when nothing is chosen, and says "your theme's opening" only when it is.

Guard: `lib/the-reveal-default-is-what-plays.test.ts` (4 tests — the rule on
every theme × every map × every house default; sabotages each red).

SPEC IMPACT: None.
