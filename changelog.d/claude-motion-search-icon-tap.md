## 2026-11-19 · test(thumb-row): Today, Find suppliers and Clients each rest as the 44 px search icon and open on one tap

Owner, 19 Nov, verbatim: "you asked if we can make it an icon and when we tap we can search instantly. so we can save space".
Measured, not changed: the shared ThumbRow seat already does this. Proved in WebKit + Chromium (iPhone 13): each of the three
is 44×44 at rest, and one touch tap puts focus in its search input. New test 7 in `lib/a-search-is-tap-and-type.test.ts` pins
that each screen's search sits in that one seat as a `type="search"` with a placeholder. Sabotage-checked three ways.

SPEC IMPACT: None
