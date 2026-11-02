## 2026-10-04 · feat(ui): one open at a time — opening a dropdown, menu or fold closes the others

Owner, verbatim: *"when a dropdown opens, the other dropdown collapses"* → *"auto collapse"*.

One mechanism, `apps/web/lib/one-open.ts`: an opener joins with
`useOneOpen(open, setOpen)`. When it goes from closed to open — a tap, a
keyboard Enter or a programmatic open alike, because the announcement comes
from the state change — every other open opener closes, unless it is one of
the opener's ancestors. A panel that holds other openers wraps them in
`<OneOpenScope id>`, so a picker opening inside a menu, a popover or a fold
never closes it (only peers close peers; React context, so it crosses portals).
A fold that MOUNTS open does not announce, so default-open folds never fight on
load. Modal sheets and dialogs, persistent navigation (bottom-nav accordion,
sidebar sections), native `<select>` and `<details>` stay out on purpose.

Wired: the shared `PickMenu` (~65 importers — it already closed on an outside
tap; now keyboard opening closes the others too, and it closes the non-PickMenu
openers), the guest list's shared `Popover` (every Side · RSVP · Role · +group ·
locked chip, the invite cell, the People roster cells), the guest ⋯ menu, the
seating `BarMenu` + phone `Pop` + the editor's ⋯ and Auto-arrange menus, the
Maker's tool ⋯ and shut-door note, the Maker sheet's section list, the print
menu's row ⋯, `ColourWell`, Mood Board `SwatchPopover`, the schedule ⓘ,
`InfoTip` (when tap-pinned; a hover-peek is not an open), the story's
text-colour popover, the walking-order menu, the launcher's event ⋯, Explore's
search list, the story's Find panel, the chat ⋯, the front-door account menu,
`ExpandCard`, and the shop's `ServicesDisclosure`.

Guarded by `apps/web/lib/one-open.test.ts` (A then B leaves only B; a picker in
an open sheet leaves the sheet open; a default-open fold does not fire on mount;
per-file wiring; sheets/navigation stay out). Sabotaged red → green three ways.

SPEC IMPACT: Implements DECISION_LOG.md 2026-10-04 "ONE OPEN AT A TIME" and
INTERACTION_RULES.md §8 ("One open at a time (auto-collapse)"). No corpus edit —
the ruling is already written; its "Build queued" note is now built.
