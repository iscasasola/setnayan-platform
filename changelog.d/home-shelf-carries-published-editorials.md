## 2026-09-01 · feat(front-door): the home shelf carries published editorials

**THE DEFECT.** `app/_components/frontdoor/data.ts` has called
`loadPublishedShowcases(24)` since the front door shipped, and threw every row
away — reducing all 24 to `realWeddingCount`, a number its own type marks
*"Only ever feeds the SHAPE composer, never the screen."* So the home page
**loaded the published editorials and rendered none of them.** A real
celebration's story reached `/realstories` and nowhere else, while the front
page's "Stories" chip showed only storyteller CHAPTERS — a different object,
from a different table, behind a different gate.

**THE FIX IS A MAPPING, NOT A SECOND SOURCE.** No new query, no new gate, no new
table, and no new page. The RA 10173 consent gate (eligible kind + public slug +
T+30d grace + `users.public_summary_consent_at`) stays in `lib/showcase-db.ts`.
`selectShelf` and `splitShelfRows` are untouched — they are generic over
`hasVideo` / `fromYourPeople`, so a correctly-shaped editorial flows through the
existing machinery unchanged.

- **`lib/front-door-editorials.ts`** (new, PURE — no I/O) owns the card shape,
  the sample exclusion and the null byline, so those rules are held by real
  assertions instead of a regex over a `server-only` renderer. Same shape and
  same reason as `lib/business-alaga.ts`.
- **`lib/the-front-page-carries-real-stories.test.ts`** (new) — 14 tests, each
  mutation-proved.

**🔴 THE BYLINE THAT WOULD HAVE 404ed.** `FrontDoorStory.ownerSlug` is now
nullable and an editorial's is `null`. A showcase passes
`users.public_summary_consent_at`; the byline door needs `public_profile_enabled`
— a **different column**, `DEFAULT FALSE`, and the one that makes `/u/{slug}`
render at all. A couple can consent to their editorial being public while having
no public profile page, so a slug here would have put a 404 **on the front page,
for the first real couple who ever consented**. Measured in production
2026-09-01: 7 accounts, 1 with `public_profile_enabled`, **0 consenters** — the
trap had not bitten only because nobody had reached it yet.

**🪤 CAUGHT BEFORE IT SHIPPED.** The card's fallback was
`` `A ${kindLabel.toLowerCase()} story` `` — right for a chapter ("Wedding" →
"A wedding story"), wrong for an editorial whose label is already a noun:
"Real story" rendered **"A real story story"**. Now one `cardBlurb` helper, used
by both renderings, branching on `kind`. The invariant guard that anchored on the
old literal was **followed through the indirection, not loosened** — it now also
holds `cardBlurb` itself, so emptying the helper can no longer pass.

**⚠ SAMPLES ARE EXCLUDED, and this renders nothing today.** `/realstories` shows
the curated sample behind an honest "Sample" badge; the front page has no such
badge and would be presenting a staged celebration as somebody's real day. With
0 consented couples in production this returns `[]` and the shelf looks exactly
as it does now. That is the honest empty state — it fills itself, with no further
work, the day the first couple consents.

**Ordering:** editorials first, then chapters, each keeping its own internal
order (the two are never re-sorted against each other — their dates mean
different things). One line, owner-movable.

SPEC IMPACT: None. No pricing, no schema, no gate, no locked decision touched —
this renders data the page already loaded.
