## 2026-10-17 · feat(effects): the six new effects — Word by word · Spread · Glow · Develop · Curtain · Light leak

Owner-approved 2026-10-16 (DECISION_LOG "APPROVED — SIX NEW EFFECTS: WORD BY WORD · SPREAD · GLOW (TEXT), DEVELOP ·
CURTAIN · LIGHT LEAK (PICTURES)", verbatim *"Approved — build the six effects as the prototype shows."*; priced by "ALL
ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆"); prototype `prototypes/text_image_effects_2026-10-16.html`
(corpus fe1e85e0).

- **Text (a cover word):** Build in's row 4 gains **Words ▾** — All at once · Word by word ◆ · Spread ◆ — beside Movement
  and Delay (the slot Rows ▾ has on a scene); Action ▾ gains **Glow ◆** (Still · Drift · Shimmer ◆ · Glow ◆). The words
  are cut into spans server-side (`lib/part-fx.ts`, `pahina-masthead.tsx` `txt`) so a guest's first frame is already
  cut; Spread cuts letters only up to 24, a longer line opens as one piece (`scaleX`). Glow is a blurred copy of each word
  under it (`::before { content: attr(data-t) }`) — never `text-shadow`, never text a reader of the part finds.
- **Pictures:** the cover's photo plate is now a part — **Photo** (hero el `photo`, Maker part `coverphoto`, Animate
  only; its picture stays Details' "Cover photo"). Build in's row 4 gains **Reveal ▾** — Plain · Develop ◆ (sepia →
  colour, `filter`) · Curtain ◆ (centre outwards, `clip-path`); Action ▾ = Still · Drift · Ken Burns · Parallax ·
  **Light leak ◆**. Parallax is the plate's own (an absence — nothing changes for a live page); Light leak is the shipped
  ambient `leak` (`AmbientEffectLayer`) drawn inside the photo.
- **Reduced motion and Save-Data show the finished state** — every animation sits behind `prefers-reduced-motion:
  no-preference` and `:root:not(.sn-save-data)`; outside it the words are at rest, the photo whole and in colour, Glow's
  halo held at its middle strength, the flare held faint (the ambient sheet's own still, the same on Save-Data).
- **Pro ◆, the shipped way** (as Shimmer, #6592): tried free in the Maker, ◆ on each new choice, held at Apply through
  the part's own motion facet and **named by its own name** on the Apply sheet (`hubElementEffectNames`). The broader Pro
  re-gate of the existing Animate/Style is a separate build.
- The Maker canvas lays each pick at once (`part-fx-cut.ts`, the bridge's instant preview), the same cut the server
  draws; ▶ replays the words and the reveal. The lab draws the plate with the `lab_plate=1` cookie.
- Guards: `lib/six-effects-finish-still-and-ask-pro.test.ts` (new — the finished state under reduced motion and
  Save-Data, and each named Pro at Apply; 5 sabotages caught); `element-preview.test.ts` (canvas cut = guest cut);
  `shimmer-is-an-action-on-any-text.test.ts` (4) now asks the closed sets and the Apply sheet itself instead of
  matching source.

SPEC IMPACT: None — builds the approved prototype and DECISION_LOG rows as ruled. Calls made where the record is silent
(named in the PR for the owner): the picture is the cover's photo plate (a new part "Photo"); Words ▾ and Glow are the
cover's text parts (the server cuts them), a scene's words keep Still · Drift · Shimmer; Glow's halo is the theme's
accent.
