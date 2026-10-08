## 2026-10-08 · feat(ui): the Calendar, the Form row with a date, and Chips — two more shared templates

Owner, 2026-10-08 (the approved template gallery, `prototypes/control_templates_2026-10-08.html` § 6 "Reply by" · § 8
Calendar · § 11 Chips; `INTERACTION_RULES.md` § 9): *"form row with date"* · **"Three uses, one look. Pick one day.
Pick a range of days. See what is on each day."** · *"consistent size? or adaptive?"* (a chip never changes size when
chosen) · the pop-up rule: *"the rest of the screen darkens … nothing behind it will work. pressing on the dark part
removes the pop up"*. Controller's ruling the same night: a DATE is picked on the month grid; the ticker stays the
control for a time and for a Love Story chapter's loose "when".

- `app/_components/calendar.tsx` (kind 8) — `CalendarGrid`: ‹ · month and year · › over seven columns, Sunday first;
  the picked day is the accent circle (the pill selector's own "on"), today a hairline ring, a range fills softly
  between its two ends, a dot marks a day with something on, a day that may not be picked is grey and cannot be
  pressed; 44 px a day on a phone, 40 px on a computer; a month slides in from the side it came from. `CalendarPop`:
  a sheet from the bottom on a phone that keeps the pop-up rule (`.sn-popup-dark`, `inertBehind`, `useModalA11y`, a
  tap on the dark closes, never taller than the screen) and a panel under its pill on a computer (attached, darkens
  nothing). Motion is transform and opacity only, at shares of the family's one speed; none under reduce motion.
- `lib/calendar-grid.ts` — the rules, pure. A day is the DATE (`YYYY-MM-DD`), never a moment: the grid, its title
  and a day's words are the same in every timezone.
- `app/_components/form-row-date.tsx` — `DateRow`: the list's own white pill with a calendar mark; a tap on a day is
  the answer (read on the pill at once, kept ONCE, the calendar closes 260 ms later); opening it, changing the month
  or tapping the day it already holds writes nothing; a save that did not land says so with Try again.
- `app/_components/chips.tsx` (kind 11) — `Chips`: choose several from a few; chosen = the accent, not chosen = grey
  on white; one shape for both states (40 px tall, at least 84 px wide), a 44-px target, no icon that comes and goes.
- `app/_components/form-row.tsx` — three additive hooks, nothing reflowed: `mark` (a small mark after a row's name —
  the Pro mark), `onType` on `TypedRow` (the words as they are typed, for a live preview; never the save) and
  `usePillWidth` exported for a row drawn in its own file. `ChosenRow` also takes `below`.
- `lib/the-calendar.test.ts` (9 tests, 13 mutations seen red) · `lib/the-chips.test.ts` (6 tests, 8 mutations seen
  red). The three new files join `TEMPLATE_FILES` in `lib/the-accent-is-one-token.test.ts`.

What the reference leaves open, and what this does: no earliest or latest day is drawn in the gallery, and the
shipped Reply by takes any date — so every day, past ones too, may be picked unless a screen passes `min` / `max`.

No screen wears them in this commit (Studio › RSVP and the RSVP stage are next on this branch). No data, no
request, no migration.

SPEC IMPACT: None (builds what `INTERACTION_RULES.md` § 9 and the approved gallery already say).

## 2026-10-08 · feat(maker): RSVP is one list of template rows — Studio › RSVP and the RSVP stage's form

Owner, 2026-10-08: *"Then let us fix RSVP"* · *"we want the whole app to be adaptive to the same feel"* · *"field
follow form row style"* · *"cannot edit the other. no more check just (X) tapping out is auto accept or pressing
enter"* · the minimum-request rule: *"the least amount of request for the tasks to be done"*.

`MakerRsvpSettings` (`launch/_components/maker-rsvp-ask.tsx`) draws ONE list — the same element in Studio › RSVP
and in the RSVP stage's form, in the Studio's order — and each row is one approved kind:

- **Reply by** — the Form row with a date (a pill with a calendar mark; the one calendar: a sheet on a phone, a panel
  on a computer). It was a native `<input type="date">`. Still `guest_list_edit_deadline` through `updatePaxSettings`
  with the draft flag: in the Maker it waits for ✓ Apply. Guests › Setup's own row is unchanged and still live.
- **How guests answer** — a pill selector, All at once | One by one, over the one key `oneAtATime`. It was a dropdown
  of two in Studio and a hand-made switch "Ask one question at a time" on the stage and in Event Details: three
  controls for one setting. Event Details' RSVP item wears the same row now.
- **Yes answer · No answer** (and, on the stage's two after-screens, each heading and message) — typed Form rows: the
  pill reads the page's own words in grey until the couple writes theirs; a tap opens the field across the row (a
  message opens the taller box); tapping out or Enter keeps, ✕ leaves it. "Start from ▾" is a row under it; "Use the
  automatic words" is the house quiet action and shows only once there is something to reset. They were bare boxes
  with a "Wording" menu and an underlined link. The page still shows the words AS they are typed.
- **How guests get in** — the same dropdown, in a Form row; the picked choice's sentence is behind its ⓘ.
- **RSVP asks** — chips (choose several), in a Form row; "Yes or no is always asked…" is behind its ⓘ. The chips are
  drawn by the shared part, so Guests › Setup's six toggles wear them too (they were green ✓ / outlined ＋ buttons).
- Studio › RSVP has no title and no "WORDS" heading: the page opens on its first row. The stage's form lost its
  "The answers" / "Reply by" headings and its "In your draft…" line.

**The shared parts** (`_components/guest-setup/`): `ReplyBy` (`layout="frame"`, replacing `layout="studio"`),
`GuestsGetIn` and `RsvpAsks` take a `frame` — the part keeps the value, the choices and the one writer, the Maker
hands in the app's row. Neither `reply-by.tsx` nor `guests-get-in.tsx` imports a template, so Guests › Setup's page
does not download the Form row or the calendar.

**Requests** (read from the code):
- Studio › RSVP, any pick or toggle: was 1 draft write + 1 whole render of the Maker per burst → now 1 draft write
  (the newest of a burst), no render of the Maker; the guest pages the Maker has mounted redraw themselves once per
  burst (`makerRedrawSave`, as Studio › Info).
- Studio › RSVP, a typed word: was 1 draft write per keystroke + a Maker render per burst → 0 while typing, 1 draft
  write when the row is left.
- The stage, a typed word: was 1 draft write per pause in typing → 0 while typing, 1 when the row is left. Picks and
  toggles there are unchanged (1 held write per burst).
- Reply by: 1 `updatePaxSettings` + 1 whole render of the Maker per day picked (unchanged in kind — that action
  answers with no Apply count, so the count on ✓ only moves with a render). It would need `updatePaxSettings` to
  answer with the Apply bar (as `hubDraftAction` does for `HUB_DRAFT_BAR_FIELD`) for the render to go.
- Opening the page, a row, the calendar or a dropdown: 0, as before.

**A refusal** is said once, where it happened: a word's own row says it with Try again; every other control on the
panel's one line, now red (it was the gold `text-terracotta-700`).

- `lib/studio-rsvp-wears-the-templates.test.ts` — 8 tests, 14 mutations seen red. Six existing guards brought to the
  new rows, each keeping its claim (their own sabotages re-run red): `how-guests-answer-is-one-at-a-time`,
  `studio-round-3-follows-the-owner` (9), `draft-1-3-waits-for-apply` (B), `setup-and-maker-mount-the-same-parts`,
  `no-message-on-guests`, `the-rsvp-page-follows-the-maker` (7), `the-rsvp-stage-is-realtime` (E).
- `scripts/port-control-baseline.json` regenerated (`WordField` → `WordRows`; `DateRow`, `PillSelector` added).
- The two dev labs hand Reply by a real `YYYY-MM-DD` (they handed "November 12, 2026", which no date field reads).

Not in this change (next on this branch): the stage's When yes / When no captions, the Celebration ◆ pick and the
typing bar's "Done".

SPEC IMPACT: None applied. For the owner: "Ask one question at a time" (a switch) and "How guests answer ▾" (a
dropdown) are now ONE pill selector named "How guests answer" in every door.
