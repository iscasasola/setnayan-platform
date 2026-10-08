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
