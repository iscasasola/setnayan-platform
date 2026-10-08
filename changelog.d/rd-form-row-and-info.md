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

## 2026-10-08 · feat(studio): Studio › Info is Form rows — what must be typed first, the rest under "More for guests"

Owner, 2026-10-08: *"so first, Info. redesign it based on our rules similar to look? no preview needed since info is
just form. but how each row is presented there and create a selector if needed."* · *"prioritize only what they need
to input here"* · *"field follow form row style"*. Designer's map: `STUDIO_INFO_REDESIGN_2026-10-08_fable.md`.

- **Event name** — still ONE row that opens the two people in place (owner 2026-10-07); inside it each name is a typed
  pill and Name style a dropdown (`OpensRow`, new in `form-row.tsx`). A first name is required; the row arrives open
  only while one is missing. `studio-event-name.tsx`.
- **Date · Venue** — one quiet line each (`FactRow`): the value and "Set when you book your venue in Suppliers".
- **Opening line** (+ Start from ▾) · **Special message** · **What to bring** — typed pills; a message opens the
  taller box. `studio-info.tsx` (new).
- **"More for guests"** — ONE fold holding the Event Hub address (the shipped `SlugField`), Go live, Who can view ▾,
  Which version guests see ▾, Event Bar, Show the event QR with the QR's look and Copy · Share · Download. One amber
  line, once, names the rows that change the live Event Hub at once. `StudioHubSettings` in `studio-tools.tsx`.
- Info's two small-capital headings ("Your event", "Your Event Hub") are gone — the page opens on its first input.
- **Saving** — which rows are live and which wait for ✓ Apply is unchanged, with ONE exception the designer found:
  the Opening line's black Save (it posted the whole print-words form) is gone from Info; the line is drafted on its
  own key, `print_details.opening_line`, which ✓ Apply already publishes. The words form's own field stays in the
  page, hidden, so a Prints save still carries the line.
- **Requests** — a kept answer is ONE draft write and no render of the Maker (`studioDraftKeep`: `makerRedrawSave` +
  `makerLatestWrite` + the Apply bar in the answer). Names, Name style, What to bring and the QR switch each brought a
  whole-Maker render per save before.
- `lib/studio-details.ts` — the server-drawn skin steps aside for rows (no heading, no band padding, never the old
  14-px box on a row's own field).
- `lib/studio-info-wears-the-form-row.test.ts` — eight tests, nine mutations seen red, and the watch
  (`FORM_ROW_SCREENS`) a later builder extends. Six existing tests brought to the new rows;
  `scripts/port-control-baseline.json` regenerated (`StudioWhatToBring` → `StudioWords`).

SPEC IMPACT: None applied by this change. For the owner: the designer's four open questions were answered with the
safe defaults (Who can view stays on Info; live/draft unchanged but the Opening line; date and venue quiet lines).
