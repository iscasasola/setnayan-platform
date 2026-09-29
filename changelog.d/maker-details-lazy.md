## 2026-09-29 · perf(maker): Details pieces load when they are opened, not with the Maker

The train's CI "bundle size check" failed: the Event Hub Maker's first-load
JavaScript was **643.5KB gz** (64 chunks) against its **505KB** ceiling
(`apps/web/scripts/check-maker-js-budget.mjs`), with Details shut on a cold open.

**Cause.** Next puts every `'use client'` module that a route's *server* files
import into that route's first load, eagerly (`next-flight-client-entry-loader`,
`webpackMode: "eager"`), whether or not the page ever draws it. Folding Details
in made the Maker's server graph reach the Mood Board editor, the Schedule page,
the prints, Your event, the march panel, RSVP, the Logo studio and the Reveal
picker. Measured from the build's own manifests (`app-build-manifest.json` for
the chunks, the route's `page_client-reference-manifest.js` for chunk → module),
the chunks that left are: Mood Board studio 30.4KB + its venue catalogue 16.4KB +
palette/colour names 10.0 + 6.1KB + checkout 7.0KB; Details pieces 29.6KB; the
Schedule's day rail 16.6KB + controls 6.1KB + run-of-show header 4.1KB; Your
event's venue/date fields 7.7 + 10.6KB; Logo 6.2 + 4.2KB (+7.6KB inside a shared
chunk); Reveal 3.5KB; RSVP settings 2.7KB; the walking-order lines 2.9KB.

**Fix.** Server files import client-side `next/dynamic` stand-ins with the same
names and props — `launch/_components/details-lazy.tsx`,
`studio/mood-board/_components/mood-board-lazy.tsx`,
`schedule/_components/schedule-lazy.tsx`,
`guests/_components/entourage-lazy.tsx` — each holding its slot with a
shape-matched skeleton (`launch/_components/lazy-slot.tsx`) until its code
arrives. The pieces travel as three named chunks (`maker-details` 32KB,
`maker-mood-board` 30KB, `maker-schedule` 8KB gz). The Maker fetches them once
it has loaded and the phone is idle (skipped under Save-Data), and a Details
navigator row fetches on hover/focus. A Maker opened at `?tool=details` renders
the pieces on the server and preloads their code, as before.

Stays in the first load on purpose: the Details navigator/workspace, the theme
pick's provider (it wraps the navigator), the print-words form's own fields (a
field not yet arrived would be missing from a words save), the Hero/Reveal/Logo
frames and the Love Story moment sheet (measured: lazy cost the every-page
webpack runtime more than it saved), and the parent guest card + Requests rows
(the Guest list and Requests page draw them as their main content).

**Measured after (local `next build`, CI env):** Maker first load **499.1KB gz,
54 chunks** (5.9KB headroom). Shared bundle (`check-bundle-size.mjs`)
**201.9KB** vs 202KB — the webpack runtime grew 4.0 → 4.3KB because async groups
need map entries; an unnamed first cut grew it to 4.9KB and failed that ceiling,
which is why every `import()` names its chunk.

Guard: `launch/_components/details-pieces-are-lazy.test.ts` — walks the Maker
route's server graph as Next does and fails if any module a stand-in loads is a
first-load boundary again, if a stand-in export is not a `dynamic(() =>
import(…))` or imports its piece statically, if an `import()` has no
`webpackChunkName`, or if anything in the first-load closure imports three.js,
react-three, opentype.js or fabric. Sabotaged five ways (a server file importing
`./qr-look-controls` directly; a stand-in statically importing its piece; a
non-dynamic export; `three` in `details-workspace.tsx`; an unnamed `import()`),
each caught. Four render tests (`fast-print-previews`, `free-themes-are-free`,
`theme-print-previews-wear-the-theme`, `paid-mark`) render again once the lazy
pieces arrive, so they assert the real prints, not their loading slots.
`scripts/port-control-baseline.json` regenerated for the new files.

SPEC IMPACT: None.
