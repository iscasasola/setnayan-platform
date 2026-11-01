## 2026-11-01 · fix(maker): an iPhone keeps no hidden second guest page behind the canvas

Owner, in the iOS app: *"when i pick a scene and go to styles. it resets the whole page"* — intermittent ("loaded
fine" on a repeat), not reproduced on live Chromium. Read as iOS reloading a web view whose content process ran out of
memory.

- `warmCanvasBudget` read a phone that does not say its memory as big enough. iPhone and iPad WebKit (Safari and the
  app's web view) never expose `navigator.deviceMemory`, so every Maker open on an iPhone kept a whole second guest page
  (the next stage) loaded and hidden behind the canvas. Now only a phone that says it has more than 4 GB keeps stages
  warm; laptops are unchanged.
- Measured on /dev/maker-lab, Playwright WebKit at 390 (iPhone emulation): at open 2 canvas documents → 1, 166–184
  requests → 94, images 357 KB → 28 KB; on Style 5 iframes → 4 (the 3 look cards are on screen and unmount on leaving).
- Cost: a stage switch on an iPhone loads its page when asked, as it already did on small Android phones.
- Guard: `apps/web/lib/switching-stage-or-page-never-navigates.test.ts` (the warm budget; fails with the fix reverted).

SPEC IMPACT: None.
