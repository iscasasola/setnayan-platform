## 2026-09-04 · feat(3d-plan): the mood board reaches the room (MB15)

The last session of the mood-board arc. Everything the redesigned board knows
now flows into the 3D Plan, from one source of truth, in one direction.

**The board decides. The room READS.** All three 3D surfaces — the couple's Seat
Plan lab, the homepage/phone demo and the public guest walk — resolve through
one new module, `apps/web/lib/room-palette.ts`, and nothing else. It contains no
Supabase import and no write verb, and the guard asserts both. A surface that
calls `resolvePaletteFromRoles` directly is a second path from one palette to
one room, and the couple ends up looking at two different rooms.

### 1 · Palette styles reach the room — the auto-upgrade

MB5 gave the board a STYLE (*Our colours only* / *Softer room, richer people* /
*Room and people*) and a six-rank visibility ladder. The room could not see any
of it: the same wedding rendered identically under all three.

MB1 forbade closing that gap, in as many words, because doing it carelessly
"silently restyles every room already sold". **Owner decision, 2026-09-04:
auto-upgrade every room, existing and new. No opt-in, no "your room will look
different" prompt** — the opt-in-with-warning recommendation was heard and
declined. There is no flag; do not add one.

`resolveRoomPalette` style-derives exactly four fields, from
`deriveVenue(slots, style).room_dressing` — the engine itself, not a second copy
of it:

| field | before | after |
|---|---|---|
| `table` | `reception[1]` | `room_dressing.linens` |
| `ambient` | `reception[0]` | `room_dressing.lighting_warmth` |
| `chairs` | absent unless the couple set one | `room_dressing.chairs` |
| `florals` | absent unless the couple set one | `room_dressing.florals` |

An explicit `room_dressing` override still wins — **which is also MB12's
freeze**, since `vendor_agree_to_part` freezes a dressing field by writing it
there. One mechanism, no second branch.

#### THE DIFF REPORT — 2,600 seeded theme palettes × 3 styles, old vs new

```
simple    changed 2600/2600   table=0(+0 new)     ambient=0(+0 new)     chairs=2600(+2600 new)  florals=2600(+2600 new)
depth     changed 2600/2600   table=2557(+0 new)  ambient=2555(+0 new)  chairs=2600(+2600 new)  florals=2600(+2600 new)
complex   changed 2600/2600   table=2557(+0 new)  ambient=2555(+0 new)  chairs=2600(+2600 new)  florals=2600(+2600 new)
```

Read: **every seeded board changes under every style**, because `chairs` and
`florals` never existed unless the couple set one and now always do. Under
`simple`, `deriveVenue` returns the majors untoned, so the two fields that
already had a value do not move at all — the visible change there is chairs and
florals arriving. Under `depth`/`complex` the `tone()` lift (+0.06 L, chroma
capped at 0.13) moves the linen colour on 2,557 boards and the ambient wash on
2,555; the ~43 that do not move were already at or above the lift's ceiling.
Re-measure with the guard file itself — it prints this table.

Those numbers are **asserted**, not merely printed, so the report cannot go
stale: `simple` moving a single linen, or `depth`/`complex` diverging from each
other, goes red.

#### THE HARD GATE — what MB1 delivered does not move

Over all 2,600 seeded boards × 3 styles, `accent`, `floor`, `wall` and
**`accent2`** are byte-identical before and after. `accent2` is `reception[4]`
verbatim or ABSENT — never derived — which is the whole of MB1's fifth-colour
repair. The three MB1 decor zones (`decor-walls-*`, `decor-photo-wall-*`,
`decor-welcome-*`) emit **identical geometry** under both derivations, compared
with colour values masked.

It held on the first attempt; no fix was needed.

The zones' DRESSED surfaces are allowed to move, and exactly which ones is
pinned option by option, **measured at the render**, so a zone that starts
reading a new style-derived field goes red. Three do: an uplit wall takes the
ambient wash, a balloon garland takes the floral colour, and the welcome table's
signage boards (linen) and guestbook plinth (chairs) — the plinth being the
clearest case of the auto-upgrade arriving on a surface that had no colour of
its own before.

🪤 **The first version of that measurement was useless and said so confidently.**
`VenueDecor` draws the whole room, so perturbing `florals` changes the markup for
every zone including the ones that mount nothing. It reported "every zone reads
florals" — true of the room, and no answer at all about the zone. The window now
extracts the zone's own named group.

🪤 **And one hop no server render can see, inherited from MB1 and named rather
than hidden.** `BlossomInstances` paints with `setColorAt` inside a
`useLayoutEffect`, so a bloom's colour is absent from the markup by
construction. The floral zones DO take the couple's floral colour; the assertion
lives at the call site with an exact mount count, the way MB1 pins its own half.

### 2 · The room dresses people in the colours section 02 shows

The room read the RAW `role_palette`, where a role the couple never hand-edited
is simply ABSENT — so the attire chain fell through to `wedding_party`, then to
the bride/groom side colour, and dressed a bridesmaid in a colour the board
never showed anybody. Section 02 renders those roles from the derived board.
**Two mechanisms, one question, each passing its own tests.**

`resolveDisplayPalette` fills every untouched derivable role from 02's own
`displayColorsFor` — the same function, imported, not re-typed. It now feeds the
figures in all three surfaces, the anonymous crowd's seat-keyed dress code on
the public walk, and the concept illustration's `roleColors` in the lab.

