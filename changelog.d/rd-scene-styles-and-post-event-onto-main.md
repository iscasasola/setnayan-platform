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
- **Maker stays under its JS budget.** The Style rows and the Post Event scene panel load when first opened
  (`editor/_components/scene-styles-lazy.tsx`, in the EXISTING `maker-details` chunk — no new chunk, so the
  every-page webpack runtime does not grow); the navigator's tile words moved to `post-event-tile-words.ts`.
- **Guard findings in the members fixed, not baselined:** counts through `formatCount`, the preset card's 44px
  floor, the editor's `style_preferences` read binds its error, the Clock face hand exempted as a real instant.

SPEC IMPACT: None (a fold; the members' own fragments carry their spec notes).
