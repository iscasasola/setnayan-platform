## 2026-10-22 · fix(directions): every surface offers the map apps as ONE "Directions ▾" dropdown

Owner's standing rule, *"any set of choices is a dropdown"* — the follow-up #6751 named. #6751 made the venue
cards share one `DirectionsMenu` (a native `<details>`, summary and rows 44 px each), but three surfaces still drew
Google Maps · Waze · Apple Maps as three side-by-side chips through `NavLinksRow`:

- **The Day's directions card** (`app/[slug]/_components/day-directions.tsx`);
- **the Live hub's Directions panel** (`app/[slug]/hub/page.tsx`);
- **a supplier's public profile**, its location block (`app/v/[slug]/page.tsx`) — found by the grep.

All three now mount the same `DirectionsMenu`. It moved from `venue-styles.tsx` to `app/_components/nav-links.tsx`
(where `NavLinksRow` lived) and takes either a `venue` or a pin + search words; `NavLinksRow` is deleted, so there
is no second way to draw the map apps. Its look is unchanged; the "Open in" eyebrow beside the chips went with them
(the card's own "Getting there" heading and the "Directions" summary say it).

Guard (`app/[slug]/every-hub-press-is-44px.test.ts`): no file but the shared menu builds a Waze or Apple Maps link
(`wazeNavUrl` / `appleMapsUrl` or the hosts written out), the menu draws its rows from ONE `<a>` inside its
`<details>`, and every directions surface mounts it. Sabotage: three chips back in The Day → RED · three written-out
`<a>`s in the menu → RED · the hub back on `NavLinksRow` → RED · rows at `min-h-9` → RED · restored → GREEN.

`every-stage-is-todays-page.golden.json` re-recorded (only The Day's directions changed, per a stage-page dump on
both commits); `port-control-baseline.json` regenerated (`NavLinksRow` → `DirectionsMenu`).

SPEC IMPACT: None — applies the standing "any set of choices is a dropdown" rule and #6751's component; no new ruling.
