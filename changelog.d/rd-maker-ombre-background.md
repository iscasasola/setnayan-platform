## 2026-09-26 · feat(event-hub): the page background is ONE colour + ONE effect — Plain, Dawn, Diagonal or Glow — free, legible, drafted

Owner, 2026-09-25, verbatim: *"color setup can be like plain color or like
apples ombe style"* — then, simplifying it the same day (DECISION_LOG "COLOUR
SETUP = PICK ONE COLOUR + ONE EFFECT"): *"so the pick a color, and you apply
either plain, dawn, diagonal or glow effect. that's it"*.

The Maker's Colors panel: the couple picks **one colour** with the swatch, then
one of **four effects** — Plain (the flat colour that ships today), Dawn
(vertical, dark above and light at the horizon), Diagonal (a soft 160° blend
with a light bloom) or Glow (radial, lit from the top). Each effect chip is a
real preview derived from the picked colour, and a strip shows the effect at
size with the ink the page will use. No preset gallery, no multi-colour builder.

**How it is built (`apps/web/lib/ombre.ts`, pure):**

- **Derived from the one colour in OKLCH** (`color-space.ts`, the existing
  space — never reimplemented): a lighter anchor above it and a darker one
  below (lightness moved by `OMBRE_LIFT` / `OMBRE_DROP`, chroma kept alive, the
  hue turned a few degrees each way), interpolated in OKLCH so the ramp stays
  luminous. A near-white or near-black pick gives its lost room to the other
  side, so the ramp never collapses to a flat fill. The couple's colour is
  always drawn exactly — the middle of the ramp, or its end when the colour is
  already near white or black.
- **Legibility is re-measured over the whole ramp**, free, through
  `hubLegibility(theme, {kind:'media', samples})`: the theme's two inks are
  tried over the lightest and darkest sample; the one needing the lighter veil
  wins, and when neither clears AA bare (a mid-tone pick) the veil is baked into
  the CSS as the top layer. `ombre.test.ts` measures every theme × a sweep of
  picks × every effect. `--color-ink-on-plate` stays pinned to the theme's own
  ink, so a plate over a dark ombré does not go blank (the rule every theme
  block and the free-background fix keep).
- **Stored without a migration** in `events.site_bg_color` (TEXT, already
  granted, already in the draft): `ombre:<effect>:<hex>`, ≤ 22 chars.
  `parseSiteBackground` is the one reader of the column's two shapes; the live
  writer, the draft sanitiser and the guest loader all go through it. Noise is
  dropped, never repaired.
- **The guest page paints it**: `guestLookFrom` hands the CSS to
  `GuestLookScope`, whose fixed paper paints it **in place of the theme's loop**
  (a background replacing a background — no video decoded to hide it behind a
  gradient), and the invitation shell leaves its opaque paper off, Classic
  included. The host's canvas shows a drafted ombré through the same scope
  (`HostDraftLook`).
- **Drafted, never live** (`<HubDraftField />`, #5984's door): Apply, Undo and
  Restore cover it. `every-maker-form-drafts-or-says-so` stays green.
- **Free, behind one switch.** `OMBRE_IS_PRO = false` in `lib/ombre.ts`.
  Flipping it makes the ombré try-in-draft, pay-at-Apply through the existing
  gate (`eventItemIsPro` in `hub-draft.ts`; `ombreLookChange` combined into
  `updateSiteColors`' gate) with no other line changing.
- First-visit hint: `customer_ombre_background_v1` (`MiniTour` / `TOURS`),
  mounted beside the panel as the adaptive theme's is.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-25 rows "BACKGROUND COLOUR: PLAIN OR
APPLE-STYLE OMBRÉ" and "COLOUR SETUP = PICK ONE COLOUR + ONE EFFECT" — built as
recorded; free (controller's recommendation), one-line flip to Pro noted there.
