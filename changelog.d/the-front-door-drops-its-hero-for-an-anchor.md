## 2026-09-03 · feat(home): the front door drops its hero and chip bar for a category anchor + New uploads/Trending/Shops

Phase B of the same redesign. Replaces the always-on narrative hero
(`front-door-opening.tsx`, `front-door-story.tsx` — both deleted) and the
chip-filtered "one shelf" (`All`/`Your people`/`Stories`/`Articles`) with:

- **`front-door-anchor.tsx`** (new) — a short category-anchor strip, **signed-out
  only** (owner-confirmed this session: a returning signed-in visitor already
  knows what Setnayan is). One `<h1>`, three claims, one CTA
  (`/onboarding/wedding?from=home`, unchanged), one secondary link — now
  `/our-story` (the actual mission/manifesto page) instead of `/alaala` (one
  pillar's explainer). Reasoning for dropping the always-on hero — researched
  directly this session (YouTube's feed is a personalization engine for
  returning users with watch history, not a cold-start tool; liquidity matters
  more than content at this stage) — is recorded in the file's own docblock,
  since it reverses a previously deliberate, reasoned decision.
- **`front-door-feed.tsx`** (rewritten) — three always-shown sections, never
  filtered: **Shops** (moved from the tail to directly under the anchor —
  supply liquidity over content, researched this session), **New uploads**
  (the old one-shelf composition, unchanged `splitShelfRows` math, just never
  chip-filtered now), **Trending** (new — chapters ranked by real view count,
  `selectTrendingChapters` in `front-door-composition.ts`). No new "earned"
  threshold was invented for Trending: every chapter reaching the shelf at all
  already passed the admin Feature gate, so view count only decides order, not
  admission — see that function's docblock for the number that WAS deliberately
  not guessed (a raw view-count floor, if one ever proves necessary) and why.
- **`data.ts` / `front-door-editorials.ts`** — added `viewCount: number | null`
  to `FrontDoorStory`, threading the loader's real chapter view count through
  (previously computed but silently dropped); always `null` for an editorial
  (a couple's own write-up never carries a public counter, by design).
- **`front-door-composition.ts`** — removed the retired chip machinery
  (`FRONT_DOOR_CHIPS`, `ChipKey`, `isChip`, `selectShelf`); added
  `selectTrendingChapters`. `composeFrontDoor` and `splitShelfRows` are
  untouched. "Your people" (a signed-in narrowing to stories from people you
  know) is retired with the chips — there is no filter left to attach it to;
  `fromYourPeople` stays on the type unused rather than also ripping out the
  separate, working `lib/your-people.ts` read.
- **`page.tsx` / `front-door.tsx`** — dropped the `?c=` chip param entirely;
  `?q=` search is untouched.
- Load-more pagination (discussed earlier this session, prototyped) was
  deliberately NOT built here — `articles` stays capped at 12 with a real
  `/blog` link ("See all N articles") once there are more, rather than new
  cursor/API infrastructure this pass didn't scope.

⚠ NOT YET RE-VERIFIED against a same-file upstream change: PR-landed commit
`7de69160f` ("feat(front-door): the home shelf carries published editorials")
substantially built out `data.ts` / `front-door-feed.tsx` / `front-door-editorials.ts`
/ `front-door-invariants.test.ts` on `main` after this Phase B diff was drafted
and before it shipped. The merge into this working tree was clean (no textual
conflict, full suite green at 189/189 when last checked), but that only proves
textual compatibility, not that this rewrite and that shipped feature agree on
one design — re-read `7de69160f` in full and reconcile before this phase is
committed.

Test changes: deleted `the-group-chat-went-quiet.test.ts` and
`the-front-door-says-something.test.ts` (tested content that no longer
exists) — their real invariants (exactly one visible `<h1>`, "Setnayan"
visible somewhere) survive independently via `home-brand-name.test.ts`'s
wordmark check, so nothing lost coverage. `front-door-composition.test.ts`
and `front-door-invariants.test.ts` both had their chip-era tests removed and
replaced with equivalents for the new structure (Trending's honest-empty
state, section order, no-duplicate-door checks) — every new assertion was run
against the real rewritten files, not written speculatively; one regex bug
(a trailing-comma mismatch) was caught and fixed this way, not left for the
first real failure to find.

Verified live in the dev server (not just via tests): the signed-out
homepage renders the full new structure correctly — anchor, "The first
shops" (1 live shop, correctly not "Trending shops" yet), New uploads with
the real-weddings invitation and real article cards, Trending's honest empty
state, zero chip bar, exactly one `<h1>`.

SPEC IMPACT: Yes — the homepage's visible structure changed materially
(narrative hero + chip filter → anchor + sectioned feed). Applied to the spec
corpus at `~/Documents/Claude/Projects/Setnayan/` — see `DECISION_LOG.md`
2026-09-03 and the correction banner atop `FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md`.
