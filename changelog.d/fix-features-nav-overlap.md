## 2026-08-06 · fix(marketing): the glass nav no longer sits on top of the features page's own tabs

**Found by the owner, on a phone.** Not by typecheck, not by 6,678 tests, not by
15 lint scripts — all of which were green.

### What a visitor saw

On `/features` and `/tl/features`, the floating glass nav (Prices · Download ·
Vendors · Sign in) rendered directly **on top of** the page's own section tab
strip. "Vendors & budget" and "Outsourcing & pacing" were unreadable behind the
nav pills, and the page's `<h1>` was sliced in half. On the public marketing page
whose entire job is to make the product look finished.

### Cause

`site-chrome.tsx` already had the mechanism: `UNFIXED_ROUTES` makes the glass nav
render **in-flow** (scrolling away with the page) on routes that own the viewport
top, so — in its own words — *"two pinned bars never stack."*

The set was correct. It was just incomplete: it held only `/explore`.
`<FeaturesPageBody>` renders `<AnchorNav>` at `sticky top-0 z-30`, and both
locales render that body.

🔑 **Both components were individually correct.** `AnchorNav`'s own comment reads
*"Top margin allows for the sticky header + this anchor nav (~120px combined)"* —
the author **knew** a pinned header sat above, and still pinned to `top-0`. Two
files each right about themselves and wrong about each other. The defect existed
only in the relationship between them, and only at render, which is why every
automated check passed and a human eye caught it in seconds.

### Fix

`/features` and `/tl/features` added to `UNFIXED_ROUTES`. No layout, spacing or
component change — the nav simply stops being pinned on those two routes, exactly
as it already behaves on `/explore`.

### The guard

`scripts/lint-no-stacked-pinned-bars.mjs` fails the build when a `NAV_ROUTE`
pins anything to the viewport top without being listed in `UNFIXED_ROUTES`. Both
sets are **parsed out of `site-chrome.tsx` itself**, so the guard cannot drift
from the thing it guards. Wired into the REQUIRED `typecheck + lint` job.

⚠ **Two bugs in the guard, both caught before it shipped — the second is the
embarrassing one:**

1. A directory-only scan **cleared `/tl/features`**, because that route holds a
   40-line page importing `<FeaturesPageBody>` from the *English* directory. The
   pinned bar lives elsewhere. Surfaced by sabotage-testing: only `/features`
   came back. So the guard now also follows a route's imported body.
2. **That fix made it follow every `@/app/...` import**, landing in
   `app/_components/` — where `demo-mode-banner-client`, `sidebar-shell`,
   `relationship-tab-shell` and `site-chrome` itself all legitimately pin. It
   reported **13 routes, every one false.** That is the cry-wolf failure for the
   third time in one day, and a guard that cries wolf teaches its reader to skim
   past the one time it is right. Narrowed to real route segments — Next.js
   treats an underscore-prefixed folder as private, never a route, which is
   exactly the right line.

**Sabotage-verified after narrowing:** removing the two routes from
`UNFIXED_ROUTES` names exactly `/features` and `/tl/features` — and nothing else.

### Verification

`tsc --noEmit` exit 0 · **all 15 lint scripts pass** (14 + this one).

### 🔑 The lesson, again

Three defects today were found by a person looking at a screen, and none of them
by CI. This one is the sharpest case: it is not expressible as a wrong value
anywhere. Two correct components, one wrong result, visible instantly to an eye
and invisible to every check we own. **Ask the owner to look.**

SPEC IMPACT: None.
