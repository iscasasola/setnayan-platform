## 2026-07-01 · content(blog): seed 3 launch Journal articles (STAGED, not published)

Added 3 launch-ready Setnayan Journal articles in a new batch module
(`apps/web/lib/blog-batches/launch-seed.ts`), wired into `lib/blog.ts`
`BLOG_ARTICLES` and `lib/social/journal-hooks.ts` `JOURNAL_SOCIAL_HOOKS`:

- `how-to-budget-a-philippine-wedding-step-by-step` (planning) — the four-step
  "build your number from zero" budget walkthrough (no existing step-by-step
  budget-build article).
- `questions-to-ask-every-wedding-vendor` (vendors) — the ten questions that
  apply to EVERY supplier, not just photographers; pulls toward `/explore`.
- `choosing-your-ceremony-by-faith-philippines` (culture) — a cross-faith
  ceremony chooser that hubs the per-faith deep-dives in the regional-faith batch.

Reuses existing covers (`budget.webp` / `photo.webp` / `ceremony.webp`) — no new
public assets. All 3 slugs are collision-free against the existing registry.

OWNER-SAFETY — staged, NOT published: `publishedAt` is a far-future sentinel
(`2099-01-01`) on all three. The public surface (`publishedBlogArticles` →
`/blog` index + `sitemap-blog`) AND the Facebook auto-syndication sweep
(`lib/social/flush.ts` · `sweepJournalArticles`) both gate on
`publishedAt <= today`, so these three are NOT listed on /blog, NOT in the
sitemap, and NOTHING auto-posts to the Setnayan Facebook page on merge. They are
still pre-rendered + reachable by direct slug (`generateStaticParams` reads the
full registry), so the loader/renderer + JSON-LD are proven. To go live, the
owner changes each `publishedAt` to the intended launch date; the next social
sweep then posts each to Facebook (drip-throttled ≤3/day).

SPEC IMPACT: None — content-only; no schema, no migration, no SKU/pricing/flow
change. No corpus decision-log row needed.
