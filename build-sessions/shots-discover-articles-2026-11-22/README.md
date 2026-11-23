# #7935 · Discover Build 3 of 3 — §4 proof (22 Nov 2026)

**1 · Screens (375 light + dark, desktop).** The shipped `ArticlesShelf` from `discover-six-parts.tsx` with
`front-door.css`, over the **real** four newest public posts. They were read on 22 Nov with a SELECT through
`onlyPublicArticles`'s four clauses (published, not removed, has a slug, not future-dated). The excerpts come from the
real `chapterExcerpt`.
- `articles-375-light.png` · `articles-375-dark.png` · `articles-1280-light.png` · `articles-1280-dark.png`
- `articles-375-light-empty.png`: no posts yet. `articles-375-dark-unavailable.png`: a refused read. These two say
  different things, never the same line.
- ⚠ Rendered on a temporary dev page (not committed). This container has no Supabase credentials, so the full
  Discover page cannot run here. The full-page shots on an earlier main are in `../shots-catchup-articles-find/` and
  `../shots-discover-articles/` (now beside proposed).
- `llms-txt-and-sitemap-proof.txt`: the `## Articles` section of /llms.txt and the sitemap rows, over the same four
  posts. The summaries are left out of this proof for length.

**2 · Drawing parity** (specs `prototypes/find_build_onboarding_2026-11-17_fable.html`, "Build 3"). Unchanged from the
earlier rounds: see `../shots-discover-articles/*-now-beside-proposed.png`. This round changes no pixels.

**3 · Ways in.** Discover › Articles row → `/articles/{slug}`. "See all" → `/articles`. Google: `/sitemap.xml` lists
`/sitemap-articles.xml`. AI answer engines: `/llms.txt` "## Articles". An admin Hide in /admin/user-reports takes a
post out of all of them (`removed_at`). Walked in code and guards (`lib/articles-are-findable.test.ts`), not in a
signed-in browser: there is no database here. No notification links to an article.

**4 · Guards.** See `preflight-2026-11-22.md` (full preflight from `apps/web`).

**5 · Overlapping open PRs.** #8041 is the base of this stack: merge it first. #8004 (`lib/llms-txt.ts`, /help
files). #7988 (`front-door.tsx` and three copy guards). Sixteen open PRs touch `lib/ugat/screens.generated.json`.

**6 · §2 rules not followed.** Shots are of the shelf, not the whole live page (no database in this container).
"Every way in walked" is by code and guards, not a browser.

**One source (controller, 22 Nov).** The llms.txt Articles words live in #8041's `lib/llms-txt.ts`.
`lib/articles-index.ts` holds no llms.txt prose, and guard 4 fails if it does again (sabotage-tested).
