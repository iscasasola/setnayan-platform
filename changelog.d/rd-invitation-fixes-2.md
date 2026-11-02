## 2026-09-27 · fix(event-hub): the names and date are readable on the first frame; the page background follows one rule

**The first screen is never hidden.** On `/cale-ice` at 390×844 (headless Chromium, mobile + touch,
signed out) the hero card — "Together with their families", the mark, the names, the date — sat at
opacity 0 when it arrived and reached full opacity only ~0.7–0.8 s after DOMContentLoaded (≈2.5 s
after the link was opened), because (1) the scroll reveal hid *every* chapter, the masthead
included, until its observer attached, and (2) the one-time arrival started the names and date
from `opacity: 0` behind 0.18 s / 0.34 s delays. Now the masthead's root, the anonymous masthead's
wrapper and the arrival action carry `data-pahina-first-screen`, the reveal rule exempts them, and
the arrival settles with a small rise and no opacity change (`sn-arrive-settle`). Motion is kept;
reduced motion is unchanged (neither class is ever added for it). Measured through one harness with
this diff applied to the live bytes: 0 samples where the words were on the page but not fully
visible (before: 5–6 samples, ~620–800 ms), at 375 and 390.

**One page-ground rule** (owner 2026-09-26, DECISION_LOG "YES TO ALL" (a): the colour is always the
base; the hero photo/video sits on top only on Pro themes). New `lib/page-ground.ts`
(`pageGround`, `heroMayBePageGround`) is asked by all three surfaces that paint the ground — the
layout's paper/loop (`guest-look-scope.tsx`), the Main background (`site-body.tsx`, now gated on
the theme's `tier === 'pro'` instead of `!== 'house'`) and the shell's opaque paper
(`invitation-shell.tsx`). Behaviour for today's ten themes is unchanged; a future free theme is now
refused the hero by default.

Tests: `app/[slug]/_components/the-first-screen-is-never-hidden.test.ts`, `lib/page-ground.test.ts`
(both sabotage-checked); two existing guards re-pointed at the new spelling.

SPEC IMPACT: None — implements the already-recorded 2026-09-26 "YES TO ALL" (a) ruling and the
read-moves rule; no decision changes.
