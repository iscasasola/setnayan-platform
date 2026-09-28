## 2026-09-28 · fix(event-hub): the loading screen wears the page's hero design

The Event Hub's loading screen (`app/[slug]/_components/invitation-skeleton.tsx`,
shipped in #6054 as "the page itself, loading") always drew Design 1 · The Card.
Hero Designs 2–4 (The Marquee · The Crest · The Letter, #6069) shipped after it,
so a page on any other design loaded as The Card and then jumped to its own
design. It was worst in the Maker, whose canvas reloads right after a design
is picked, so the couple saw the old design flash every time.

- `app/[slug]/_lib/hero-design-of.ts`: ONE hero-canvas read (`heroCanvasOf`),
  used by both `site-body.tsx` and the loading screen, then `heroDesignOf`.
  `heroDesignForSkeleton` overlays the host's draft first, the same way the
  body does (`overlayHubDraftWidgets`).
- `page.tsx`: the fallback is handed that design. The rows are the body's own
  `loadWidgets` read and, on the Maker canvas only, the host's draft
  (`hostCanvasDraft`, now the ONE gate both use). Every read is `cache()`d, so
  the body pays nothing for them again. The read starts right after the surface
  gate and is awaited at the boundary. It never throws: if it fails, the
  skeleton draws The Card, and the body still reports the failed read.
- Cost: the skeleton now flushes after the widget read (one query; plus the
  auth and draft reads on the Maker canvas), not before it. The page's total
  time does not change.

Tests: `the-loading-screen-is-the-page.test.ts` §5. It checks the rendered
hero for each of the 4 designs, with and without a hero photo. It checks the
resolver: the hero row only, draft over live, and The Card as the absence. It
also checks the wiring. Each test was seen to fail once under sabotage.

SPEC IMPACT: None. This implements the existing "THE EVENT HUB'S LOADING SCREEN
BECOMES A SKELETON OF THE REAL PAGE" ruling for the designs that shipped after it.
