## 2026-11-25 · fix(admin): final check area 8, batch 2: a failed read is said, never drawn as none

Final check, area 8 fixer, batch 2 (lane A only; no amounts, plans or rules change). On each admin page below a
refused read used to render as "no match", "none", 0 or an empty editor. It now says it couldn't read:

- **A8·F-23, A8·A-24**: gifts supplier and user search (`ReadFailed` in place of "No suppliers match").
- **A8·A-21**: subscriptions say "Couldn't read the supplier", not "Unknown supplier".
- **A8·F-19**: repost watch, the QR flags list and the shop allowances.
- **A8·E-11**: verification docs draw no "Nothing here." shelves under a storage failure.
- **A8·I-7**: supplier recommendations: counts read "—", the map and the flags say they failed.
- **A8·I-8**: supplier partnerships: the open-proposals heading says "not measured".
- **A8·G-12**: background videos: a refused read throws in `lib/background-videos.ts`; the admin page says
  "Couldn't read" (the homepage still degrades quietly).
- **A8·G-9**: spotlight awards: new `readSpotlightAwards` returns `null` on failure; counts read "—".
- **A8·F-24**: integrity watch: the four tab counts are one batched read; a refused count shows "—".

Guard: `app/admin/a-failed-read-is-not-none.test.ts`, mutation-checked.

SPEC IMPACT: None. Honest-state fixes on already-drawn admin pages.
