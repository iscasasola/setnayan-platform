## 2026-09-26 · feat(event-hub): the page background is plain OR an Apple-style ombré, free, legible, drafted

Owner, 2026-09-25, verbatim: *"color setup can be like plain color or like
apples ombe style."* The Maker's Colors panel now has a two-way switch,
**Plain | Ombré**. Plain is the one colour that ships today. Ombré is a soft
multi-stop gradient — 3–4 presets curated for each of the ten themes, drawn as
real mini gradients, plus "Make my own": two or three colours and one of three
shapes (soft diagonal · radial glow · vertical dawn), previewed live with the
ink the page will use.

**How it is built (`apps/web/lib/ombre.ts`, pure):**

- The ramp is interpolated in **OKLCH** (`color-space.ts`, the existing
  space — never reimplemented), so a blend between two saturated colours keeps
  its chroma instead of greying through the middle. Nine samples, drawn and
  measured as one ramp.
- **Legibility is re-measured over the whole ramp**, free, through
  `hubLegibility(theme, {kind:'media', samples})`: the theme's two inks are
  tried over the lightest and darkest sample; the one needing the lighter veil
  wins, and when neither clears AA bare the veil is baked into the CSS as the
  top layer. Every curated preset clears AA with **no veil** (`ombre.test.ts`).
- **Stored without a migration** in `events.site_bg_color` (TEXT, already
  granted, already in the draft): `ombre:<shape>:<hex>,<hex>[,<hex>]`, ≤ 40
  chars, one grammar for presets and custom. `parseSiteBackground` is the one
  reader of the column's two shapes; the live writer, the draft sanitiser and
  the guest loader all go through it. Noise is dropped, never repaired.
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

SPEC IMPACT: `DECISION_LOG.md` 2026-09-25 row "BACKGROUND COLOUR: PLAIN OR
APPLE-STYLE OMBRÉ" — built as recorded; free (controller's recommendation),
one-line flip to Pro noted there.
