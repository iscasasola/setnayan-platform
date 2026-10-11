# HANDOVER — rd/maker-asks-once ("THE MAKER ASKS ONCE")

Branch `rd/maker-asks-once`, cut from origin/main d2e38b7c1. Worktree `~/Documents/Claude/Projects/wt-maker-asks-once`.
Evidence: `~/Documents/Claude/Projects/controller-2026-10-08/speed/MAKER-WHO-ASKS.md`. No push, no PR. **Built, not live.**

The measured session, by cause (it adds up to the log's 22): open 1 · warm-up 3 + 3 bare · style cards 5 + 3 + 3 ·
two presses 2 + 2 bare. After this branch: **17**. With the three proposals below: 6 → 4 → 2.

## DONE (committed)
- **A · CAUSE 1 — FIXED** in `apps/web/public/sw.js`. The bare `/<slug>` after every canvas load is NOT the navigation
  handler. It is the `PRELOAD_ASSETS` branch of the `message` listener, asked by `GuestPreload`
  (`app/[slug]/_components/guest-preload.tsx`, mounted by `site-body.tsx` in every render, the canvas included).
  New in sw.js: `isHostCanvasUrl` · `sameOriginUrl` · `isHostAppDocument` · `isHostAppNavigation` · `isHostCanvasClient`.
  The message listener returns for a host-canvas / framed sender and never keeps a canvas address; the fetch listener
  returns (no respondWith, no copy) for a navigation the host's app makes.
- Test `apps/web/app/sw-the-maker-asks-once.test.ts` — 14 tests, the worker run for real in a `vm`; 11 mutations on a
  scratch copy (`SW_ASKS_FROM=<copy>`), each red. Counts before → after: one canvas load 2 → 1 · warm-up 6 → 3 ·
  six canvas loads 12 → 6 · a guest's own visit 2 → 2 (unchanged, pinned on purpose).
- Seen in headless Chromium against the REAL worker (stand-in pages + a request log, scripts in the session scratchpad
  `…/scratchpad/probe/{server,drive}.mjs`): the before run printed the measured log's own lines (canvas
  `mode=navigate dest=empty`, then `/ana-ben` with `referer: /sw.js`, `mode: no-cors`); after: canvas only, `dest=iframe`.
- Changelog fragment `changelog.d/rd-maker-asks-once.md` (SPEC IMPACT: None).
- Checks: the four neighbouring worker tests + `lib/guest-pass-hop.test.ts` green (65 tests). See "CHECKS" at the foot.

## HALF-DONE
- Nothing half-written in the tree.

## DIAGNOSED, NOT CHANGED — each sits in a DO-NOT-EDIT file. The exact changes:

### CAUSE 2 — 3–5 iframes of the same stage page at once = THE STYLE CARDS
`stage-panel/style-carousel.tsx` `StyleCards` mounts one `StylePreview` (`stage-panel/style-preview.tsx`) per style of
the picked part. Each is `<iframe sandbox="allow-same-origin" src="/<slug>?phase=…&editor=1&only=<key>&style=<type>:<id>">`
— a WHOLE server render of the guest page per card (5 for the Countdown, 4 for Gifts, 3 for the rest: the log's 5 · 3 · 3).
They load although the couple never opened Style: the toolbar opens on `edit` (`stage-panel/store.ts`
`let stageTool = 'edit'`), `StageStyle` (`stage-panel/stage-style.tsx`) still mounts the look body, and
`stage-tools.tsx` hides it only with `visibility:hidden`
(`[data-maker-shell]:has([data-stage-tool-now="edit"]) [data-phone-chrome="panel"]`) — and a hidden iframe still loads
(checked in Chromium: three `visibility:hidden` sandboxed frames = three requests). They are script-less, so no
`GuestPreload` ran in them — which is why no bare `/<slug>` followed those lines in the log.

THE CHANGE (one file, `stage-panel/style-preview.tsx`, `StylePreview`) — a miniature is asked for only once its card
can be SEEN:

```tsx
+import { useStageTool } from './store';
 …
   const canvas = useCanvasSrc();
-  const src = canvas && canvasKey ? stylePreviewSrc(canvas.src, canvasKey, sceneType, styleId, window.location.origin) : null;
   const width = canvas?.width ?? 375;
   const box = useRef<HTMLSpanElement>(null);
+  /* 🧯 A miniature is a whole render of the guest page: asked for only once its card is in sight. The look body waits
+     under Edit with `visibility:hidden`, and a hidden iframe still loads. */
+  const tool = useStageTool(); // a tool change is when a waiting body comes into sight — look again then
+  const [asked, setAsked] = useState(false);
+  useEffect(() => {
+    const b = box.current;
+    if (asked || !b) return;
+    const inSight = () => getComputedStyle(b).visibility !== 'hidden' && b.getClientRects().length > 0;
+    if (typeof IntersectionObserver === 'undefined') {
+      if (inSight()) setAsked(true);
+      return;
+    }
+    const io = new IntersectionObserver((es) => {
+      if (es.some((e) => e.isIntersecting) && inSight()) setAsked(true);
+    }, { rootMargin: '0px 96px' });
+    io.observe(b);
+    return () => io.disconnect();
+  }, [asked, tool]);
+  const src = asked && canvas && canvasKey ? stylePreviewSrc(canvas.src, canvasKey, sceneType, styleId, window.location.origin) : null;
```
While `src` is null the card already says "Drawing…" (`data-style-preview="loading"`), so nothing new is drawn.
Effect: a part picked and edited without opening Style = 0 renders (was 3–5); Style opened = the cards in the strip's
view (the picked one and its neighbours), the rest as they are swiped in. ⚠ It trades away "the cards are already drawn
when Style opens" — show the owner side by side before merging. Counting test to add beside it: mount `StyleCards`
under a `visibility:hidden` parent → 0 iframes with a `src`.
LATER, bigger: (i) the picked card is the canvas's own part — copy it from the shown frame instead of asking the
server; (ii) one request for all of a part's cards (`&style=<type>:<id1>,<id2>,…`, `app/[slug]/_lib/style-preview.ts`
`withStylePreview` lays each over the rows ALREADY read — one read of the event, N draws) and each card frames the same
HTML with `srcdoc` (`lib/maker-tile-preview.ts` already does this for tiles).

