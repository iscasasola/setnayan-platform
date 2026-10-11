## 2026-10-11 · perf(home): the home page remembers its public row reads · the share picture has a time limit · the in-render gate asks its last three questions together

Built, not live. Three pieces, one commit each. Measured cause (investigator,
2026-10-11, production): `/` made 27 database calls per view in ~15 steps one
after another, and one caller asked for `/` every 60 seconds.

### A · the home page remembers its same-for-everyone ROW reads (60 s)

- New `lib/home-public-reads-core.ts` (+ the app's instance,
  `lib/home-public-reads.ts`): six reads made with the service client, taking a
  date, a list of public event ids or a limit — never a viewer — remembered for
  60 s (`unstable_cache`, the repo's existing shape) and never shown past 300 s:
  the world shelf's candidate events · the listed events' hosts · the rows a
  Discover card's cover is drawn from · the public profiles · the live shops
  and their count · the featured storyteller chapters. 9 of the 27 calls measured
  in production today (10 once a chapter is featured).
- ROWS, not answers and not addresses. Every decision still runs per view over
  those rows — the public gate, the layers, whether a host's name may be shown,
  each card's cover and the ownership read behind a paid look, the Verified
  badge's deadline — and every picture is still signed per view.
- A refused read is never remembered (`ReadRefused`); the caller logs it under
  the name it always had and says "couldn't load".
- `lib/remembered-read-core.ts`: Next's cache hands back a stale entry and
  refreshes behind the response, so a quiet night would show last night's
  shelf once. Every value carries the time it was read and is never shown past
  the hard age.
- `lib/home-shelf-clear.ts`: the writes that take something DOWN from the page
  clear it at once — an event made private/unlisted, archived, deleted or
  re-addressed; a public profile switched off, re-addressed or erased; a shop
  hidden, banned, demoted or sent back to review; a chapter unfeatured, edited
  or deleted. 25 call sites in 16 files.
- NOT remembered, and still asked on every view: the viewer's follows,
  unfollows, memberships, connections, region and their people's events; the
  event-type gate and labels (read through the session client); the consented
  editorials (`loadPublishedShowcases`); and the ownership chain behind each
  Discover card's cover (`dressEventCover`), which reads the view-as-free
  cookie and the session client on its way. Expected `/`, signed out, warm:
  27 → about 18 calls. **Unmeasured until a preview.** The ≤ 8 target is not
  met; what blocks it is in files this change was told not to touch.

Guards: `lib/home-reads-remember-nobody.test.ts` (the import graph of the
remembered modules reaches no session, at any depth) ·
`lib/home-shelf-writes-clear.test.ts` + `lib/home-shelf-writes.baseline.txt`
(every write to a remembered column is cleared or counted, enumerated by
table) · `lib/home-public-reads.test.ts` (cold 10 queries, warm 0, refusals
never stored, no signed address stored) · `lib/remembered-read-core.test.ts`.
Re-anchored, same properties: `lib/discover-events.test.ts`,
`lib/the-discover-card-wears-the-cover.test.ts`,
`app/_components/frontdoor/search-answers-here.test.ts` — the reads they pin
now live in two files.

### B · the share picture has a time limit

- `lib/social/card-photo-fetch.ts`: the photo fetch behind every `/api/og/**`
  card (Real Story, recap, profile, chapter, shop logo) gives up after 4 s —
  headers and body — and the card draws what it already drew with no photo.
- `export const maxDuration = 30` on all seven `app/api/og/**` routes (the
  limit was the platform's 300 s). What a card shows, and to whom, is unchanged.

### C · `eventSkuActive`, in a render, asks its last three questions together

- `skuActiveInRender` (`lib/entitlements.ts`): once nothing bought grants the
  product, the promo window, the comp grant and the internal host are asked
  together and still answered promo → comp → internal, so the first "yes"
  decides as before and a refused read is thrown at the same step. Two round
  trips shorter for an event that owns nothing or is hosted internally, with
  the same requests as before. A comped event sends one more request per
  render; an event inside a live promo window sends two more.
- Outside a render (actions, route handlers, jobs) nothing changed.
- Answers pinned by the untouched `lib/entitlements-ask-once.test.ts` matrix
  (27 scenarios × 3 viewers × 10 products, in-render vs the per-product
  queries); order, togetherness and counts by
  `lib/entitlements-in-render-asks-together.test.ts`.

SPEC IMPACT: None. No schema, no env switch, no copy, no price. The home page's
freshness bound (hard age 300 s) is the number it already carried as
`revalidate = 300`; no `DECISION_LOG.md` row rules on it either way.
