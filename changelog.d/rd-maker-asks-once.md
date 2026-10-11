## 2026-10-12 · perf(maker): the Maker asks once — the worker's own requests gone, only the next stage warmed, Style cards drawn only in sight, a guest's visit one render

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
the warm-up of three stages **6 → 3** · six canvas loads **12 → 6** (a guest's own visit: see below).

Reaches a phone when the new `sw.js` is fetched (every page load calls `register('/sw.js')`, served `no-store`; the bytes
differ per deploy), installs (`skipWaiting`) and activates (`clients.claim`) — an already-open Maker stops making the
extra request from the canvas load after that, with no reload of the Maker.

**Cause 3, the warm-up — built (owner ruling 2026-10-12, DECISION_LOG: "which has the fewest requests and fastest load
time").** An open now warms ONE other stage — the next one in order (the previous one from the last stage), on idle,
after the page on screen is up, once — instead of three. `buffered-canvas-frame.tsx`: `MAX_WARM_AHEAD = 1` caps what
`warmOnce` loads unasked; the keep budget (`MAX_WARM_FRAMES = 3`) is untouched, so a stage the couple OPENED is still kept
and switching back is instant. `warmStageOrder` moved beside it (pure, exported) and breaks a tie toward the LATER stage.
Per open: 3 unasked guest-page renders → 1 (`lib/the-other-stages-are-warmed-once.test.ts`, 2 guest pages per open, the
order pinned on every stage; 3 sabotages red). Gives up: a first visit to a stage that is not the next loads cold.

**Cause 2, the Style cards — built.** Each card is an iframe of the guest page (a whole server render), and they loaded
while the look body waited under Edit with `visibility:hidden` — 11 of the measured 22 renders. `StylePreview`
(`stage-panel/style-preview.tsx`) now sets its address only once the card is near the screen (IntersectionObserver, the
strip's neighbour) AND in sight (`styleCardInSight`); the toolbar attributes that hide the body are watched. Asked once,
never un-asked; while it waits the card says "Drawing…" as before. A part edited without opening Style: 0 renders (was
3–5). `lib/a-style-card-asks-only-in-sight.test.ts` (3 tests, 3 sabotages red; one cross-checks that every attribute
`stage-tools.tsx` hides the body by is watched).

**A guest's own visit — one render (for the guest-page speed branch).** `GuestPreload` asks the worker to keep the page's
own `/<slug>`; when the worker answered that navigation the day-of handler already keeps it, so the preload was a second
full render on every visit after the first. `sw.js` now skips exactly the SENDER'S OWN address, and only while its
`DAYOF_CACHE` copy is held or still being written (`DAYOF_WRITES`, `dayOfCopyHeld`). The first visit, a personal-link
pass hop and a hard reload still get their preload copy. A guest's visit **2 → 1**, offline reload still served (vm test
+ headless Chromium against the real worker; 4 mutations red).

**Cause 4, a press re-renders the Maker — named, not built here**: it belongs to the drag-and-drop branch
(`rd/c-drag-scenes`), which already draws the move on the page; the exact hunk for it is in this branch's
`HANDOVER.md` ("THE HELD MOVE").

SPEC IMPACT: DECISION_LOG 2026-10-12 "THE MAKER WARMS ONLY THE NEXT STAGE" (already recorded by the owner's ruling,
corpus commit d93cacd) is what this builds; no new corpus edit. The guest's offline behaviour in
`02_Specifications/Caching_and_Offline_Strategy.md` is unchanged (the day-of copy is still made on every answered visit).
