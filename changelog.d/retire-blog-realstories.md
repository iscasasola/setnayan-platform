## 2026-11-16 · feat(public): retire the blog and Real Stories — the old addresses forward

Owner rulings, DECISION_LOG 2026-11-16 — `85ecdb7f` "THE BLOG AND REAL STORIES ARE RETIRED" (*"we retired these blogs
already"* · post-event stories are the new stories) and `8593a939` "RETIRED ADDRESSES FORWARD" (/blog → /features,
/realstories → Discover).

- **Forwards (308, no route spent):** `/blog` and every `/blog/…` → `/features`; `/realstories` and every
  `/realstories/…` → `/`; `/vendor-dashboard/real-stories` → `/vendor-dashboard`. All in `lib/legacy-redirects.ts`
  (`RETIRED_TREES`), the middleware map — not new next.config rules. A path whose last segment is a file
  (`public/realstories/*.jpg|*.mp4`, `public/blog/*.pdf`) is never forwarded: other screens still show that media,
  and the middleware matcher skips `.jpg` but not `.mp4`. next.config's `/weddings` and `/storytellers` rules now go
  straight to `/` (one hop, never via the retired hub).
- **Pages deleted:** `app/(shell)/blog`, `app/blog/[slug]`, `app/(shell)/realstories`, `app/realstories/[slug]`,
  `app/vendor-dashboard/real-stories`, `app/sitemap-blog.xml`, `app/api/og/realstory/[slug]` (its only user was the
  story page), plus the code only they used (`story-card`, `journal-partner-credit`, the stories gallery and search,
  the unreachable "sample editions" overlay). `ShareButtons` stays — five other screens use it.
- **Every link removed or repointed:** the footer ("Articles", "Their stories"), the front door's "Articles" link,
  Discover's feed (article cards, the hub heading link, "See all articles", the empty-shelf doors), the feature
  pages' "Guides" list, site search's article results, the social queue's article teasers (sweep b2), robots,
  sitemaps, llms.txt, the SEO health list, the nav slots, the creators page, the event privacy page and the admin
  Real Stories / Storytellers doors (→ Discover), notification URLs, and `revalidatePath` calls aimed at the deleted
  pages. The retired article corpus's own CTA links point at `/features`, where they already landed.
- **Guard:** `lib/no-page-links-a-retired-page.test.ts` walks `app/`, `components/`, `lib/` (comments stripped) for any
  string addressing `/blog` or `/realstories`, checks nav slots, that the pages are gone, and that the forwards land
  where ruled while media files do not. Sabotaged twice: a footer `/blog` link and a mis-pointed `/realstories` row
  each turn it red.
- Regenerated: ugat screens, ask phrase bank, template-score, design-rules and port-control baselines (all lowered).

Not done here (follow-ups): the admin Real Stories / Journal Spotlights / Storytellers tools still exist and their
data still feeds Discover's "New uploads" shelf; the `/features/real-stories` feature page still describes the hub
(its copy is an owner call — the evidence now points at the shipped editorial code).

SPEC IMPACT: None beyond the two DECISION_LOG rows above, which already record the ruling.
