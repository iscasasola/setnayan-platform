## 2026-11-23 · fix(schedule): the doorway's gold thread no longer crashes the page

The crash log (`app_telemetry_logs`, PAGE_CRASH) showed `n.getTotalLength is not a function` on `/schedule` (23 Nov), with the same stack earlier on `/seat-plan`, `/monogram`, `/mood-board` and `/pakanta`. Every one of those pages draws the decorative gold thread in "How it works" (`HowItWorksPanel` → `usePanelIntro`). On a client whose `<path>` has no SVG geometry methods, the unguarded `path.getTotalLength()` threw inside the useGSAP scope and the whole page fell to the root error screen.

- **New `lib/svg-stroke-length.ts` (`strokeLengthOrZero`):** returns the stroke length only when `getTotalLength` exists and gives a real positive number. Otherwise it returns 0. No try/catch.
- **`app/_components/marketing/_premium.tsx`:** `usePanelIntro` (the thread) and `useProvision` (the rule) measure through it. A 0 length means no dash and no draw-in, so the line rests fully drawn and the rest of the entrance still plays.
- Checked in real Chromium: the thread measures as before. With the method stripped, the raw call throws the live error and the helper returns 0.
- Guard: `app/_components/marketing/a-thread-without-geometry-does-not-crash.test.ts`. 2 sabotages, each red.
- The other `getTotalLength` callers (`studio-reveal-player.tsx`, `layered-logo-player.tsx`) were already guarded. Not touched.

SPEC IMPACT: None. A crash fix; the motion stays as drawn, and it rests drawn where it can't be measured.
