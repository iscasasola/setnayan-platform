## 2026-09-27 · feat(maker): the Reveal page says less and fine-tunes

Owner: *"less words as our prompt says"* and *"where is the petal speed and other fine tuning?"*
(DECISION_LOG 2026-09-21 "ONE REVEAL, AND IT FINE-TUNES", 2026-09-25 "pick a reveal and see the
effects, fine tune it to your liking").

- **Fewer words** (design brief 2026-09-24, "Zero Explanatory Clutter"): each opening in the Maker's
  Reveal page is its short label plus its paid mark; its description, the intro paragraph and the
  "Where it plays" explanation sit behind an ⓘ (`InfoTip`). The effect switches lose their hint
  lines. A picked opening is ringed rather than inked so its ⓘ stays readable.
- **Fine-tune fold** (shut by default) under the chosen opening, with only the knobs that opening's
  engine actually reads: veil → Speed · Sway · Petal amount; church doors → Petal amount · Petal
  size · Petal fall speed; envelopes → Butterflies · Butterfly speed · Butterfly size. A slider saves
  to the DRAFT when let go; the save reloads the Reveal page, so the opening replays with it.
- The couple's tune is a sparse override stored as `events.std_reveal_effects.tune` (existing JSON
  column, no migration), resolved by `resolveRevealTune` in the SAME ranges the Reveal Studio's
  resolver clamps to, and laid over the house look on the guest page by `tuneRevealLooks`. An
  untuned event plays the house look exactly as before. Changing it is Pro at Apply (the existing
  `std_reveal_effects` rule; `tune` joins `REVEAL_ONLY_EFFECT_KEYS` for the Save-the-Date studio).
- Honest gap: the veil's own petals have no size or fall-speed knob in its engine, so the veil
  offers three sliders, not five.
- Held by `lib/the-reveal-fine-tunes-and-says-less.test.ts` (sabotage-checked). +0 server actions.

SPEC IMPACT: None — implements the 2026-09-21 / 2026-09-25 fine-tune rulings on the Maker's Reveal
page; no decision changed.
