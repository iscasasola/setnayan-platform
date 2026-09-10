# 03-REFERENCE · Contracts

> One document per boundary where two surfaces have to agree about one fact.
> Started 2026-09-04 by MB15, the last session of the mood-board build arc.
>
> ⚠ **An anchor here is a SYMBOL or a COLUMN, never a line number.** Every row
> below can be re-measured with the command in its own "how to check" cell. A
> line number in a document rots the moment the tree moves, and a "corrected"
> one is often the wrong one.

---

## 1 · The mood board → the 3D Plan

**The rule, and it has held through every session in this arc:**
**the mood board decides colour and design; the 3D Plan READS.** The Plan never
writes `role_palette` or `reception_design`. Two writers for one fact is a
defect that takes months to surface and always surfaces in front of a customer.

Guarded by `apps/web/app/_components/plan3d/the-room-reads-the-resolved-board.test.ts`
→ *"no 3D surface writes role_palette or reception_design"*.

### 1.1 · The three reading surfaces

| Surface | File | Who sees it |
|---|---|---|
| The couple's Seat Plan lab | `app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx` | the couple |
| The homepage / phone demo | `app/_components/plan3d/plan3d-scene.tsx` | anyone with the demo link |
| The public guest walk | `app/[slug]/venue/_components/guest-venue-3d.tsx` | invited guests |

All three resolve through **`apps/web/lib/room-palette.ts`** and nothing else:

- `resolveRoomPalette(rolePalette)` → the room's materials (`Lab3DPalette`)
- `resolveDisplayPalette(rolePalette)` → the palette every ATTIRE surface reads

A surface that calls `resolvePaletteFromRoles` directly is a second path from
one palette to one room, and the couple ends up looking at two different rooms.
The guard file above fails on it by name.

### 1.2 · Every field the 3D Plan reads

