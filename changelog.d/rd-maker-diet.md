## 2026-09-30 · perf(maker): the Colours and Pro-lock panels load when their row opens

The Event Hub Maker's first-load JavaScript sat at 504.6KB of its 505KB ceiling
(`apps/web/scripts/check-maker-js-budget.mjs`), which held back #6205 (+1.6KB) and
#6209 (+0.6KB). The website editor's `ColorsPanel` (the Main look's Colours row) and
`ProLockPanel` (a locked Pro row's panel) were imported by the editor's server page, so
Next shipped both — `pro-panels.tsx` and everything it pulls in — with every Maker open,
although each draws only when its row is opened (the Maker opens with no selection;
"Main" and a Pro row are taps). They now come through `details-lazy.tsx` stand-ins in
the existing `maker-details` chunk, like `MainBackgroundPanel` in the same Main group:
prefetched when the Maker is idle, a `SlotRows` placeholder in the rare case the row is
opened before it arrives. No behaviour change. The ceiling was not raised.

Measured on the same machine (`next build` + the budget scripts), base
`rd/train-2026-09-30-midnight`:

- Maker first load: **516,719 B → 511,808 B** gzipped (504.6KB → 499.8KB, −4.8KB).
- Shared bundle: 206,820 B → 206,822 B (ceiling 206,848 B).
- No server actions added.

Tried and dropped, both because they grew the every-page webpack runtime past the
shared-bundle ceiling: loading the tours (`MakerTour`, `GuidedTour`) on demand (+109 to
+184 B), and moving the Photo moments editor into `maker-details` (it is also eager on
its own route, so webpack split it into a chunk the runtime has to name).

Guarded by the existing `details-pieces-are-lazy.test.ts` (test 1 fails if a Maker
server file imports `pro-panels.tsx` again).

SPEC IMPACT: None.
