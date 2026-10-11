## 2026-10-12 · fix(sw): the Maker asks once — the service worker makes no request of its own for a page the host's app asks for

Owner: *"the key was to lessen the requests"*. Measured on a real event (Safari, a temporary server logger,
`controller-2026-10-08/speed/MAKER-WHO-ASKS.md`): 77 seconds in the Event Hub Maker — open, switch to the Invitation,
pick a part, two moves — rendered the guest page (31–34 database calls a render) about 22 times.

**Cause 1, fixed here.** After every canvas load a second request arrived for the BARE guest page (`/<slug>`;
`referer: /sw.js`, `sec-fetch-mode: no-cors`). It is not the worker's navigation handler: it is the `PRELOAD_ASSETS`
branch of its `message` listener. The guest page mounts `GuestPreload` in every render — the Maker's canvas included —
which asks the worker to keep `/<slug>` for offline, and the worker fetched it. The same canvas navigation was also
forwarded by the worker and its HTML copied into the day-of cache, for nobody.

`apps/web/public/sw.js` — a page the host's app asks for is now the browser's alone (no request by the worker, no
`respondWith`, no copy kept): an address with `editor=1` or a `phase` query; a navigation whose referrer is a document
under `/dashboard/` or `/site-editor/` (or is itself a host canvas); a page loaded into a frame (the guest page may only
be framed by this origin). New: `isHostCanvasUrl` · `isHostAppNavigation` · `isHostCanvasClient`. A guest's own visit, the
offline copy, the pass hops, the dashboard's event-day preload and the caching of code, images and fonts are unchanged.

Counted by `apps/web/app/sw-the-maker-asks-once.test.ts` (the worker run for real in a `vm`, 14 tests, 11 mutations each
red), and again in headless Chromium against the real worker: one canvas load **2 → 1** renders of the guest page ·
the warm-up of three stages **6 → 3** · six canvas loads **12 → 6** · a guest's own visit **2 → 2**.

Reaches a phone when the new `sw.js` is fetched (every page load calls `register('/sw.js')`, served `no-store`; the bytes
differ per deploy), installs (`skipWaiting`) and activates (`clients.claim`) — an already-open Maker stops making the
extra request from the canvas load after that, with no reload of the Maker.

**Causes 2, 3 and 4 — named, not changed** (they sit in files another builder is rewriting; the exact changes are in
`HANDOVER.md`): the 3–5 iframes at once are the Style cards (`stage-panel/style-preview.tsx`, one whole guest-page render
per style, loaded even while hidden under Edit); the "whole Maker page re-fetched without an rsc header" is
`router.refresh()` after an unheld save (`editor-shell.tsx` `move`) — Next strips `rsc` from `headers()`, so the logger
could not see it; the warm-up is `warmOnce` (`buffered-canvas-frame.tsx`), with a one-stage proposal for the owner.

Built, not live. No push, no PR.

SPEC IMPACT: None. (The guest's offline behaviour in `02_Specifications/Caching_and_Offline_Strategy.md` is unchanged.
The warm-up proposal, if the owner takes it, changes the DECISION_LOG 2026-09-28 row "THE MAKER LOADS EVERYTHING UP
FRONT" (3) and needs its own row then.)
