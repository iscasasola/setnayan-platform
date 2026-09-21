## 2026-09-21 · fix(monogram): hide the studio's empty Reveal tab; honest upload banner; tips fold away

Checked live after #5816: the v2 studio still showed a "Reveal" tab that opened an
empty pane (its panel is hidden) with a Replay of the SAVED reveal, not the effect
picked in the row below. Tab and Replay hidden by CSS (engine binds to both). The
upload banner said the logo "outranks the designed mark everywhere" — false since a
composition wins; now "Your uploaded logo is your monogram." Upload tips start
collapsed once a logo is saved, so the effects and buttons are not a screen down.

SPEC IMPACT: None.
