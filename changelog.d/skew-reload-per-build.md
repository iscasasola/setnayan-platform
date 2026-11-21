## 2026-11-22 · fix(stale-bundle): the automatic reload budget is one per BUILD, so two quick deploys never show a payer the crash card

Seen live on 21 Nov: batch K and the Maya fix deployed five minutes apart, and a payer's tab on /pay showed "Something on our end didn't work." Problems recorded one PAGE_CRASH, the "fifth shape" (React's `requireModule` meeting a component the tab's build doesn't have). The error boundaries' one automatic reload was spent on the first cutover, so the second cutover showed the card.

- `lib/stale-bundle.ts`: the reload marker now stores the build that reloaded (`NEXT_PUBLIC_BUILD_VERSION`, the commit SHA inlined per build). A tab whose marker names a different build is a new cutover and gets its own reload. A real bug in one build still reloads once, comes back as the same build, and shows the card, so there is no loop. With no build stamped, the old once-per-session rule applies, and an old `'1'` marker never blocks a stamped tab. `reloadBudgetSpent` is exported for the test.
- `app/global-error.tsx`, `app/error.tsx`: comments only.
- Test: `lib/two-quick-deploys-each-get-a-reload.test.ts` covers two quick deploys, a real bug in one build, and the unstamped and legacy markers.

0 server actions. SPEC IMPACT: None.
