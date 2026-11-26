## 2026-11-26 · perf(maker): the Event Hub Maker's first load drops 22 KB, so the bundle check stops failing at random

The `bundle size check` was failing at random on unrelated PRs. Main sat at 507.8 KB against the Maker's 508 KB ceiling (`scripts/check-maker-js-budget.mjs`), so builds flipped between pass and fail, even on a PR that changed only tests. Two pieces of the event layout's first load did no work on a signed-in event page. Both now leave it, and the ceiling is unchanged.

- **The sign-in panel loads when Sign in is pressed.** `FrontDoorShell` wraps every signed-in page and owns `useSignInPanel`, which imported the panel statically. That put the form, the common-password list and the door words on every event page, where a signed-in host can never open them. The panel is now its own chunk, behind `loadSignInHerePanel` (`React.lazy`, the `date-sheet-lazy.tsx` pattern). It still opens over the page on the front door.
- **The `buffer` polyfill is gone.** `lib/print-mark.ts` is the logo layers' matrix maths and runs in the browser through `lib/logo-layers.ts`. One `Buffer.from(…, 'base64')` in its raster helper shipped webpack's buffer polyfill (~7 KB gz). It decodes with `atob` now and returns the same bytes.

**Measured** with `next build` + the budget script on main f14a1c387: **507.8 → 485.4 KB** (22.6 KB of headroom). The shared client bundle is unchanged at 104.6 / 202.3 KB.

**Guard:** `lib/the-maker-first-load-stays-light.test.ts` (sabotage-checked: putting `Buffer` back turns it red). `seam-invariants.test.ts` test 4 used to forbid an `import()` in `sign-in-here.tsx`. That rule rested on a shared bundle with 0.2 KB of room, and the bundle now has ~97 KB, so the test now requires the lazy door. Its root-layout rules are unchanged.

SPEC IMPACT: None. The Maker budget (DECISION_LOG "THE MAKER MUST NEVER FEEL SLOW") is unchanged; this only restores headroom under it.
