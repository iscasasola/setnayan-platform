## 2026-10-25 · feat(help, features): one search for help answers, feature pages and guides — in place on both pages

Owner, 25 Oct, right after Discover search was narrowed to suppliers · people · events: *"also the HELP and Features
where we can mazimize the app to be searchable"*.

- `/help` and `/features` (English hub) mount the same search (`app/_components/how-search/`): signed in, Discover's
  thumb row (Enter → this page's `?q=`, ✕ → back); signed out, the page's own GET field. Results draw under the page
  head, marked `data-search-results` for the shared search pin.
- Results (`lib/how-search-core.ts`, pure; `lib/how-search.ts`, IO): help answers (role tile + store-shell words, as
  /help lists them; open in place via `<details>`), the Features hub's own entries, and guides + stories from
  `searchReads` (its help hits dropped — no answer twice). Scored by `scoreDocument`, ordered by `rankReads` (now
  generic) — no new ranker.
- `/help`'s client help-only box (`help-search.tsx`) is gone; the topic list is server-rendered rows (no cards).
- Honest states: no match → "Nothing matched “…”" + Ask us. A refused story read now reaches the page
  (`searchReadsWithStatus`, `loadPublishedShowcasesResult`) and says "Stories didn't load" instead of "nothing".
- Google: `/help?q=` and `/features?q=` are `noindex, follow`. Every sitemap route used the misspelled namespace
  `…/schemas/sitemap-0.9` (7 of 8, since the first sitemap); now `…/schemas/sitemap/0.9`.
- Guard: `lib/help-and-features-share-one-search.test.ts` (seen red: results unmounted from /features; feature kind
  dropped). Registered in the thumb-row and search-pin guards; port baseline regenerated (HelpSearch → HowSearch*).

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "HELP AND FEATURES SHARE ONE SEARCH" (pushed to the corpus, 9cfadd3c).
