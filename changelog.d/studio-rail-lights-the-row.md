## 2026-08-23 · fix(rail): the Studio rows light the one you are on

**What a person sees.** Open 3D Plan, Papic or the Event Hub from the Studio
list in the side menu and that row now reads as *you are here* — the same way
every other row in the menu already did. Until now the Studio rows stayed dark
on their own pages, so the menu answered "where am I?" everywhere except the
eight products it exists to name.

**Why they were dark, and it was named debt rather than an oversight.** The rail
is drawn by two components: the shared shell (your own rows and the Studio
group) and the event menu pushed in underneath it. Each resolved "which row is
lit" over its OWN rows, and neither could see the other's. Lighting the Studio
rows in that state lights **two** rows at once, which tells the reader they are
in two places — not a smaller bug than none.

🔑 **The fix is ONE list and ONE resolver.** A winner resolved per component is
not a winner; it is the same mistake as a boolean per row, one level up. The
layout now builds the event menu's rows once, hands the same data to the shell,
and the shell resolves the union and publishes the answer for the menu to read.

**Measured, not assumed** — the whole overlap between the eight Studio products
and the ten event rows is three URLs, and the shipped specificity rule settles
each once it can see both halves:

| URL | lights | why |
|---|---|---|
| `…/seating/lab` | 3D Plan | neither row is exact; the longer href wins |
| `…/website` | Event Hub | its own page beats a family claim |
| `…/website/editor` | Launch | its own page beats a family claim |

⚖ **`activeRailKey` gains one ranking key: an EXACT page match beats a PREFIX
claim, and length is the tie-break beneath it.** On length alone the row that
claims a whole family from a longer href won that family's front page too,
leaving the other row dark on the page it opens. Every existing rail test is
unchanged and still green.

- New `event-rail-match-rows.ts` — the event menu as match data, in a module a
  server layout and a client component can both import. `SIDEBAR_SLOT_KEYS` /
  `CHILD_SLOT_KEYS` move out of the `'use client'` sidebar into
  `customer-nav-slot-keys.ts` (verbatim, re-exported) so the HIDDEN rule has one
  home rather than two.
- New `rail-active-key.tsx` — the resolved key, published down. Deliberately
  **no fallback resolver** on the reading end: one would silently restore the
  second answer while looking like a safety net.
- 🪤 A row aimed at the PICKER is not a destination. With two or more organiser
  events every Studio href collapses to `/dashboard`, so eight rows would match
  the events board and tie with "Your events" — the winner decided by array
  order, which is nobody's decision. Those rows are dropped, not ranked.

**Guards.** `studio-rows-are-lit.test.ts` — 6 assertions against the REAL
builders, including a premise check that fails if the two halves ever stop
overlapping (which would make every other assertion vacuous). Seven mutations,
each measured by occurrence count before → after, all red.

🪤 **Two of them were green on the first run and the guard was decoration for
exactly the two things it exists to protect** — deleting the Studio rows from
the shell's union, and deleting the on-state from the rows. The behaviour tests
composed the rail themselves, so they could not see the shell stop composing it.
*Testing the primitive is not testing the caller*, which the sibling rail guard
had already had to learn once. The composition is now read out of the shell's
real source.

🪤 **And one sabotage did not land where it was aimed** — `guestCount,` appears
twice in the layout and the first edit hit the wrong one, reporting a pass that
meant nothing. Re-targeted inside the block, it goes red.

⚠ `nav-badges.test.ts` is **retargeted, not relaxed.** Its rule — whatever draws
the couple's destinations on a laptop must be handed the guest count — went
blind when those props moved into one object, which is this repo's own failure
mode arriving through the door marked refactor. It now follows the value: the
object must carry the count, and the object must reach the element.

SPEC IMPACT: None.
