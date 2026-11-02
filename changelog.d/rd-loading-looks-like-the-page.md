## 2026-09-27 · fix(event-hub): the loading screen is the page itself, loading

Owner, watching his own Event Hub load: *"before the actual website runs, i see
another website under"* — he chose "A matching skeleton" (DECISION_LOG row "THE
EVENT HUB'S LOADING SCREEN BECOMES A SKELETON OF THE REAL PAGE").

The Suspense fallback (`app/[slug]/_components/invitation-skeleton.tsx`) set the
couple's names in the theme's `font-display` (Playfair under Vintage) where the
masthead uses `font-pahina` (Fraunces), printed "Loading your Invitation…", and
drew grey boxes shaped like nothing on the page. It now renders:

- the real `PahinaMasthead`, with the words `site-body.tsx` gives it
  (`invitationCard` / `mastheadEyebrow` / `twoPeople`), so the card, the wake's
  quiet masthead and the hero-photo masthead each load as themselves;
- the couple's lettered mark via the real `HeroMonogram` (still). A drawn studio
  or uploaded mark, which can be up to 400 KB of SVG, is not streamed twice. It
  shows a shimmer circle the same size instead;
- the shell's pinned band and the shell's column at every width;
- scene placeholders inside `.sn-hub-cards`, so they are real scene cards;
- a shimmer in the theme's own ink and paper. "Loading…" is now `sr-only`.

Everything comes from the event row and the type profile `page.tsx` already
holds (`eventWordsFromProfile`, `resolveHero` and `resolveMonogram` are all
pure). There are no new reads and no new fonts.

Measured in a local harness (headless Chromium, 5 grounds × 390 px and 1440 px):
none of the band, card, mark, eyebrow or names move when the real page replaces
the skeleton. The old skeleton, used as a control, moved the names 286 px (390)
and 294 px (desktop). Browser CLS reads ~0 for both, because Suspense replaces
the nodes rather than moving them, so the geometry is the measurement.

Guarded by `app/[slug]/_components/the-loading-screen-is-the-page.test.ts`,
which has been checked by sabotage. `first-byte.test.ts` now asserts the house
`.skeleton` shimmer in place of `motion-safe:animate-pulse`.

SPEC IMPACT: None. This implements the 2026-09-27 DECISION_LOG row as recorded.
