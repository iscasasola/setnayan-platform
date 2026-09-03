## 2026-09-03 · fix(vendor-mood-board): the supplier's mirror sanitizes the palette instead of asserting its shape

`events.role_palette` is jsonb, and roughly 25 surfaces read it — the couple's
own board, the venue walk, the QR routes, the PDF routes, the invitation. Every
one of them runs `sanitizeRolePalette` first. The booked-vendor mirror did not:

```ts
const palette = (board.role_palette ?? {}) as RolePalette;
```

`as` is an assertion, not a check. It told the compiler a shape nobody had
verified, and those strings land directly in `style={{ backgroundColor: hex }}`.
So the one surface a supplier uses to match florals, linens and booth styling to
the couple's colours was also the only surface that would render whatever the
column happened to hold.

⚠ **The failure mode is disagreement, not a crash.** React will not execute a
bad style value, so nothing throws and nothing reaches Sentry: the vendor simply
sees a different set of swatches than the couple's own board draws, each surface
internally consistent and neither aware of the other. Same shape as the board
and the room disagreeing about attire (2026-09-03, earlier today), one layer out.

**Fix — call the same function everybody else calls.** One line, plus dropping
the now-unused `RolePalette` type import.

⚠ **The fix had a way to become a data-loss bug**, and didn't: the page renders
`palette.custom_roles` beneath the fixed taxonomy, so a sanitizer that rebuilt
from `PALETTE_ORDER` alone would have silently eaten the couple's Ninang/Ninong
rows. `sanitizeRolePalette` preserves `custom_roles` and `room_dressing`
explicitly, and the guard pins both that preservation and the page's read of it.

**Guard — `lib/the-vendor-sees-the-palette-the-couple-saved.test.ts`.** Pins the
call, the absence of the cast, that junk never reaches a swatch, that both
surfaces agree by construction, and the custom-roles survival on both sides.
Both sabotages (restore the cast; stop rendering custom roles) verified red.

SPEC IMPACT: None.
