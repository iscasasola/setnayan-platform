## 2026-11-18 · feat(discover): Build 3 of 3 — Discover's Articles part, and articles found by Google and AI answers

Build 3 of the owner-approved Find · Build · Book drawing (specs
`prototypes/find_build_onboarding_2026-11-17_fable.html`, "New code — Build 3"; DECISION_LOG rows of 2026-11-17).
Stacked on #7919 (Build 2, the articles). Rulings of 18 Nov on this PR: "hidden" is Build 2's `removed_at` (no new
column); Discover's Articles "See all" opens Build 2's feed. No migration, no new server action.

- Discover › Articles: the "coming soon" placeholder is filled with the newest public articles, shown the moment they
  post (Q6), each a door to `/articles/{slug}`; "See all" opens `/articles`. One line when empty or when the read fails.
- `/sitemap-articles.xml`: every public article, honest per-row lastmod; listed in `/sitemap.xml`.
- `/llms.txt`: an `## Articles` section naming whose words each post is (Setnayan Journal, a supplier, or a member).
- The article page (`/articles/{slug}`) carries DiscussionForumPosting JSON-LD with its replies as Comments (Journal
  posts: Article). It was already indexable and canonical in Build 2.
- A post an admin hides in /admin/user-reports is taken down (`removed_at`, Build 2): it 404s and leaves the sitemap,
  llms.txt and Discover together; the Hide also refreshes the sitemap and llms.txt at once.
- No read of its own: `lib/articles-index.server.ts` shapes Build 2's `listArticles` / `listPublicArticleAddresses`.
  The pure rules are `lib/articles-index.ts`. Guard: `lib/articles-are-findable.test.ts` (8 tests; 8 sabotages each
  turned it red). Caught up with main on 20 Nov: main now keeps the four "public now" clauses in ONE definition,
  `onlyPublicArticles` (`lib/public-articles.ts`), so guard 2 checks that every read goes through it and that it
  still filters removed posts and drafts (sabotage: dropping the clause, or bypassing the helper, each turns it red).

SPEC IMPACT: None (the 2026-11-17 DECISION_LOG rows and the drawing already describe it; the 18 Nov rulings are on #7935).
