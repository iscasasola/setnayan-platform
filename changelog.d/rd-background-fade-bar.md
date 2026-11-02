## 2026-10-08 · feat(studio): Background — one fade bar (black ← as is → white) where Shade ▾ was; Candlelight no longer offered (amendment PR 2)

Owner, verbatim (2026-10-08, DECISION_LOG "LOOK › BACKGROUND, AMENDED"): *"when
scene, video or upload is picked: I want a line bar where it can fade to white or
fade to black · fade to white drag line bar to right · fade to black drag to left
· snap to center"* — and, the same day: *"remove candlelight"*. Contract:
`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.A / § 3 / § 8 PR 2, prototype
frames A04–A06. Stacked on `rd/selectors-are-pills`.

- **Storage — a format extension, no migration.** `widgets.hero.main.shade`
  holds one of the four words as before, or now a whole number −100…100
  (left of 0 = the page's ink over the picture, right = its paper; 0 = as is and
  is NEVER stored). The four words read at darker −70 · dark −45 · light +45 ·
  lighter +70 and lay exactly the veils they always did; nothing is rewritten.
- **The rule is the shipped one** (`lib/main-ground-shade.ts`): the veil starts
  at the bar's value and is raised — never lowered — until the words read; left
  of the centre the words turn light. Guarded for every position × every theme ×
  every frame (`shade-never-crosses-the-floor`, +3 tests).
- **The bar** (`background-fade-bar.tsx`): "Fade" ⓘ, the value in words ("As is"
  · "Lighter 60%" · "Darker 70% · light words"), a 44-px thumb on a line from
  black to white with a centre tick; a release within ±8 lands on the centre;
  "As is" or a double-tap returns to it; ← → Page Up/Down Home End on a keyboard.
- **What a drag costs:** nothing until it ends. Each position is shown on the
  sample screen in the browser; the release is ONE draft write (a release where
  it started writes nothing; a held key writes once, on key-up). No timer.
- **Shade ▾ is gone** from the Studio's Background, and **Candlelight is no
  longer offered there** (the Pattern rule): an event that already wears it is
  told so by name — "Showing Candlelight · An older look — it stays until you
  turn it off" — with one tap to turn it off. Nothing in the Studio's Background
  turns it on. (The shipped Maker's own Candlelight control and the lock titles
  that name it are NOT changed here — PR 3.)
- The older extras list (the store shell) shows a bar position as what it is,
  never as "As is".

Guards: `lib/the-fade-bar-is-one-line.test.ts` (6), `shade-never-crosses-the-floor`
(+3), `the-main-background-extras-reach-the-page`, `the-background-has-one-source`
(6) rewritten for the bar. 20 sabotages seen red.

SPEC IMPACT: None beyond the contract above.
