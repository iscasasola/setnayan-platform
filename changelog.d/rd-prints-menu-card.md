## 2026-09-28 · feat(prints): The Menu card — the meals of the night, by moment — and every Prints & Tickets choice is one dropdown

Owner, verbatim: *"add to print out our meals for tonight. from vendors from
ceremony, to cocktail to the buffet."*

- **A new themed print, The Menu** (`PRINT_PIECES.menu`, 5 × 7 in / A5, the
  same crest, die cut and QR corner as the Entourage and the Finer Details).
  Each moment of the night is a heading, in the order the couple set, with its
  dishes beneath. It is measured and paged by the same engine as the other
  cards (`layoutMenu`, `chooseScale`): the largest type that fits, a back side
  for a very long buffet, never past the safe line.
- **Where the dishes come from, in order:** (a) the couple's booked caterer on
  Setnayan — every LOCKED package's lines that survived their customisation
  (`keptItemRows`, the budget's own definition) whose supplier kind is food or
  drink (`catering`, `cake_maker`, `mobile_bar`), one moment per package,
  READ at print time (`readCatererMenu`); (b) otherwise what the couple types.
  Measured on prod 2026-09-28: no event has a package, so (b) is the path today.
- **Its home is the existing `events.print_details` jsonb** (`menu`) — no new
  column. Rule 0: no caterer authors a dish list anywhere (the food schemas
  count sample menus; package lines are services), and `print_details` is the
  column for "only what has no other home". The Details (words) save now
  carries the menu over, and a save that cannot read the stored value writes
  nothing rather than wiping the other half.
- **The editor** (`print-menu-editor.tsx`, in Prints & Tickets under the set):
  moment names start from the couple's own schedule (`foodMoments`: its
  cocktail hour, its reception & dinner), dish lines are added, moved and
  removed with 44 px controls, and it saves with the same form-post-and-return
  the Details words use ("Saves immediately" — the menu is print-only).
  Checked at 375 and 390 px.
- **Never printed blank.** With no dishes the route refuses the Menu (409),
  leaves it out of the whole-set PDF and sample sheet, and the Maker offers no
  download — its card shows "Add your menu" and the picture carries the prompt.
- **A first-visit tour** (`customer_print_menu_v1`, the shipped `MiniTour`).
- **Every choice is one dropdown** (owner, same day: *"if there are choices,
  again. us drop down menu"*): the pass / invitation / event-card size and the
  theme preview are each ONE control on the Maker's shared `PickMenu`
  (`print-choice-picker.tsx`), showing the current choice, with its size line
  under it as before.
- **Not in this change:** the arena and movie ticket sizes — no source ties a
  printed-ticket size to the MOA Arena or to Ayala Malls Cinemas, so none was
  guessed (DECISION_LOG row "ARENA AND MOVIE TICKET PASS SIZES — PENDING A
  MEASURED TICKET").

Guarded in `lib/every-print-fits.test.ts`: the Menu joins the every-piece ×
every-format × every-theme safe-area sweep with a long buffet; it prints every
dish; the menu parses and caps; the schedule's food moments; the route never
prints it blank and the words save keeps it; the choices are one dropdown.

SPEC IMPACT: DECISION_LOG row 2026-09-28 "THE MENU CARD" (corpus commit `89fd686`,
`DECISION_LOG.md`).
