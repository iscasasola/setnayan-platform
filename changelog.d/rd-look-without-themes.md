## 2026-10-05 · feat(maker): Look without themes — Background · Font · Colours · Buttons; moving backgrounds ◆; font free

Owner 2026-10-05 (DECISION_LOG "THEMES ARE REPLACED BY THREE DIRECT GLOBAL SETTINGS"):
*"instead of having a theme, we can let them just pick a background. and pick a font,
color, button style"*. Refines the shipped Look controls — no new screen.

- **Look has no Theme section any more** (phone lower third and desktop right panel draw the
  same `LOOK_SECTIONS`: Background · Font · Colours · Buttons). The theme dropdown, the
  "Your page / All themes" switch and the sample gallery are unmounted from the Maker; the
  Event Details record's Theme row is gone too. `events.invite_theme` stays as the page's
  internal default — no schema change.
- **Background › Moving background ◆** replaces "the theme's own": ONE PickMenu of every
  shipped loop (`hubMovingBackgroundIds`, named by `themeBackgroundName`). Picking one changes
  only what is behind the scenes. Stored as a new `HubMainGround` variant
  `{ ground: 'loop', loop }` on the hero row (sanitized to shipped themes with a loop); the
  page's own loop still stores `{ ground: 'theme' }` so nothing a couple had becomes a charge.
  Guest render: `mainGroundLayerFor` draws it through the one gated `MainGround` mount, only
  while the event owns Event Hub Pro (or on the host's own canvas, `tryOn`), on any theme —
  Classic included (the shell drops its opaque paper when a layer is drawn). Apply names it
  "Moving background · Behind every scene" and Remove takes it off alone.
- **Font is FREE**: `site_font_key` moved to `HUB_FREE_LOOK_EVENT_COLUMNS`, `siteLookChange`
  no longer compares it, the guest page paints the face for every event, and the Font row
  lost its ◆ and its app-store lock. Colours and Buttons stay free.
- Copy: "Theme" → "Look" (lower-third door, Details item, guided step), "The theme’s own" →
  "Default" (font lead, button shape/fill/colour, colour wells), "None — just the colour" →
  "Just the colour", film line "Same as theme" → "Same as the Event Hub".
- Guards re-pointed to the new rule (never deleted): the-look-is-one-panel,
  the-look-sheet-is-calm, the-main-background-offers-every-choice (+3c), try-pro-pay-at-apply
  (+ moving-background test), hub-look-pro, hub-fonts-are-loaded, free-vs-pro-redrawn,
  page-ground, the-guest-page-paints-the-ombre, every-fact-has-one-editor, the colours/film
  copy guards. Port-control baseline regenerated (the removed theme picker + segmented switch).

SPEC IMPACT: Implements DECISION_LOG.md row 2026-10-05 "THEMES ARE REPLACED BY THREE DIRECT
GLOBAL SETTINGS: BACKGROUND · COLOURS · FONT" (`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`).
No new corpus decision. Saved looks (Pro) are NOT in this change.
