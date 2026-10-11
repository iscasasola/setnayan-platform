# HANDOVER — rd/maker-asks-once ("THE MAKER ASKS ONCE")

Branch `rd/maker-asks-once`, cut from origin/main d2e38b7c1. Worktree `~/Documents/Claude/Projects/wt-maker-asks-once`.
Evidence: `~/Documents/Claude/Projects/controller-2026-10-08/speed/MAKER-WHO-ASKS.md`. Lock label `asks-once`.
Owner ruling 2026-10-12 (corpus DECISION_LOG, commit d93cacd): the Maker warms ONLY the next stage — *"which has the
fewest requests and fastest load time"*. **Built, not live.**

The measured session (open · Invitation · pick a part · Earlier · Later = 22 guest-page renders), by cause:
open 1 · warm-up 3 + 3 bare · style cards 5 + 3 + 3 · two presses 2 + 2 bare.
After this branch (counted, see LAB below): open 1 · warm-up 1 · style cards 0 (Style not opened) · two presses 2 → **4**
for the same walk (cause 4 — the presses — is the drag branch's; with its held move below: 2).

## DONE (committed)
1. **CAUSE 1 — the worker's own request for the bare `/<slug>` after every canvas load** (`public/sw.js`,
   `isHostCanvasUrl` · `isHostAppNavigation` · `isHostCanvasClient`). One canvas load 2 → 1 renders.
2. **CAUSE 3 — THE WARM-UP: the next stage only** (99a91a88b). `buffered-canvas-frame.tsx`: `MAX_WARM_AHEAD = 1`, the
   warm effect calls `warmOnce(…, Math.min(warmMax, MAX_WARM_AHEAD), …)`; the KEEP budget (`MAX_WARM_FRAMES = 3`,
   `trimWarmFrames`) is untouched, so a stage the couple opened is still kept. `warmStageOrder(stage, order)` moved here
   from `editor-shell.tsx` (pure, exported; tie → the LATER stage: next, or the previous from the last stage).
   `lib/the-other-stages-are-warmed-once.test.ts`: an open = 2 guest pages (was 4); the order pinned on every stage; the
   component wired to the cap. Sabotage: component back to `warmMax` → red · `MAX_WARM_AHEAD = 3` → 8 red · tie to the
   earlier stage → 4 red; restored green.
   ⚠ Gives up (owner accepted it in the ruling): a first visit to a stage that is NOT the next loads cold.
3. **CAUSE 2 — THE STYLE CARDS: asked only in sight** (53ee5fc0c). `stage-panel/style-preview.tsx` `StylePreview`: `src`
   only once `asked`, set when the card is near the screen (IntersectionObserver, `rootMargin: '0px 96px'`) AND
   `styleCardInSight` (has a box, not `visibility:hidden`); a MutationObserver on `SIGHT_ATTRIBUTES`
   (`data-stage-tool-now` · `data-stage-edit-own` · `data-stage-edit-card` · `data-stage-own-rows` · `aria-hidden`)
   looks again when the toolbar shows the look body (a visibility change moves no box, so IO is not told). Asked once,
   never un-asked. New `lib/a-style-card-asks-only-in-sight.test.ts` (3 tests; one reads `stage-tools.tsx`'s
   `visibility:hidden` rules and fails if a NEW hiding attribute is not watched). Sabotage: ungated `src` → red ·
   `data-stage-own-rows` unwatched → red · visibility ignored → red; restored green.
   ⚠ Trades away "the cards are already drawn when Style opens": they draw when Style opens ("Drawing…" meanwhile).
   LATER, bigger (not built): the picked card is the canvas's own part (copy it from the shown frame); or ONE request for
   all of a part's cards (`&style=<type>:<id1>,<id2>…`, `app/[slug]/_lib/style-preview.ts` `withStylePreview` lays each
   over the rows already read) with `srcdoc` per card (`lib/maker-tile-preview.ts` does this for tiles).
