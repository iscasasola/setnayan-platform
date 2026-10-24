## 2026-10-23 · fix(top bar): the account button stays in the top-right corner on every page

Owner, over the Events board: *"wrong position. that button should be at the upper right corner"*. `.fd-topbar` is a 3-column grid (wordmark · search · account); a page that passes `search={false}` renders no middle child, so auto-placement dropped the bell + avatar cluster into the search column — mid-bar — while its menu opened at the right edge. `.fd-topright` now names the last column (`grid-column: -2 / -1`) and `.fd-topleft` the first. Verified with the real stylesheet at 1280 px, before/after. Guard: `the-account-button-stays-top-right.test.ts` (sabotage-checked).

SPEC IMPACT: None.
