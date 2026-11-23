import 'server-only';

/**
 * articles-index.server.ts — the public articles every search-engine surface lists: Discover's Articles part,
 * `llms.txt` and `sitemap-articles.xml` (Build 3 of the Find · Build · Book drawing, owner-approved 17 Nov).
 *
 * NO READ OF ITS OWN. Both functions are Build 2's reads (`lib/articles.server.ts`, #7919), which already decide what
 * "public" means: published, has an address, not future-dated, NOT REMOVED (`removed_at is null` — an admin Hide;
 * ruled 18 Nov: "hidden" uses `removed_at`), and an author the reader may see (the article RLS policy). So Discover,
 * llms.txt, the sitemap and the article page itself can never disagree about a post.
 *
 * 🔑 A REFUSED READ IS NOT "NO ARTICLES": `ok: false`. Discover then says the part could not load; the sitemap and
 * llms.txt list nothing rather than a half-list.
 *
 * 🔒 lib/articles-are-findable.test.ts
 */
import { listArticles, listPublicArticleAddresses } from '@/lib/articles.server';
import type { IndexedArticle } from '@/lib/articles-index';

/** The newest public articles (Build 2's feed read, ≤ 60) — for Discover and llms.txt. */
export async function readPublicArticles(): Promise<{ ok: boolean; items: IndexedArticle[] }> {
  const res = await listArticles();
  if (!res.ok) return { ok: false, items: [] };
  return {
    ok: true,
    items: res.data.articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      byline: a.byline,
      publishedAt: a.publishedAt,
      updatedAt: a.updatedAt,
      summary: a.excerpt,
    })),
  };
}

/** Every public article's address and when it last changed — for the sitemap. */
export async function readPublicArticleAddresses(): Promise<{ ok: boolean; items: { slug: string; updatedAt: string }[] }> {
  const res = await listPublicArticleAddresses();
  return res.ok ? { ok: true, items: res.data } : { ok: false, items: [] };
}