4. **A GUEST'S OWN VISIT IS ONE RENDER — the cut `rd/speed-guest-page` asked for** (3a39f8941, ONE commit, named
   "perf(sw): a guest's own visit is ONE render…"). `sw.js` `PRELOAD_ASSETS` skips exactly the SENDER'S OWN address
   (`clientAddress(event.source)`), and only while its `DAYOF_CACHE` copy is held or still being written
   (`DAYOF_WRITES` set by the day-of handler; `dayOfCopyHeld` waits for it). The first visit (worker not yet in
   control), a personal-link pass hop, a hard reload: no day-of copy → preload made as before (still their offline copy).
   `app/sw-the-maker-asks-once.test.ts` +4 tests (18 now); 4 mutations each red (skip removed · held-check removed ·
   wait removed · own-address check removed). Real Chromium against the real worker (`scratchpad/probe/drive.mjs`):
   guest visit under the worker 2 → **1** (`/ana-ben navigate/empty` only), offline reload still serves the page;
   first-ever visit 1 → 1 (unchanged — that one never had a preload copy in the stand-in either: no controller yet).
   → **Controller: tell `rd/speed-guest-page` this cut is HERE; it should NOT also edit `sw.js`'s `PRELOAD_ASSETS`.**
5. **FOUND IN THE LAB, FIXED — the warmed stage was thrown away** (25e18e3ca). Frame add/remove + message events showed
   the one warmed stage mounted, then 300 ms later the Maker's open pick (`markEl`, `scrollTo`) DROPPED it
   (`canvasPosts` dropped every kept frame not yet `ready`) — its server render wasted, the stage loaded again when
   opened. (On main the same happened to all three warmed stages.) Now a DRAWN pick `wait`s for a kept frame still
   loading and is posted, in order, at its `ready` (cap `MAX_WAITING_PICKS` = 200, past it the frame is let go); a
   REDRAW still drops it (it may predate the save). Test + 2 sabotages red. Lab after the fix: the warmed frame is held
   and opening The Day requests NOTHING.
6. **FOUND IN THE LAB, FIXED — Style cards asked for the stage being LEFT** (b510cdeae). With Style open, a stage switch
   mounted the cards in the commit that switches, while the frame on show was still the old stage: each card asked for
   the old stage's page, then the new one's. `useCanvasSrc` now reads two animation frames after mount (and at 600 ms; an
   unchanged address asks nothing new). Test + sabotage red.
7. Changelog fragment `changelog.d/rd-maker-asks-once.md` (rewritten for all four; SPEC IMPACT: the ruling d93cacd is
   what this builds — no new corpus edit).

## THE HELD MOVE — for `rd/c-drag-scenes` (CAUSE 4; NOT built here — drag is that branch's)
Today a drop / Earlier / Later = `editor-shell.tsx` `move` → `releaseCanvas()` + UNHELD `makerSave(…, requestMakerRefresh)`
→ `hub-draft-bar.tsx` `router.refresh()` = ONE WHOLE-MAKER render → new `renderStamp` → `canvasStamp` moves → a NEW
loading iframe = ONE full guest-page document load. Per press: 1 POST + 1 Maker render + 1 guest page.

⚠ What blocks the FULL hold (0 renders): the drag engine's order is only SLIDES (`scene-canvas-drag.ts`: transforms,
"held by the slides until the page the save brings draws it"), `placeNow` refuses while `slid`, `standingBetween` /
`subject.beside` read DOM order — and the bridge has NO message that reorders sections (`editor-bridge.tsx` handles
refresh · mainGround · sceneBg · … · sceneShow, no order). A real DOM reorder inside a React-hydrated guest page would
fight React's next reconcile. So build the HALF step — no Maker render, no new document, ONE in-place redraw of the
page on screen — which the shipped `makerRedrawSave` already is (`scene-style-row.tsx`, `fonts-look-rows.tsx`):

