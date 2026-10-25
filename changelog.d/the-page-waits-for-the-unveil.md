## 2026-10-17 · fix(veil): the page stays still until the unveil

Owner, verbatim, with the veil closed on live `/cale-ice`: *"website will not scroll until reveal starts/opens/ etc. i
notice i can already scroll"*. Measured: nothing ever locked the document behind a closed opening — the only barrier was
the veil's own hit-zone (`touch-action: none`), which stops a touch pan that starts on the armed veil; a wheel, a
trackpad and the keys scrolled the page (and scrolling past the first screen retired the unopened veil). The hold
(`lib/hub-veil.ts`) now also locks the document (`overflow: hidden` on html/body, no overscroll, gutter kept) and
cancels touch pans outside the opening's own box, and lets go with the hold — the moment the unveil starts — for the
rest of the visit. Guarded by `apps/web/app/[slug]/_components/reveal/the-page-waits-for-the-unveil.test.ts`.

SPEC IMPACT: None — enforces the 2026-10-15 ruling "NOTHING BEHIND IT PLAYS UNTIL IT IS OPENED" for the page's scroll.
