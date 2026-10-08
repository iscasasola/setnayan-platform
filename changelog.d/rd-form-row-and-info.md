## 2026-10-08 · feat(ui): the Form row, the ⓘ explanation and the Fold — three shared templates

Owner, 2026-10-08 (the approved template gallery, `prototypes/control_templates_2026-10-08.html` § 6 · § 7 · § 10 · § 19):
*"field follow form row style"* · *"cannot edit the other. no more check just (X) tapping out is auto accept or
pressing enter"* · *"highlighted text box are required"* · *"if a text box has incomplete information or invalid.
make it shake so they can find it easily"* · *"i want this to scroll so they see the whole content of the message.
pause for 1 second then start from the beginning again"* · *"should dropdown have a consistent width?"* · *"the
collapse should also animate how the Row Name returns"* · *"pill box not rounded edge"*.

- `app/_components/form-row.tsx` — `FormRows` (one pill width per list, one field open at a time) · `TypedRow`
  (the pill with a pencil; a tap opens the field across the row with ONLY ✕; tapping out or Enter keeps, ✕ or Esc
  leaves; a long message opens a taller box; an amount keeps its ₱; a long answer scrolls on its own strip, rests one
  second at each end and repeats) · `ChosenRow` (the house `PickMenu`) · `SwitchRow` (the one `SwitchTrack`) ·
  `FactRow` (a fact set elsewhere, one quiet line) · `nudgeFormRows` (a main button's press shakes what still needs
  attention). Required = the accent highlight + "Required"; red only for something wrong; a save that did not land
  says so with Try again.
- `app/_components/explain.tsx` — `Explain`: the ⓘ as its own 44-px button; a centred popup with "Got it" on a phone
  (dark, blurred, locked behind), a note under the ⓘ on a computer; one open at a time.
- `app/_components/fold.tsx` — `Fold`: opens downward, the arrow turns, one open at a time, what is inside stays
  mounted.
- `lib/form-row.ts` — the rules, pure (`keepOutcome`, `longAnswerPlan`, `amountWords`, …).
- `app/globals.css` — the row's motion (open, fold back, the name's return, the shake) at the press family's one
  speed; none under reduce motion.
- `lib/the-form-row.test.ts` — ten tests, nine mutations seen red. The three files join `TEMPLATE_FILES` in
  `lib/the-accent-is-one-token.test.ts` (no accent colour is written by hand).

No screen wears them yet — Studio › Info is next on this branch. No data, no request, no migration.

SPEC IMPACT: None (builds what `INTERACTION_RULES.md` § 9 and the approved gallery already say).
