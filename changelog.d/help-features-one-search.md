## 2026-10-25 · feat(help, features): one search for help answers, feature pages and guides — in place on both pages

Owner, 25 Oct, right after Discover search was narrowed to suppliers · people · events: *"also the HELP and Features
where we can mazimize the app to be searchable"*.

- `/help` and `/features` (English hub) mount the same search (`app/_components/how-search/`): ONE bottom bar — the
  shared ThumbRow Guests, Suppliers and Discover draw — signed in AND signed out (owner, on the first draft's in-page
  box: *"Should the search be consistent with the search bar we have?"* → yes). Enter → this page's `?q=`, ✕ → back;
  a `<noscript>` form is the only other copy. Results draw under the page head, marked `data-search-results`.
- The shell's top-bar box ("Suppliers, stories, guides") is not drawn on `/help` and `/features` — a per-path switch
  beside `bleedPaths` (`pageSearchPaths`, list in `shell-page-search.ts`), not a CSS hide. `/features/<slug>` keeps it.
- These pages have no account bar, so the row stands on the screen's foot with the safe-area room
  (`ThumbDock noBar` → `.dockNoBar`), not 64px up over nothing.
- One address, one row: two different help answers share the slug `what-is-papic`; the better-scoring one stays.
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
  dropped; the form moved out of `<noscript>`; `/help` dropped from the no-top-box paths; the de-dupe removed). Registered in the thumb-row and search-pin guards; port baseline regenerated (HelpSearch → HowSearch*).

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "HELP AND FEATURES SHARE ONE SEARCH" (pushed to the corpus, 9cfadd3c).

### Help content pass (owner: "the content needs to be as updated and efficient as possible")

- New answer **Can I get a refund?** (`/help/refunds`), worded only from `app/(shell)/refunds/page.tsx`: no refunds; an
  unusable paid service waits for your next event or becomes Papic credits worth what you paid; double charges go back;
  Apple purchases go to Apple (the app answer says only that); supplier refunds are the supplier's. The 7-day report
  window reads `REFUND_REPORT_WINDOW_DAYS`. "refund" now leads with it.
- The second `what-is-papic` (Papic topic) is now `how-papic-works` — the URL always opened the About answer, so it had
  no page of its own. The guard now holds every help slug unique.
- "One camera is free on every event" → "Cameras are free and unlimited; every photo uses credits" (2 answers).
- Shorter, truer: What is Setnayan · How much does Setnayan cost · What is Setnayan AI · What is Pakulay (now the Mood
  Board as shipped; dropped the unverified "finalizes once / locked vision") · How do I turn on Papic (numbered steps) ·
  Reference codes (dropped "ingest automatically / reconciles within one business day") · the supplier reply-only inbox
  (messages live in Customers / the envelope). "wedding" → "event" where it meant any event (Papic answers, venue
  signal, planner apps). Wedding-specific search questions keep their words.
