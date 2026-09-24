## 2026-09-25 · fix(layout): foldable and dual-screen phones get the right layout

Owner: *"make sure that our app is prepare for iphone duo and other foldable phones as well"*.
Audited production at Galaxy Z Fold (cover + inner, both orientations), Z Flip, Pixel Fold,
an estimated foldable iPhone (720×960 / 960×720) and a Surface Duo spanned across its hinge
(emulated with a real CDP display feature). Full audit:
`~/Documents/Claude/Projects/Setnayan/FOLDABLES_AUDIT_2026-09-25.md`. Three fixes:

- **Unfolding no longer freezes the page.** Opening the rail drawer below 1024 and then
  unfolding / rotating / spanning past it left the content column `inert` — measured on
  production: every link reported an inert ancestor, and there was no scrim to tap because the
  scrim is `display:none` at that width. `front-door-shell.tsx` now closes the drawer when
  `useIsDesktop('lg')` turns true. Guarded by
  `app/_components/frontdoor/unfolding-ends-the-drawer.test.ts` (agreement between the hook's
  breakpoint and the drawer's `max-width` in `front-door.css`; red under two sabotages).
- **The sheet fits foldables and hinges** (the FOLDABLES block at the end of
  `app/globals.css`, hooks `data-sheet` / `data-sheet-panel` on `sheet.tsx`): between 640 and the dock point the bottom
  sheet caps at 40rem and centres instead of spanning a 690–1023px screen; with two
  side-by-side viewport segments it takes the right-hand segment exactly; with two stacked
  segments (Flex/tabletop) it stays on the lower half. CSS only, so a fold mid-flow keeps the
  sheet's state. Guarded by two new tests in `sheet-agrees-with-the-nav.test.ts`.
- **A spanned dual-screen phone reads on one screen** (same globals.css block): at ≥1024 with two side-by-side segments the rail's column becomes
  the left screen, so content starts on the right one. Before, the front door's headline
  broke across the hinge and ten headings/cards straddled it; after, one (the top-bar search).

Both rule sets live in globals.css, never a `.css` import beside a component: the unit
runner loads `sheet.tsx` under node, and the first push's `import './sheet-fold.css'` was a
SyntaxError that killed every test reaching it. The sheet guard now fails if a stylesheet
import returns to `sheet.tsx`.

Not changed (owner/plan items, see the audit): iPhone stays portrait-only in `Info.plist`;
the app still switches phone→desktop chrome at 1024, so 600–1023 foldables get the phone
bottom bar, not a rail.

SPEC IMPACT: None — no decision changed. The audit file is new corpus material, not a spec edit.