### CAUSE 4 — "each press re-fetches the whole Maker page, no rsc header" = `router.refresh()`; the missing header is the LOGGER's
Next deletes `rsc` · `next-router-state-tree` · `next-router-prefetch` from what `headers()` returns
(`next/dist/server/async-storage/request-store.js` `getHeaders` → `FLIGHT_HEADERS`), so a server component can never see
them: every RSC refresh reads as "no rsc". (`next-action` is not stripped, so "not a server action" is true.)
The chain for Earlier / Later: `editor-shell.tsx` `move` → `releaseCanvas()` + `makerSave(() => draftAction(eventId, fd),
requestMakerRefresh)` (UNHELD) → `MAKER_REFRESH_EVENT` → `hub-draft-bar.tsx` `router.refresh()` (one whole-Maker render)
→ a new `renderStamp` → `canvasStamp` moves → `BufferedCanvasFrame`'s `frameKey` changes → a new `loading` iframe = a
guest-page navigation. That is `lib/maker-refresh.ts` working as designed for a write the bridge did not draw.

THE CHANGE (for the builder rewriting moves): a move the canvas has ALREADY DRAWN is a HELD save.
1. the bridge draws the reorder (the drag-and-drop work moves the section in the page);
2. `move` stops calling `releaseCanvas()`, takes a hold that carries the MOVED order
   (`holdChange(…, { canvases: drawnCanvases(), order: <canvasOrderOf with the override> }, …)`), sets
   `fd.set(HUB_DRAFT_BAR_FIELD, '1')` (the Apply · Undo count rides on the answer) and saves with
   `makerSave(…, requestMakerRefresh, { held: true })`;
3. `lib/maker-settle.ts` `settleVerdict` must stop waiting for a NEW frame for such a write (today "shown" = the frame on
   show changed; a held move never changes it and would wait the full 20 s) — settle on "no save in flight".
   → a press costs 1 POST and NO render: no Maker render, no guest-page render (today 1 + 1).
If the bridge cannot draw it yet, the half step is `makerRedrawSave` (as `scene-style-row.tsx` does): no Maker render,
ONE in-place render of the canvas (`CANVAS_REFRESH_MESSAGE` → the bridge's `router.refresh()`), same frame — but the
settle watch then needs the bridge to say when that redraw has painted (`editor-bridge.tsx` posts nothing today).

### CAUSE 3 — the warm-up — PROPOSAL ONLY (needs the owner's word: it trades against his one-second ruling)
Where the rule is: `buffered-canvas-frame.tsx` `warmCanvasBudget` (3 kept; 0 on save-data or a phone with ≤ 4 GB),
`warmOnce` (once per open, on idle, one at a time, over at the first save), `editor-shell.tsx` `warmStageOrder` (nearest
first). Rulings: DECISION_LOG 2026-09-28 "THE MAKER LOADS EVERYTHING UP FRONT…" (3) *"the other stages load hidden
behind the canvas once it is up"*; and 2026-10-08 (NOT in the DECISION_LOG — `CONTROLLER-NOTES.md` 15:45 and the test's
header): the fetch-ahead was removed, the owner allowed it *"For as long as it doesnt take kore than 1 second"*, and the
once-per-open warm is the fallback that was then built.

PROPOSED RULE: **an open warms ONE stage — the next one in order (the previous one from the last stage) — and nothing
else until the couple asks.** Everything else stays: on idle, after the page on screen is up, tab visible, none on
save-data / ≤ 4 GB / "view as", over at the first save, never twice; a stage the couple HAS opened is still kept (3).
- `buffered-canvas-frame.tsx`: `export const MAX_WARM_AHEAD = 1;` and in the warm effect
  `warmOnce(s, warmLeft.current, wantedRef.current, Math.min(warmMax, MAX_WARM_AHEAD), …)` — the KEEP budget
  (`trimWarmFrames`, `warmMax`) is untouched.
