# MB5 — Port section 02: Palette

**Goal:** the richest section goes live — palettes derive from 00 in real time, and the couple can
shape them.

**Model:** Sonnet · high effort — a UI port against a landed, tested engine.
**Size:** 1 day. **Depends on:** MB3 (shell), MB4 (engine).

## Delivers

- **Live 00 → 02 derivation** on the MB4 engine, in real time
- The palette-styles picker (Simple / Depth / Complex), with the six-rank visibility hierarchy:
  couple → family → principal sponsors → best man & maid of honour → entourage & secondary
  sponsors → guests
- Copy and swap colours across roles; the majors quick-pick; the theme's colours shown under the
  colour picker so they can be reused
- **`touchedRoles` semantics** — an edited role stops re-deriving, absolutely. MB12 leans on this
  exact mechanism, so build it properly here.

## Search by colour name

**Owner, 2026-09-03:** *"they can also search for the color name. so it will be easier for them to
find it if they know the color."*

A search field on the colour picker: type a name, get the swatch. This inverts the naming library
— today it answers *"what is this hex called?"*, and search asks *"where is the colour I can
already name?"*

- Search the **curated layer** first (the wedding vocabulary, Filipino names included), CSS names
  second — a couple typing "moss" wants Moss, not Papaya Whip
- **Aliases are required, not optional.** People type *"burgundy"*, *"moss green"*, *"chartreuse"*,
  *"dusty pink"*, *"champagne"*. Each must resolve to the entry it means. An alias table beside the
  name is the cheap version; skipping it makes the field look broken.
- Prefix and substring matching, diacritic-insensitive (**"pina" must find "Piña Cream"**)
- **A search that finds nothing must say what it did** — "no colour named that; here are the
  closest" — never an empty box. An empty result is indistinguishable from a broken field.

### ⚠ Search coverage is a different measurement from naming accuracy

Naming asks *given a hex, is the name right?* Search asks *given a word people actually use, does
it resolve?* **A vocabulary can pass one and fail the other.** The 2026-09-03 audit measured the
first; before this ships, measure the second — take a list of colour words couples really use and
count how many return nothing. That number is the feature's actual quality.

## The one-directional rule

02 derives **from** 00. 02 **never writes back to** 00. Reception appears in 02's Venue group
read-only, with an "↑ Edit at 00" link — no picker machinery attached to it.

## Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- `node apps/web/scripts/port-controls.mjs`
- the rank-invariant suite still green **through the UI's slice/pad path** — the fuzz harness's
  `pad` mode exists because the old UI top-up broke exactly this. Run it against the ported UI,
  not just the lib.
- guard: a touched role never re-derives — sabotage: re-derive it, confirm red

## Owner decides first

Nothing beyond MB4's gate.