**(a) `apps/web/app/[slug]/_components/editor-bridge.tsx`** — say when an in-place redraw has painted (the transition
ending IS the render committed; the effect already exists for the ground preview):
```tsx
   useEffect(() => {
-    if (wasRedrawing.current && !redrawing) groundPreview.current?.redrawDone();
+    if (wasRedrawing.current && !redrawing) {
+      groundPreview.current?.redrawDone();
+      /* 🔁 The Maker waits on this for a held move: the page now draws the new order (`maker-settle.ts`). */
+      window.parent?.postMessage({ source: 'setnayan-site', t: 'redrawn' }, window.location.origin);
+    }
     wasRedrawing.current = redrawing;
   }, [redrawing]);
```
**(b) `maker-part-ops.ts`** (both `MakerPartRaw` and `MakerPartOps`):
`move: (id: string, delta: number, drawn?: boolean) => void;` — `add-part-sheet.tsx` `partOpsOf` already passes
`move: raw.move` through.
**(c) `editor-shell.tsx` `move`** — the draft-action branch (anchor: `if (order && patch && elementEditing) {`):
```tsx
-  const move = (id: string, delta: number) => {
+  const move = (id: string, delta: number, drawn = false) => {
 …
     if (order && patch && elementEditing) {
-      releaseCanvas();
+      /* ✋ A move the page already SHOWS (the drag's slides): no Maker render and no new canvas document — the page
+         on screen redraws ITSELF once the save lands (`makerRedrawSave`), and a Maker render arriving meanwhile with
+         exactly this order keeps it (the hold carries the moved order). */
+      if (drawn) {
+        canvasHold.current = holdChange(
+          canvasHold.current,
+          { canvases: drawnCanvases(), order: canvasOrderOf({ ...navigator.stageLists, [stage]: optimisticStageList(navigator.stageLists[stage], order) }) },
+          { canvases: drawnCanvases() },
+          Date.now(),
+        );
+      } else releaseCanvas();
       setOrderOverride({ stage, order });
 …
       fd.set('patch', JSON.stringify(patch));
+      if (drawn) fd.set(HUB_DRAFT_BAR_FIELD, '1'); // the Apply · Undo count rides on the answer
       reorderQueue.current = reorderQueue.current
-        .then(() => makerSave(() => draftAction(eventId, fd), requestMakerRefresh))
+        .then(() => (drawn ? makerRedrawSave(() => draftAction(eventId, fd), requestMakerRefresh, (r) => r.ok) : makerSave(() => draftAction(eventId, fd), requestMakerRefresh)))
 …
           /* ↩ Refused: the list goes back to what is saved, and the toolbar says so. */
           setOrderOverride(null);
+          if (drawn) releaseCanvas(); // the slid page must reload to the truth
```
(`canvasOrderOf` is imported from `./element-preview` already; `optimisticStageList` from `@/lib/maker-reorder`; add
`makerRedrawSave` to the `@/lib/maker-refresh` import.) `orderOverride` needs no change: it clears when the next
render's `fullOrders` matches (`sameOrder`).
**(d) `add-part-sheet.tsx` `dropOn`** — a move the engine slid is `drawn`, and its wait is NOT `whenCanvasShowsIt()`
(that waits for a NEW frame, which never comes → 20 s): wait for the save, then the redraw:
```tsx
-  const dropOn = (o: MakerPartOps, t: MoveTarget, where: 'above' | 'below', at: At = here): Promise<CanvasSettle> | null => {
+  const dropOn = (o: MakerPartOps, t: MoveTarget, where: 'above' | 'below', at: At = here, drawn = true): Promise<CanvasSettle> | null => {
 …
       if (delta === 0) return null;
-      o.move(m.id, delta);
-      return landed('move');
+      if (!drawn) {
+        o.move(m.id, delta);
+        return landed('move');
+      }
+      const done = heldRedrawWatch(); // AT the press
+      o.move(m.id, delta, true);
+      return landed('move', done);
```
and `stepMove` passes `drawn` = "the slide happened": compute the slide FIRST, then `dropOn(o, t, dir < 0 ? 'above' :
'below', here, slide !== null)` (today it slides after `dropOn`; reorder those two lines).
**(e) `heldRedrawWatch`** beside `heldSaveWatch` in `scene-drag.tsx`: `heldSaveWatch`'s body, but after
`sceneHeldSaveDone(…)` it keeps waiting until a `message` `{ source: 'setnayan-site', t: 'redrawn' }` arrives from the
SHOWN frame (`event.source === document.querySelector(SHOWN_FRAME)?.contentWindow`), then `end('shown')`; error → 'failed';
timeout as today.
**(f) `scene-canvas-drag.ts`** — the slides must END when that redraw paints (React has laid the sections out in the new
order; a slide still on them would move them twice): on `redrawn`, every slid element's transform/translate goes back
to what it wore, WITHOUT a glide (the `placeNow` revert path with `calm()`-style `transition: none`), and `slid = false`.
⚠ These hunks are written from the code, NOT compiled or walked here (drag is not this branch's) — that branch's tsc
and lab walk decide; the shapes (`canvasOrderOf` · `optimisticStageList` · `holdChange` · `HUB_DRAFT_BAR_FIELD`) are
the ones `editor-shell.tsx` already imports on main.
**Count it**: per press 1 POST + 1 in-place guest-page RSC render (was 1 POST + 1 Maker render + 1 guest document).
**Walk it** (lab, phone): drop, then a SECOND drop at once — the second must land where the finger says (the engine reads
DOM order, which is now the server's again after the redraw); a refused save slides back AND reloads.

## LAB RESULTS (2026-10-12, `/dev/maker-lab?studio=1`, phone 375×812, touch; request log at a proxy in front of `next dev`)
Guest-page requests that reached the server, per action (canvas pages · Style-card pages · Maker renders):
| action | BEFORE (origin/main files) | AFTER (this branch, final) |
|---|---|---|
| open the Maker (Invitation; the Maker auto-picks the Title, toolbar on Edit) | 1 canvas + 1 warm (**Save the Date** — the old tie-break warmed the EARLIER stage) + **5 style cards** nobody can see | 1 canvas + 1 warm (**The Day**, the next one) |
| pick the Countdown (Edit) | **+5 style cards** | 0 |
| open Style | 0 (already loaded behind Edit) | 3 (the picked card + its neighbours in sight, of 11 mounted) |
| Later | 1 Maker render (rsc) + 1 canvas reload | not walked after (the driver's pick stayed on the Title, which has no move; press code is unchanged — cause 4) |
| switch to The Day | 1 canvas + 5 style cards | **0** (the warmed frame is shown) |
| **total for the walk** | **19 guest-page renders + 1 Maker render** | **5** (presses aside) |
The worker is a pass-through on localhost (`DEV_HOST`), so cause 1 and the guest cut are counted by the worker probe.
Frame events (diag.mjs) prove the warm-drop and its fix; pictures: `~/Documents/Claude/Projects/controller-2026-10-12/asks-once/shots/`
(`before-*` = main, `after2-*` = final), JSON `…/asks-once/{before,after2}.json`.
SEEN, NOT CHANGED: the lab's open has a hydration mismatch warning (both before and after); the open auto-picks the
Title (so Style's first cards are the Title's).

## LAB (how)
Scripts (session scratchpad `…/scratchpad/lab/`): `proxy.mjs` (a logging proxy: method, address, `sec-fetch-dest`,
`sec-fetch-mode`, referer, rsc header, server action), `walk.mjs` (phone 375×812, touch: open → another stage → pick a part
→ Style → Earlier → Later; per action the guest-page requests by kind), `run2.sh` (one lock hold: `next dev` :3516 behind
the proxy :3517; walk AFTER; the three Maker files swapped to origin/main and ALWAYS restored; walk BEFORE; dev stopped,
`.next` removed; whole `pnpm preflight`; release). Pictures: `~/Documents/Claude/Projects/controller-2026-10-12/asks-once/shots/`,
JSON: `…/asks-once/{after,before}.json`. On localhost the worker is a pass-through (`DEV_HOST`), so causes 1 and the guest
cut are counted by the worker probe (`scratchpad/probe/`), not here.

## CHECKS (kept true)
- warm tests: `npx tsx --test lib/the-other-stages-are-warmed-once.test.ts lib/switching-stage-or-page-never-navigates.test.ts`
  + `'app/dashboard/*/website/editor/_components/buffered-canvas-frame.test.ts'` (QUOTED glob — unquoted it ran 0) → 26 + 6.
- style tests: `lib/a-style-card-asks-only-in-sight.test.ts lib/every-look-draws-a-picture.test.ts
  lib/the-panel-follow-ups-are-real.test.ts lib/every-style-card-is-phone-shaped.test.ts` → 35/35.
- worker tests: `app/sw-the-maker-asks-once.test.ts app/sw-is-a-pass-through-on-a-dev-host.test.ts app/sw-keeps-code.test.ts
  app/sw-reserved-routes.test.ts lib/guest-pass-hop.test.ts` → 68/68.
- preflight quick half at 3a39f8941: 43 guards · eslint (6) · tsc (13 files) · 83 test files / 767 tests — all PASS.

## NEXT STEPS
1. DONE: draft PR #6477 (CI 28/28 green at f21d8ddce; Maker first load 504.4 KB / 507.0 KB budget; shared 201.5 / 202 KB).
   The two lab fixes (25e18e3ca, b510cdeae) are pushed after a second whole preflight.
2. Controller → `rd/speed-guest-page`: the `sw.js` guest cut is on this branch (3a39f8941).
3. Controller → `rd/c-drag-scenes`: THE HELD MOVE above.
4. After deploy: the logging preview + a real phone (Safari's frameType, how soon iOS takes the new `sw.js`).
