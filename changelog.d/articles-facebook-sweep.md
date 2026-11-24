## 2026-11-24 · feat(social): the Articles → Facebook sweep is back, pointed at /articles

The Setnayan Facebook page has had no new post since 18 Nov. The "Journal articles → posts" sweep (b2 in `lib/social/flush.ts`) was switched off on 16 Nov with the blog, because its teasers linked /blog. On 17 Nov the Journal moved into Articles (DECISION_LOG 2026-11-17 "THE JOURNAL MOVES INTO DISCOVER'S ARTICLES — ONE SOURCE"), so that reason no longer holds and the owner wants the posts back.

- **Where it lives:** `lib/social/articles-sweep.ts` (`sweepJournalArticles`), called by the flush between the supplier features and the milestones. The teaser captions are restored as `lib/social/journal-hooks.ts`, the same file the 16 Nov change removed.
- **What it reads:** the article store (`creator_chapters`) through `onlyPublicArticles`: published, has an address, not taken down, its date has arrived. Only Setnayan's own Journal posts are read (`is_journal`, no shop byline). A draft, removed, future-dated or member post is never teased.
- **What it posts:**
  - Title: "Articles · {title}".
  - Body: the curiosity hook, else the article's excerpt, then `#Setnayan #FilipinoWedding`, as before.
  - Link: `https://www.setnayan.com/articles/{slug}`, built with `articleHref` plus `journalArticleSlug`. A renamed post links its new slug. Nothing links /blog.
- **No reposts:** the row shape is unchanged (`source_type = 'announcement'`, `source_ref = 'journal:{slug}'`), so `social_posts_source_unique` still protects it. An article that already has a row under its current slug or any old slug (`JOURNAL_SLUG_RENAMES`) is skipped, whatever the row's status. That covers the 19 teasers posted before the pause.
- **Pace:** one teaser waits in the queue at a time. A new one is composed only when no Journal teaser is scheduled or publishing, and the governor gives it the next free slot. Newest article first.
- **Switches:** the existing `autopublish_enabled` and `facebook_enabled`. With either off, nothing is composed.
- **A failed read composes nothing.**
- **New guard:** `lib/social/articles-sweep.test.ts` (sabotages seen red: a /blog link, dropping the old-slug lookup, removing the switch check). `lane-s.fixture.ts` learns `.like`.
- **Server actions:** no new export. No migration. No new table or column.

SPEC IMPACT: None. It acts on DECISION_LOG 2026-11-17 "THE JOURNAL MOVES INTO DISCOVER'S ARTICLES — ONE SOURCE", which superseded the 2026-11-16 reason for the pause.