| Field | Written by | Read for | What breaks if the shape changes |
|---|---|---|---|
| `events.role_palette.reception[0..4]` | section 00/02 (`MajorsEditor` → `saveRolePalette`); `applyMoodboardTemplate` | `accent` ← [0], `table`* ← [1], `floor` ← [2], `wall` ← [3], `accent2` ← [4] | Dropping a slot silently removes a colour from the room. **`accent2` is `reception[4]` verbatim or ABSENT — never derived.** A derived fifth colour restyles every room already sold (MB1's whole repair). |
| `events.role_palette.palette_style` | section 02's style switcher (`setStyle`) | picks the `deriveVenue` branch: `simple` = untoned majors, `depth`/`complex` = +0.06 L, chroma capped 0.13 | An unknown value normalizes to `'depth'` via `sanitizePaletteStyle`, **never** to a render-time guess. Removing the field makes every room render as `depth`. |
| `events.role_palette.room_dressing.{linens,chairs,florals,lighting_warmth}` | section 02's advanced controls; **and MB12's `vendor_agree_to_part`, which freezes a field by writing it here** | explicit override beats the style-derived value, in that order | Reading the derived value FIRST would let a supplier's agreed linen colour follow the couple's next style switch. The override *is* the freeze — there is no second branch. |
| `events.role_palette.touched_roles[]` | section 02 (any role edit); MB12's agreement | `displayColorsFor` returns the couple's own colours for a touched role instead of the derived one | A touched role that starts re-deriving overwrites a choice the couple (or a supplier) made. Valid members exclude `reception` and `officiants`; `sanitizeRolePalette` enforces it. |
| `events.role_palette.<attire key>` (16 keys, `PALETTE_ORDER`) | section 02 | `resolveAttirePaletteColor(role, displayPalette, sideAttireColor(...))` → each figure's motif | Reading the RAW palette leaves an untouched role ABSENT, the chain falls through to `wedding_party` then to the side colour, and the room dresses a bridesmaid in a colour the board never showed. That was true until MB15. |
| `events.role_palette.guest[]` | section 02 | `guestAttireColor(displayPalette, seatKey)` — the anonymous crowd on the public walk, keyed by SEAT, never by person | Keying it off a guest id, a role, a side or an RSVP re-opens the 2026-06-26 venue privacy lock. |
| `events.role_palette.custom_roles[]` | section 02 only (templates never author them) | carried across `resolveDisplayPalette` untouched | `GuestRole` is a closed enum, so a custom role has no person in the 3D room to dress. It reaches the printed board and the vendor mirror. Deriving a colour for one would invent a value the couple did not type. |
| `events.reception_design.<zone>.<attr>` | `saveReceptionDesign` (the Reception Designer in the Seat Plan — the ONLY editor) and `applyMoodboardTemplate` | `VenueDecor` / `VenueShell` mount per-zone geometry | The room draws the PRIMARY of a multi-selection (`sel`), while the concept PDF and the printable draw every pick (`selAll`). That asymmetry is intended and **must stay disclosed** — `primaryOnlyNotice(design, ROOM_DRAWN_ATTRIBUTES)` in the room legend is the disclosure, and `ROOM_DRAWN_ATTRIBUTES` must equal the set of `sel()` calls in `venue-decor.tsx`. |
| `events.venue_setting` | onboarding / the Details page | `archetypeFor` → the room shell, floor tone, sky | Independent of theming: the archetype room shows even in the neutral view. A venue that lacks a zone (a garden's walls) preserves the choice and simply cannot build it (`venueZoneApplies`). |
| `events.moodboard_style_family` | `applyMoodboardTemplate` | the reception decor AI-image layer pilot (`resolveDecorLayer`) | `null` is legitimate — a couple who never applied a template has no family, and the resolver refuses to guess one. |
| `events.moodboard_theme_name` | section 00 (`saveMoodboardTheme`) | labels the room in the Seat Plan legend | Null renders NO title. Never "Untitled event": a made-up name is worse than none. |
| `event_inspiration_assets` (`slot_key`, `slot_position`, `image_url`, `removed_at`) | onboarding Card 15, the mood board's Inspiration board, MB10 gallery picks, MB9 render-pool picks | the reference strip beside the zone the couple is dressing | **`removed_at IS NULL` is mandatory.** A cell is replaced by SOFT-DELETING the row that held it, so an unfiltered read shows the couple the photo they deleted next to the one that replaced it. Never filter by `source_kind`: an upload, a gallery pick and a picked render are the same row and all three belong beside the zone. |
| `INSPIRATION_SLOT_FOR_PART` | `lib/moodboard-slots.ts` | which slot answers which zone | **Five of ten parts have no slot** (`walls`, `photo_wall`, `welcome_signage`, `entrance`, `people`). Absent is the honest answer — showing a couple's cake photo beside their ceiling is confidently wrong. |
| `moodboard_part_finalizations` (`part_id`, `state`, `agreed_at`, `vendor_id`, `design_snapshot`) | the MB12 handshake RPCs only — `authenticated` holds no write on the table | freezes a zone in the Reception Designer and names who agreed | **One predicate: `isPartFinalized`.** Never `state === 'agreed'` spelled out again, and never `agreed_at !== null` — a re-opened row still carries the agreed-at of the round before. `part_id` is `room:<zone>` / `people:<key>` / `place:<slot>`; strip the prefix through `renderPartById`, never by hand. |
| `event_vendors.vendor_name` | the couple's vendor list | the "Agreed with …" label | Missing → `null` → the sentence omits the name. A placeholder name is a claim nobody made. |

\* `table` and `ambient` are style-derived after MB15 — see 1.3.

### 1.3 · What MB15 changed, and what it is not allowed to change

Owner decision, 2026-09-04: **every room, existing and new, auto-upgrades to the
palette-style derivation. No opt-in, no "your room will look different" prompt.**
The opt-in-with-warning recommendation was heard and declined. Do not add a flag.

**Style-derived (moves):** exactly four fields, from `deriveVenue(slots, style).room_dressing`.

| `Lab3DPalette` field | before MB15 | after MB15 |
|---|---|---|
| `table` | `reception[1]` | `room_dressing.linens` |
| `ambient` | `reception[0]` | `room_dressing.lighting_warmth` |
| `chairs` | absent unless overridden | `room_dressing.chairs` |
| `florals` | absent unless overridden | `room_dressing.florals` |

**Never touched (hard gate, asserted over 2,600 seeded boards × 3 styles):**
`accent`, `floor`, `wall`, `accent2`, and the geometry of the three MB1 decor
zones (`decor-walls-*`, `decor-photo-wall-*`, `decor-welcome-*`).

Exactly which zone surfaces the dressing reaches is pinned option by option in
the guard file, measured at the render. A zone that starts reading a new dressed
field goes red — not because it is wrong, but because it must never happen by
accident.

**How to re-measure the blast radius:**

```bash
cd apps/web && npx tsx --test "app/_components/plan3d/the-room-reads-the-resolved-board.test.ts"
```

The diff report prints to stdout. As of 2026-09-04: all 2,600 boards change
under all three styles (every one gains `chairs` and `florals`); `simple` moves
`table`/`ambient` for **0** boards; `depth` and `complex` move `table` for 2,557
and `ambient` for 2,555.

### 1.4 · What it costs

`resolveRoomPalette` is ~0.05 ms — it is `deriveVenue` and four field reads.
`resolveDisplayPalette` runs the whole six-rank ladder and is **~11 ms** on an
idle M-series Mac (median of 3 × 60 calls). It is memoized per `role_palette`,
so a room pays it once per mount, and each surface holds exactly ONE memo —
`seating-lab-3d.tsx` carries a comment where a redundant second one used to be.

⚠ Measure it idle. The same call reads ~50 ms while the db suite is running;
that is contention, not the number.

### 1.5 · The one-directional rule, in code

`lib/room-palette.ts` contains no Supabase import and no write verb, and the
guard asserts both. If a 3D surface ever needs a colour changed, the change
belongs on the mood board.

---

## 2 · Section 02 / 03 → the Reception Designer

`events.reception_design` is edited in exactly one place — the Reception
Designer inside the Seat Plan. The mood board's section 03 shows the
finalization handshake and LINKS there.

Both surfaces answer "is this part frozen" through **`isPartFinalized`**
(`lib/lock-request-state.ts`), reached from the room via `finalizedPartsNow`
(`lib/moodboard-finalization-rows.ts`) and from the board via
`partFinalizationStateOf` in `part-finalization-panel.tsx`. A part editable in
one surface and frozen in the other is two mechanisms disagreeing about one
fact; both pass their own tests and the couple is told two different things.

**The UI is not the lock.** `events_hold_part_finalization_design` (migration
`20271203855754`) re-asserts an agreed zone on every write to
`reception_design`, from every writer — the same shape MB12's
`events_hold_part_finalization_freeze` gives `role_palette`. A guard on one
writer is a guard on one writer, and `applyMoodboardTemplate` is the second one.

```bash
cd apps/web && npx tsx --test "tests/db/a-finalized-zone-cannot-be-re-dressed.db.test.ts"
```

---

## 3 · How to check a claim in this file

| Claim | Command |
|---|---|
| the room reads only through `room-palette.ts` | `git grep -n "resolvePaletteFromRoles(" -- apps/web/app` |
| what the room-dressing derivation is | `grep -n "export function deriveVenue" -A 20 apps/web/lib/palette-styles.ts` |
| which zones the room draws | `grep -n "ROOM_DRAWN_ATTRIBUTES" apps/web/app/_components/plan3d/venue-decor.tsx` |
| which slot answers which zone | `grep -n "INSPIRATION_SLOT_FOR_PART" -A 10 apps/web/lib/moodboard-slots.ts` |
| the freeze predicate | `grep -n "export function isPartFinalized" -A 3 apps/web/lib/lock-request-state.ts` |
| the design backstop exists in prod | `select tgname from pg_trigger where tgrelid = 'public.events'::regclass;` |
