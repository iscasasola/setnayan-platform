# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-06 · feat(bench): every category and folder says what it covers

Owner: *"can you add (i) on venue and other categories to explain to them what that category covers"*,
then *"make it fun and attractive that makes them want to add these."*

### What already existed — and what was actually missing

The ⓘ ships. `categoryHintForTile` resolves a tile's text from the plan group that claims it, and
the button's accessible name is already the exact question: **"What does {label} cover?"** So Venue,
Catering, Coordinator and 22 others were answered. **This was never a feature to build.**

What was missing was coverage, and it was invisible: `categoryHintForTile` returning null makes the
bench HIDE the button — the correct refusal, and a silent one. Measured:

| level | before | after |
|---|---|---|
| category tiles reachable from the pick enum | **25 of 45** | **45 of 45** |
| folders | **0 of 16** — no button, no copy, no mechanism | **16 of 16** |

The silent tiles included exactly the ones a couple cannot guess from a label — `escort`,
`referee_official`, `reveal_element`, `personal_accident_insurance` — and a collapsed **Specialty**
or **Dining extras** folder told them nothing at all.

### Six the owner had to define, because guessing would have shipped a lie

`escort` = a VEHICLE escort (not an usher) · `reveal_element` = a physical effect (not a program
moment) · `event_insurance` = a real product suppliers SELL here (not a venue checklist item) ·
`personal_accident_insurance` = covers THE COUPLE · `referee_official` = sports officials AND contest
AND pageant judges · `massage_chair` = both the machines and a therapist. Drafted only after those
answers.

### 🕊 One line deliberately breaks the house pattern

Every hint is "what it covers + a practical cue". **`farewell` is funeral services** and carries no
cue, no urgency and no attempt to make anyone want to add it — someone reading it may have just lost
a person. A test enforces that: the line fails if it grows *book*, *months out*, *early*, *fills up*
or *hurry*.

### Voice

The 34 existing hints are practical, not salesy. The 36 new lines keep that spine and let the
warmth sit in the noun half — the picture of the moment — rather than adopting a second register. A
couple reads all 45 in one scroll behind identical ⓘ buttons; a tonal jump reads as two authors.
Re-voicing the whole list warmer remains a deliberate one-pass decision, not something to start by
accident with 20.

### Implementation

- `lib/category-hints.ts` — `TILE_HINTS` (20) + `FOLDER_HINTS` (16). A tile-level entry WINS over the
  plan group's, so a too-generic group hint can be sharpened without touching `PLAN_GROUPS`. This is
  the override `categoryHintForTile`'s own note promised: *"Tile-level overrides arrive with the
  Taxonomy Studio."*
- The folder ⓘ is a **sibling** of the fold-head button inside a flex `fold-head-row`, never nested —
  buttons cannot nest, and the inner one would be unreachable by keyboard. Exactly the shape
  `cat-head-row` already uses one level down, and it reuses `.cat-info` and `.hintbox` so both levels
  look and behave identically.

### The guard is the point

Nothing failed while 36 lines were missing for months. Now a new folder or a newly reachable tile
with no hint turns the suite RED, and the message names the offenders.

9 tests. Mutation-checked, each red on its own case: a folder losing its hint · a tile losing its
hint · farewell growing a booking cue · the tile override no longer winning · the folder ⓘ nested
inside the head button. 39 green across the adjacent suites.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-06 — the six category definitions the owner settled, and the
farewell restraint rule. No schema, SKU or price change.
