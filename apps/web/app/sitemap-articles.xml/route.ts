/**
 * Articles sitemap at /sitemap-articles.xml (Build 3 of the Find · Build · Book drawing, owner-approved 17 Nov;
 * DECISION_LOG 2026-11-17 "DISCOVER ARTICLES ARE FOUND ON GOOGLE AND BY AI ANSWER ENGINES").
 *
 * Every public article — a member's post, and the Setnayan Journal once Build 2 imports it — from the moment it
 * posts. A removed post (unpublished, a private or deleted profile) and a post an admin HID are left out. The
 * rules and the XML are `lib/articles-index.ts`; the one read is `readPublicArticles`.
 *
 * Failure mode: an empty `<urlset>` — the same as the vendors sitemap. A refused read lists nothing rather than a
 * half-list, and never republishes a hidden post.
 *
 * 🔒 lib/articles-are-findable.test.ts
 */
import { readPublicArticles } from '@/lib/articles-index.server';
import { articlesSitemapUrls } from '@/lib/articles-index';

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';
  const { items } = await readPublicArticles();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${articlesSitemapUrls(items, baseUrl)}
</urlset>`;
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
