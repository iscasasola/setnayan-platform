## 2026-10-28 · feat(badges): a shop's badges wear the approved pill — tracker, print file, "you earned" line; events ladder 10 → 10,000

Owner 2026-10-28: *"verified pill is good"* · *"we also have badges created based on their performance … we want to build
it now so it improves everytime"* · *"so we want to show the badge tracker also?"* · *"badges improve as their ladder
goes up."* · the ladder *"like youtube … 10,50,100,500,1000,5000,10000?"*.

- **One badge module** `lib/shop-badges.ts` (pure): Verified (`hasVerifiedBadge`) · the events milestone
  (`milestonesFor` over the shop's public completed-events count) · ★ rating (trusted aggregate only, never a 0.0) ·
  years in business (`yearsInBusiness`) · this month's Spotlight Awards (`AWARD_LABELS`). Nothing is stored — a voided
  booking un-earns its medal on the next read. Reads in `lib/shop-badges.server.ts`.
- **The ladder changed** — `MILESTONE_THRESHOLDS` is now 10 · 50 · 100 · 500 · 1,000 · 5,000 · 10,000 (was
  10 · 25 · 50 · 100). ⚠ A shop at 25–49 completed events no longer holds a "25" medal.
- **Each step wears its own material** (`lib/badge-tiers.ts`) — the same pill, the paint climbs; the top step adds a
  laurel. The owner-approved names (10 Bronze · 50 Silver · 100 Gold · 500 Platinum · 1,000 Diamond · 5,000 Ruby ·
  10,000 Black Diamond) sit on the badge under the number; the keys stay positional (`tier1`…`tier7`). Every lettering stop, line and number is
  held to WCAG AA on a light and a dark ground (`lib/badge-tiers.test.ts`).
- **The pill** `app/_components/shop-badge-pill.tsx` (+ module css): mark / number / ★ in a circle, two tracked Jost
  lines, gold-foil edge; light · white · dark · colour · auto grounds; xs → lg.
- **Shop page** (`/v/[slug]`): the "✓ Verified" chip and the ★ chip become pills (same gates, same titles); the
  milestone and awards pills join them. The QR on a card lands here, so a scan shows today's badges.
- **Shop › Page › Awards and badges** is now a tracker (`website/_components/badge-tracker.tsx`): today's pills,
  "Next to earn: 100 events · Gold · 4 to go", Save to print, and one row per badge — state (Earned · N to go · Live ·
  Not yet · Couldn't load), a bar only where a ladder exists, the pill now → the next step's pill, and the action that
  moves it (See the couples asking → Customers "Waiting on you"; Ask for reviews → Customers "Done"). The rating has
  no bar and no goal.
- **Print**: `badgesForPrint(shop)` + `/api/vendor/badges` — an outlined SVG (type as paths, Jost) of the badges READ AT
  PRINT TIME, saved through the shipped `SaveFileLink`. Calling-card / banner renderers that would place it are not
  built yet.
- **Today**: one line when a badge is newly earned ("You earned 50 events · Silver ✓ — your tarp and card can show it") with
  Save to print and Got it (`_components/badge-earned-line.tsx`, one mount line). "Newly" = compared with what the
  supplier last dismissed, kept in the browser — no schema, no new server action. Only "earned" is said. No email.
- Labs: `/dev/supplier-lab?s=page&who=caterer|studio|parish` (open "Awards and badges") and `?s=badge-today&who=studio`.

SPEC IMPACT: builds the corpus `DECISION_LOG.md` rows of 2026-10-28 "THE VERIFIED PILL IS APPROVED — AND THE PERFORMANCE
BADGES WEAR IT" and "THE EVENTS MILESTONE LADDER IS 10 · 50 · 100 · 500 · 1,000 · 5,000 · 10,000" (both already in the
corpus); no new corpus row.
