## 2026-11-17 · feat(discover): Build 3 of 3 — Discover's Articles part, and articles found by Google and AI answers

Build 3 of the owner-approved Find · Build · Book drawing (specs
`prototypes/find_build_onboarding_2026-11-17_fable.html`, "New code — Build 3"; DECISION_LOG rows of 2026-11-17).
Stacked on #7840 (Discover in six parts). No migration, no new server action.

- Discover › Articles: the "coming soon" placeholder is filled with the newest public articles, shown the moment they
  post (Q6). One line when empty or when the read fails.
- `/sitemap-articles.xml`: every public article, honest per-row lastmod; listed in `/sitemap.xml`.
- `/llms.txt`: an `## Articles` section naming whose words each post is (Setnayan Journal vs a member).
- The article page (`/u/{slug}/c/{id}`) is indexable from the moment it posts (the blanket noindex is overturned by
  the 17 Nov ruling), canonical to its one address, and carries DiscussionForumPosting JSON-LD (Journal posts get
  Article once Build 2 imports them).
- A post an admin hides in /admin/user-reports turns noindex and leaves the sitemap, llms.txt and Discover. The Hide
  note now says so and is the one constant the hidden test reads (`CHAPTER_HIDE_NOTE`).
- One pure module (`lib/articles-index.ts`) and one read (`lib/articles-index.server.ts`) behind all of it;
  `articleHref` is the single address switch for Build 2's `/articles/{slug}`. Guard: `lib/articles-are-findable.test.ts`.

SPEC IMPACT: None (the 2026-11-17 DECISION_LOG rows and the drawing already describe it).