⚠ **A theme template's role colours were never "touched", and this is where that
becomes visible.** `applyMoodboardTemplate` writes them and marks nothing, so 02
has always shown the derived colour over them. The room used to show the stored
one. Both now show the derived one — the board is the decider.

`custom_roles` are carried across untouched. `GuestRole` is a closed enum, so a
couple-authored role has no person in the 3D room to dress; deriving a colour
for one would invent a value they did not type.

### 3 · A finalized part is locked in the room too — from ONE predicate

MB12 put the handshake panel on the mood board. Section 03 does not edit the
design; it links to the Seat Plan. **And the Reception Designer it links to, the
only editor of `events.reception_design`, knew nothing about finalization** — a
couple could re-dress a ceiling their stylist had already signed off, in the one
place that value is editable, and neither surface said a word.

Both surfaces now answer through `isPartFinalized` — never `state === 'agreed'`
spelled out again, and never `agreed_at !== null` (a re-opened row still carries
the agreed-at of the round before). Asserted behaviourally across the whole
state vocabulary × both agreed-at histories, so a second predicate goes red
rather than drifting.

The zone shows **who agreed and when**, the same sentence section 02/03 shows,
beside the chips it disables — never a control that simply stops responding. The
refusal also sits at `choose()`, the one funnel both single- and multi-select
chips pass through, so a future control cannot route around it.

**And the UI is not the lock.** New migration
`20271203855754_moodboard_part_finalization_holds_the_design.sql` adds
`events_hold_part_finalization_design`, a BEFORE UPDATE trigger on
`events.reception_design` that re-asserts every agreed `room:` zone from its
snapshot — the same shape MB12 gave `role_palette`, for the same reason:
`applyMoodboardTemplate` is a second writer, and a guard on one writer is a
guard on one writer. Scoped to the agreed zone only (over-freezing is its own
silent defect), ignores `people:`/`place:` agreements (their freeze lives in the
palette), releases on re-open, and restores nothing for a zone the snapshot
never mentioned. Both definer functions are revoked from `anon` and
`authenticated` — the GRANT decides, not the caller.

### 4 · Fixed: the Seat Plan showed photos the couple had deleted

`app/dashboard/[eventId]/seating/lab/page.tsx` read `event_inspiration_assets`
**without `removed_at IS NULL`**. Every upload path replaces a cell by
soft-deleting the row that held it, so the reference strip beside a zone showed
the replaced photo alongside its replacement, with nothing saying which was
current. The mood board's own read has always filtered. MB9's picked renders and
MB10's gallery picks are the same rows and reach the zone through the same read
— the guard also asserts no `source_kind` filter is ever added, which would drop
them.

### 5 · The couple's own theme name labels the room

`events.moodboard_theme_name` now renders in the room legend, beside the
multi-select disclosure. Null renders no title — never "Untitled event".

### The contract, written down

New `docs/03-REFERENCE/contracts.md`: every field the 3D Plan reads, who writes
it, and what breaks if the shape changes — plus the command that re-measures
each claim. It cites symbols and columns, never line numbers, and a guard
resolves every symbol it names against the tree, so a rename takes the document
with it.

🪤 **And the doc was invisible to git for twenty minutes.** The repo root is an
ALLOWLIST (`/*` plus `!/apps/`, `!/supabase/`, …) because this repository is
checked out at the user's home directory. `docs/` had no line, so the file was
written, a unit test read it and went **green**, and `git diff --stat
origin/main` simply did not list it. `.gitignore`'s own header warns about this
and already carries two dated notes from the same swallowing — `internal-decks/`
and `build-sessions/`. This is the third; `!/docs/` is now on the list, with the
note. CI would eventually have caught it (the test reads a file that would not
exist there), which is the only reason it is a trap and not an incident.

### Verification

- `pnpm exec tsc --noEmit` from `apps/web` — clean
- `apps/web/app/_components/plan3d/the-room-reads-the-resolved-board.test.ts` —
  16 tests: the diff report, the hard gate, the zone map, the one-direction rule,
  the wiring, the contract-doc drift guard
- `apps/web/app/dashboard/[eventId]/seating/lab/_components/the-3d-plan-locks-what-the-supplier-agreed.test.ts`
  — 13 tests: one predicate across both surfaces, the prop chain link by link,
  the reference-photo read
- `apps/web/tests/db/a-finalized-zone-cannot-be-re-dressed.db.test.ts` — 8 tests
  against a replayed Postgres
- **Sabotage-tested, seven ways, each restored:** a write added to the room →
  the one-direction guard red · `agreed_at` swapped in for `isPartFinalized` →
  the cross-surface predicate red · the editor's refusal deleted → the funnel
  guard red · `accent2` derived → the hard gate red · `wall` given the style
  lift → the hard gate red · the Hud's forward of `finalizedByPart` deleted →
  the prop-chain guard red · the design trigger flipped to AFTER, and widened to
  restore the whole design → the db test red both ways
- full `*.db.test.ts` replay including `ugat-schema-claims` and
  `ugat-concept-coverage`

SPEC IMPACT: None. No locked decision changes. The 2026-09-04 owner ruling
(auto-upgrade every room, no opt-in) is recorded in `build-sessions/MB15.md`,
in `lib/room-palette.ts`'s docblock and in `docs/03-REFERENCE/contracts.md`
§1.3.
