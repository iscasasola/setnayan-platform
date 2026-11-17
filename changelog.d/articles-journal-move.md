## 2026-11-17 · feat(articles): Build 2 of 3 — Discover's articles on the chapter store + the Journal moves in

Build 2 of the owner-approved Find · Build · Book drawing v15 (specs
`prototypes/find_build_onboarding_2026-11-17_fable.html`, tabs Articles · An article ·
Write a post · Journal moved in; DECISION_LOG rows of 2026-11-17; controller relay on
PR #7919: "yes, all picks"). Replaces draft PR #7835 (a second article store, closed by
the controller).

- **One store.** `creator_chapters` gains `slug` (the readable `/articles/{slug}`,
  minted from the title, never changed by the writer), `tags` (≤ 3), `is_journal`,
  `posted_as_vendor_id` (a shop-linked account always posts as its shop) and
  `removed_at` (Report takes one down) — all held by an invoker trigger, so the
  browser cannot set them. `users.posting_name` (chosen on the first post).
  `creator_chapter_replies` — one level deep, RLS at create, grants from the
  policies. Report target `chapter_reply`. `articles` reserved for shop addresses.
  Migration `20271350349649`.
- **The Journal moves in.** 91 posts become rows as "Setnayan Journal", generated
  from the corrected source (`lib/journal-import-sql.ts`, held equal by a test);
  3 staged posts stay drafts; no cover photos; spotlight slugs re-pointed.
  Migration `20271350850404`. Copy fixed per the audit: Event Hub (not "wedding
  website"), supplier slugs, Event Pro named honestly, zero-commission narrowed,
  and every unsourced price figure removed ("ask 3 suppliers for a quote").
- **Screens.** `/articles` (Tag ▾ · Sort ▾ · Write a post), `/articles/{slug}`
  (inline setnayan.com cards from our own rows; outside links are links only,
  `nofollow ugc`; replies; Report on the post and each reply), `/articles/write`
  (Post as · Title · Tags · Your post · Your links · the Google line). Replies are
  RLS-guarded inserts; posts go through the shipped `createChapter` — **no new
  server action, no new API route.**
- **Forwards.** `/blog/{slug}` → `/articles/{slug}` (renames included; unknown →
  `/articles`); `/u/{slug}/c/{id}` → its article.
- **For Build 1/3.** `ONBOARDING_ARTICLE_TAGS` + `articlesForTag()`;
  `listPublicArticleAddresses()` (slug + updated_at, public and not removed).
- New posts carry no video link and no teaser; older chapters keep theirs.

SPEC IMPACT: None (DECISION_LOG 2026-11-17 rows already describe it). One reading
recorded in the PR: "outside link will only be a link" is built as a link with no
card, not as dead text.