- `editor-shell.tsx` `warmStageOrder`: on a tie, the LATER stage first (`order.indexOf(b) - order.indexOf(a)`).
- `lib/the-other-stages-are-warmed-once.test.ts`: "per open" becomes 1 extra page, not 3.
Cost per open 3 → 1 guest-page render. The measured session: 3 → 1 (the couple opened exactly that stage).
What it gives up: a first visit to a stage that is NOT the next one loads cold (over a second) — that is the part of
the ruling the owner must weigh. NOT "after the first interaction", as first leaned: the first interaction of the
measured session WAS the stage switch, so the warm would have started too late to help it.

## FOR THE NEXT LOGGING PREVIEW (`preview/canvas-who-asks` — never merge; cherry-pick 9a0bb28f5 onto a throwaway preview of this branch)
Add to the `[who-asks]` `at: 'slug'` line: `only: search.only ?? null`, `style: search.style ?? null`, `bars`, `as` —
after this branch every canvas reads `dest: 'iframe'`, so only `style` tells a style card from a canvas.
Drop `rsc` / `hasStateTree` / `prefetch` (always null — Next strips them) and log `mode` on the `at: 'maker'` line:
`mode: 'cors'` + `dest: 'empty'` is `router.refresh()`; `mode: 'navigate'` + `dest: 'document'` is a real reload.
(To see the raw `rsc` header, log it in `middleware.ts`.)
WHAT TO LOOK FOR on a real phone, same walk (open · Invitation · pick a part · Earlier · Later):
- NO line with `"referer":"/sw.js"` — once the new worker is active (the first canvas load after the deploy may still
  show one: the old worker answers until the new one has installed and claimed).
- canvas lines read `"dest":"iframe"`, no longer `"mode":"navigate","dest":"empty"` (that pair meant "forwarded by the
  worker").
- total guest-page lines for the walk: 17 (1 open · 3 warm · 5 + 3 + 3 style cards · 2 presses), down from 22.
ONLY A PHONE CAN SAY: that Safari reports a framed client as `frameType: 'nested'` / `destination: 'iframe'` (the
address test covers the canvas either way); how soon iOS fetches the new `sw.js` in an already-open Maker; and whether
the 5 · 3 · 3 lines carry `style=` (Chromium forwards sandboxed frames through the worker; the Safari log showed them
as `dest=iframe`, i.e. not forwarded).

## SEEN IN PASSING (not touched)
- A GUEST'S OWN VISIT IS TWO RENDERS (navigation + `GuestPreload`'s preload of the same address) whenever the worker
  controls the page — every visit after the first. Left exactly as it is (the brief; and it is the only offline copy for
  a guest who arrived on a personal link). The cut, for the guest-speed branch: skip the preload of an address the
  day-of cache already holds (`caches.match`), in sw.js's `PRELOAD_ASSETS`.
- `GuestPreload` could simply not mount in the host canvas (`site-body.tsx`, `isEditorCanvas`) — belt and braces for
  this fix, and it would reach an open Maker without waiting for a worker update. Guest component: not this branch's.
- `/sw-offline.js` (`offline-daemon-mount.tsx`, behind `NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED`, off by default) registers
  at the SAME scope as `/sw.js`. One scope holds one worker: switching it on would replace this worker, not add to it.

## NEXT THREE STEPS
1. Hand the three proposals to the owner (cause 3 needs his word) and to the stage-panel / moves builder (causes 2, 4).
2. Lab run with a request log once the heavy lock is free (a logging proxy in front of `next dev`; count document
   requests per action by `sec-fetch-dest` and address) — to SEE the style cards load under Edit, and the press chain.
3. After merge + deploy: a throwaway logging preview, the same walk on a real phone, and the lines listed above.

## CHECKS (kept true)
- worker tests: `npx tsx --test app/sw-the-maker-asks-once.test.ts app/sw-is-a-pass-through-on-a-dev-host.test.ts app/sw-keeps-code.test.ts app/sw-reserved-routes.test.ts lib/guest-pass-hop.test.ts` (from `apps/web`) → 65 pass, 0 fail.
- full `tsc` under the heavy lock (waited 22 min in line), from `apps/web`: **rc 0, 0 errors** at 04b63fc95 (docs-only commits
  since). `.next` was not absent: it held `cache/` only (one eslint cache file preflight wrote), no `.next/types` and no
  `.ts` file — so the program was the same as with it absent.
- preflight quick half (`--only guards,lint,types,pins`) at 41ba8056b: 43 cheap CI guards PASS · eslint PASS · targeted
  tsc PASS · the 5 worker tests PASS (65).
- NOT RUN: the lab (`/dev/maker-lab?studio=1`) with a request log — the heavy lock was held by another builder's
  `next dev` with four in line. Causes 2 and 4 are from the code, matched to the log (5 · 3 · 3 = the style-set sizes;
  the causes add up to its 22); cause 1 was run in headless Chromium against the real worker.
