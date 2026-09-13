# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-03 · fix(mood-board): the Bridesmaids and Groomsmen cards show the palette the room uses

Taxonomy v2 (2026-07-08) split the wedding party into real per-role palette keys
— `bridesmaids`, `groomsmen` — and `resolveAttirePaletteColor`, which is what
actually dresses a figure in the 3D room, resolves the **specific key first**
and only then falls back to the shared `wedding_party`.

**The mood board's attire cards were never updated.** They read `wedding_party`
and nothing else. So a couple who filled the Bridesmaids palette got:

- bridesmaids correctly dressed in that colour **in the room**, and
- a Bridesmaids card **on the board** showing the wedding-party swatches — or
  **no swatches at all**, when `wedding_party` was empty

Two surfaces disagreeing about one fact, each internally consistent, neither
throwing. The couple sees their colour in one place and not the other and has no
way to tell which is the truth.

### The fix mirrors the resolver, it does not re-decide

`ATTIRE_DEFS` rows gain an optional `specific` key. The card reads the specific
palette first and falls back to the shared one — **the exact precedence
`resolveAttirePaletteColor` uses.** Visibility now accepts EITHER key, because a
couple with bridesmaids and an empty `wedding_party` still has a Bridesmaids
palette, and keying visibility on the shared one is what produced the blank card.

🔑 The resolver stays the authority. The test derives its expectations by CALLING
`resolveAttirePaletteColor` rather than hand-typing what it does, so if that
order ever changes the board is required to follow rather than quietly diverge
again.

### The guard

`lib/the-board-and-the-room-agree-on-attire.test.ts` — 5 tests.

| Sabotage | Caught |
|---|---|
| revert the cards to `wedding_party` only (the original bug) | ✅ |
| read the shared key first (wrong precedence) | ✅ |
| key visibility on the shared palette only (the blank card) | ✅ |

It also pins `paletteKeyForRole('bridesmaid') === 'bridesmaids'` — if that stops
holding, the board's `specific` entries point at a key nothing writes and the
two surfaces drift apart silently again.

### Not fixed here

The last inert knob: the **"Palette source"** upload writes
`role_palette.wizard_default`, which `sanitizeRolePalette` drops and nothing
reads. Unlike this one it is not a wiring job — it needs a decision about which
real palette key an extracted photo should seed, which is the owner's call.

Verified: typecheck ✅ · lint ✅ · 12,074 unit tests ✅ · guards ✅

SPEC IMPACT: None — no schema change; an existing column is read where it was
already written.
