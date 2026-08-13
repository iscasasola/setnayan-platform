## 2026-08-13 · fix(front-door,journal): one shelf — the "With video" chip could not find a video, and an article sent its reader to a shop anonymously

Redesign **Session 5 · One shelf, two authors**. RULE 0 first, and it changed the shape of the work: **the merge itself already ships.** `app/_components/frontdoor/front-door-feed.tsx` (Session 4, PR #4394) already renders Articles and storytellers' pieces on ONE shelf with the kind on the CARD, already has exactly the four chips `All · Articles · Their stories · With video`, and `lib/front-door-composition.ts` already holds both thresholds — the `>= 2` grid/invitation swap carried over from `HomeReskin`, and `TRENDING_MIN_LIVE_SHOPS = 12`. **Nothing was redrawn.** What follows is the delta: three defects in that shipped shelf, the tracking fix the session carried, and the guards none of it had.

### 1 · The "With video" chip answered NO for any video that is not on YouTube

`app/_components/frontdoor/data.ts` built each card's video flag as `hasVideo: Boolean(s.thumbUrl)`.

`thumbUrl` is a **YouTube-derived poster** — `youtubeThumbFromEmbedUrl(row.embed_url)`. Only YouTube yields a derivable thumbnail, so a chapter hosted on Instagram or TikTok has a video and **no thumb**. Deriving "has video" from the picture therefore returns `false` for a piece that is *entirely video*: it fell out of the one chip that exists to find it, and lost the ▶ on its card.

The loader already computes the honest answer (`hasVideo: Boolean(row.embed_url)`) and `StorytellerTileItem` says so **in the type**:

> *"Whether the chapter carries a video at all. **NOT the same as `thumbUrl`**: only YouTube yields a derivable thumbnail, so an Instagram or TikTok chapter has a video and no thumb. Deciding the Watch/Read label from the thumbnail labelled those 'Read'."*

That comment records the same substitution being made **once before**. It was made again here, one file away from the warning. Now carries `s.hasVideo` through.

🔑 **Latent today, not theoretical**: prod holds 1 published chapter, 0 featured, 0 with video. It bites on the first non-YouTube chapter anyone features.

### 2 · Once stories exist, two articles render nowhere

The lead grid fills with **stories first** and tops up with articles, so how many articles it consumed is `4 − stories shown` — not a constant. The trailing row was hard-coded to `slice(4, 12)`, which is correct **only on a day with no stories**. With four stories the lead grid consumed zero articles and the trailing row still began at index 4, so the 2nd and 3rd pieces of our writing appeared **nowhere on the front page**: no error, no hole in the layout, just two articles that stop existing the day the first chapter is featured.

Now `splitShelfRows()` in the shared composer. On today's real numbers (0 stories) the output is **byte-identical** to the shipped `slice(4, 12)` — asserted.

### 3 · The chip rule lived where no test could reach it

Both rules were ternary chains inside an async server component's JSX. `front-door-composition.ts`'s own docblock already says why that is the wrong home — *"thresholds buried in JSX inside an async server component cannot be tested"* — and then the chip rule was written there anyway. `selectShelf()` and `splitShelfRows()` now live beside `composeFrontDoor`, and the chip vocabulary (`FRONT_DOOR_CHIPS`, `isChip`) with them, re-exported from the feed so callers are unchanged.

### 4 · A reader who left an article for a credited shop arrived as a stranger

`app/blog/[slug]/_components/journal-partner-credit.tsx` linked a bare `/v/{business_slug}` with **no source parameter**. The shop page reads `?src=` and stamps the enquiry's origin server-side, so with nothing on the link the enquiry was recorded as a plain walk-in. `'editorial'` **is** in `SOURCED_INQUIRY_SOURCES` (beside `'influencer'`); the walk-in default is not. So an article that genuinely produced a booking could never be counted as one Setnayan sourced — **the writing earned introductions it got no credit for**, and nothing in the app could notice.

`/realstories` already did this correctly through `VendorCreditChip`. The link now carries the same tag, and points at the **canonical bare-root address** rather than the legacy `/v/` form — the shop page self-canonicalises to the clean bare-root URL, so the query costs the credited vendor no link equity, which is the whole point of crediting them. Verified against prod: **no event slug collides with any shop slug**, so the bare root resolves to the shop.

The tag is typed `InquirySource`, because `?src=` is re-validated server-side against a fixed set and **an unrecognised value is inert by design** — dropped, never rejected. A typo would not throw; it would silently reproduce the exact bug. Typing it makes that a build failure.

⚠ **Honest scope:** `journal_vendor_spotlights` holds **0 rows in prod**, so no reader is losing attribution *today*. This closes it before the first credit is published, not after.

**The SQL mirror is unchanged and still matches** — verified by reading `public.booking_fee_is_sourced_surface` out of the live database: the same eight values as `SOURCED_INQUIRY_SOURCES`, `'editorial'` among them. No migration in this PR.

### The guards, all mutation-tested by occurrence count

Nothing above was covered. `front-door-invariants.test.ts` had ten tests and none touched the chips, the kind tags or the video flag; the credit link had no test at all.

- `lib/front-door-composition.test.ts` — the four chips at their edges, including a **non-YouTube chapter surviving "With video"**, a written chapter surviving "Their stories", and that no article is skipped at any story count from 0 to 6.
- `front-door-invariants.test.ts` #11–#14 — the **caller**. Proving `selectShelf` in isolation proves nothing about the page: each asserts the act (the feed calls it) *and* the consequence (the returned rows reach the screen, and no second copy of the rule sits beside the call).
- `app/blog/[slug]/_components/journal-partner-credit.test.ts` — the whole chain, because four independent things must agree for a click to count and **every one fails silently**: the link carries a tag · the shop page recognises that exact word · the word is billable · the bare root forwards the query. Breaking any one leaves the other three green.

11 sabotages, each with the anchor's occurrence count printed **before and after** so a mutation that did not land could not be mistaken for a guard that held. Details in the PR body.

### ⚠ These are defects on a LIVE public page, not behind a dark flag

Both the code default and the standing note said the front door was merged but switched off. **Measured against `https://www.setnayan.com/` instead of read: it is the live homepage.** The response carries `fd-chipbar`, `fd-storyrow` and 24 `fd-kindtag` marks, no `HomeReskin` markers at all, all four chips render, and `/?c=With%20video` returns the real *"Nothing under 'With video' yet — there are 33 pieces"* block. So `NEXT_PUBLIC_NEW_FRONT_DOOR` has been flipped since that note was written.

🔑 **A flag's default in code is not its value in production, and a note about a flag is a claim about the past.** Read the deployed page. The first draft of this entry asserted the opposite in its own last line.

SPEC IMPACT: None. No SKU, price, schema or migration. The one shelf, its four chips and both thresholds are the already-approved Session 4 port (`prototypes/front_door_and_seam_2026-08-12.html` rev 3) — this fixes defects in it and does not change the design.
