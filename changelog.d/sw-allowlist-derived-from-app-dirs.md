## 2026-09-18 · fix(sw): guest-slug RESERVED set covers every app/ route, and a guard keeps it that way

`public/sw.js`'s `isDayOfGuestNavigation` told a real site page from a couple's
guest slug with a hand-maintained `RESERVED` set that was missing `creators`,
`open-shop` and `tour` — those three pages, opened offline-first, would have
been served the stale day-of guest cache instead of the real page.

Root cause was the hand-typed list itself, not the three missing entries: it
also carried several stale entries for routes that no longer exist
(`recommendations`, `pricing`, `for-vendors`, `about`, `how-it-works`,
`privacy`, `terms`). Regenerated the set from the current top-level directories
under `app/` (excluding `_private`, `(route-groups)` and `[dynamic]` segments),
and added `app/sw-reserved-routes.test.ts`, which fails if `sw.js` and `app/`
ever disagree again — in either direction. Mutation-tested: removing a
directory from `app/` and adding an unreserved directory both turn it red.

SPEC IMPACT: None.
