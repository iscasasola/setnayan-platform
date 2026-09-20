## 2026-09-20 · fix(guests): a role chip wears the colour the couple chose for it

Every role chip took its tint from `ROLE_GROUP_CHIP`, a fixed Tailwind class per
role GROUP. The couple and their parents both came out red (`bg-danger-100` and
`bg-danger-200/70`) on events whose mood board had already named a colour for
each of them — the owner reported it as "all doing that red pill color". The
palette was reaching the chip only as an 8px dot.

- New `lib/role-chip-style.ts` — ONE rule, imported by both chip call sites (the
  primary chip and the `+Role` extras, which previously disagreed).
- The colour comes from `resolveAttirePaletteColor`, the same chain the 3D scene
  dresses attire by, so a chip and a gown can never name different colours. This
  also closes a gap: `roleGroupOf('groomsman')` returns `groomsmen`, its own
  group since the wedding-party split, so the old lookup could never reach the
  shared `wedding_party` fallback — a couple who filled only that key got no
  chip colour while the seating lab dressed the man correctly.
- New `tintedChipFromAccent` in `lib/site-palette.ts` (second consumer of that
  file's sRGB/WCAG math, no new colour implementation): the accent lands as a
  16% wash and the LABEL carries the hue, darkened by the existing
  `ensureContrast` only as far as AA needs. A mood-board colour is chosen as
  decor; raw as an 11px pill across a 77-row table it reads as a warning.
- An unfilled palette key keeps the exact existing class, so an empty mood board
  looks identical to today.
- The accent dot is removed — it existed to show a colour the pill refused to
  take, and a dot matching the pill around it is noise.

Guarded by `lib/role-chip-style.test.ts` (11 tests), whose contrast assertions
re-implement WCAG independently of `ensureContrast` so the test and the defect
cannot share a blind spot. Both sabotages (palette ignored; AA darkening
removed) were confirmed to turn it red.

SPEC IMPACT: None — no locked decision changes. The mood board remains the
source of role colour; this makes one more surface read it.
