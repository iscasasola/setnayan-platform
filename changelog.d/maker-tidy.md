## 2026-09-21 · fix(monogram): hide the studio's empty Reveal tab; honest upload banner; tips fold away

Checked live after #5816: the v2 studio still showed a "Reveal" tab that opened an
empty pane (its panel is hidden) with a Replay of the SAVED reveal, not the effect
picked in the row below. Tab and Replay hidden by CSS (engine binds to both). The
upload banner said the logo "outranks the designed mark everywhere" — false since a
composition wins; now "Your uploaded logo is your monogram." Upload tips start
collapsed once a logo is saved, so the effects and buttons are not a screen down.

SPEC IMPACT: None.

**One logo card** (owner, pointing at the "Your logo, in use" card, the green
banner and the dropzone under it: "integrate these 2 on the actual your logo, in
use area with icons of upload and remove image"). Upload and Remove are now icon
buttons (44px, aria-labelled, Remove asks first) in the card's header; the banner
is gone and the dropzone shows only when there is no logo yet.
