## 2026-09-29 · chore(event-hub): scene styles + Post Event folded onto main (supersedes #6106 #6107 #6110 #6114 #6115)

One branch from `origin/main` (Details live, d7bf4ce) with the five stacked PRs merged `--no-ff` in dependency
order: #6106 (Post Event slice 1 + the shared scene-style registry) → #6107 (Save the Date / Invitation / Day
styles) → #6110 (Post Event slice 2) → #6115 (the fixed parts' Style) → #6114 (Post Event presets + tour).

- **Seams against main.** Main's QR look is drafted (Apply writes it) — kept; #6115's direct-write refactor of
  `updateQrStyle` is dropped, and the draft overlay lays BOTH the drafted QR look and the fixed-part Style picks
  into the live `style_preferences` blob. The fixed-part panel draws its Style row above main's in-place Details
  fact. The bridge keeps main's scene runs (widget scenes only) on the scoped part path. `PickMenu` keeps both
  the Style hint/preview and main's `dotNote`. A guest with a march place keeps the shipped Dress code card (the
  Palette/Line styles draw no "you walk 5th" line). Tour copy says "A Pro theme" (Modern and Cyber Neon are free).
- **Maker stays under its JS budget — no budget raised.** The fold measured 511.5KB gz on the Maker's cold
  open (ceiling 505KB). Now **504.7KB**; shared bundle 201.9KB / 202KB. Every cut loads code where it is first
  used, in the EXISTING `maker-details` chunk (a new chunk grows the every-page webpack runtime):
  `editor/_components/scene-styles-lazy.tsx` (the Style rows, the Post Event scene panel, Post Event's "+"),
  `post-event-preset-tiles.tsx` (the twelve preset tiles). Registry-free modules for what the first screen
  needs: `lib/scene-style-id.ts`, `lib/post-event-preset-ids.ts`, `post-event-tile-words.ts`,
  `lib/hub-pro-effect-view.ts`; the registry-backed resolvers moved to `lib/post-event-style-resolve.ts` and
  `lib/fixed-scene-style-of.ts`, and the Maker reads Post Event's drawn styles from its navigator data
  (`postEvent.styles`, resolved on the server). Every moved name is re-exported from its old home.
- **Guard findings in the members fixed, not baselined:** counts through `formatCount`, the preset card's 44px
  floor, the editor's `style_preferences` read binds its error, the Clock face hand exempted as a real instant.

SPEC IMPACT: None (a fold; the members' own fragments carry their spec notes).
