## 2026-11-14 · style(supplier): Customers onto the design template (batch T03)

The supplier Customers area and the surfaces it opens, put through the approved design template
(`prototypes/design_template_sheet_2026-11-14_fable.html`, 15 rules), using the shared pieces only.

- **Rule 13, words that read:** ink at 60% or less becomes the dark-grey token (`--m-slate-2`); 9–12.5 px words
  become 13 px; money loses the typewriter font and keeps bold, even-width digits.
- **Rules 3 and 9, the add-a-prep-step form:** its home-made overlay, spinner and hand-drawn buttons become the
  shared sheet (`ScheduleSheet` / `Sheet`) with `ActionButton`s, the same shape as the couple's twin form. Its Type
  is now ONE dropdown, and the retired segmented picker is removed.
- **Rule 4, choices are one dropdown:** the payment-option type tiles, the bank provider and the three Your-voice
  pickers (Language · Tone · Emoji) become `PickMenu`.
- **Rule 2, no card frames:** the payment-option form, Re-booking requests, Your voice and the feature fold drop
  their card frames for hairline sections, and the list pager's "could not load" note is one amber line.
- **The 44 px floor:** the page buttons, icon discs and decorative icons reach 44.
- **Rule 15, motion:** hand-typed durations become `--sn-*` tokens.

Every fact and action is kept. Files owned by open PRs #7633, #7621 and #7544 are untouched (see the PR's STATUS).

SPEC IMPACT: None — the template is approved; this applies it.
