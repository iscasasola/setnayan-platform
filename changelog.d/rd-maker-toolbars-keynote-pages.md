## 2026-09-27 · feat(maker): every Maker toolbar rebuilt after Keynote and Pages, as the approved prototype draws it

The approved prototype `prototypes/maker_toolbars_keynote_pages_2026-09-27.html` (owner's seven answers:
*"1. okay 2. okay 3. -+ only. 4. fold it 5. both 6. this stage 7. yes."*), translated:

- **Top bar** — Exit · Play · Add as Keynote's labelled buttons, the one place picker (kept as is),
  Scenes · View ▾ (Desktop · Phone · Both) · More ▾ (address · who can view · See it as… · Reset this
  stage… · Snap grid · About the Maker), Restore · Undo · Apply on the right. No Format / Animate /
  Arrange in the top bar — they live only as the inspector's tabs.
- **Scene inspector** — Format · Animate · Arrange · Content. Format → Background: No background ·
  Plain · Diagonal · Glow · Opaque · Frosted · Upload media (Dawn dropped per scene), one split colour
  well, Opacity 20–100% on both glasses, the couple's uploads + crop, Shape. After a pick it asks once:
  **Just this scene / Every scene** ("every scene" = this stage); a scene kept different wears
  **Own background · ↺ Use the Event Hub's**. The Transition tab folded into Animate (+ ▶ Preview).
- **Part inspector** — Part ▾ picker, then Text · Animate · Arrange: Font ▾, Weight (only where the face
  loads more than one), Size **− / + only** inside safe bounds, B · I · U, Colour (split well + Keynote
  Colour panel: wheel, brightness, opacity, theme + saved colours; a pop-over on desktop, a sheet
  section on the phone), Alignment (the whole hero at once), Line and Letter spacing,
  ↺ Use the Event Hub style; Animate with In ▾ and ▶ Preview; Arrange → Shown · Hidden.
- **The Joiner** — the word between the names is now a part: and · & · + · their own word, styled like
  any part. Guests see it; a solo name draws none.
- **Size model** — S · M · L · XL became a bounded percent scale; every saved S · L · XL keeps its exact
  look (85 · 120 · 145).

SPEC IMPACT: `DECISION_LOG.md` — one row recording the build of "MAKER TOOLBARS (KEYNOTE + PAGES)
APPROVED", with the three places it departs from the drawing (Duplicate has no scene action to
call, so Arrange offers Remove… for a couple's own scene only; Saved colours are the colours the
Event Hub already uses plus "+"-saved ones on the device; on a phone Restore · Undo · Apply keep their
own line under the tools, because the draft bar's labelled buttons do not fit a 390 px row).
