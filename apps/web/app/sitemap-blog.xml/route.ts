/**
 * Journal sitemap at /sitemap-blog.xml.
 *
 * Iteration 0038 first slice (SEO/GEO 2026-06-13). Advertises the /blog hub +
 * every per-article URL at /blog/[slug] (BlogPosting + BreadcrumbList JSON-LD).
 *
 * Unlike the help corpus (one shared HELP_LASTMOD), blog posts carry real
 * per-article dates, so each row stamps its own honest `<lastmod>` from
 * updatedAt ?? publishedAt — never a build-time Date() (which Google reads as
 * freshness fraud). The article set is an in-code constant (no DB), so this
 * route is pure string assembly and can't fail on a DB outage.
 */

import { ALL_BLOG_ARTICLES, BLOG_LASTMOD } from '@/lib/blog';

export const revalidate = 3600;

export function GET(): Response {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  const rows: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [
    { loc: `${baseUrl}/blog`, lastmod: BLOG_LASTMOD, changefreq: 'weekly', priority: '0.7' },
    ...ALL_BLOG_ARTICLES.map((article) => ({
      loc: `${baseUrl}/blog/${article.slug}`,
      lastmod: article.updatedAt ?? article.publishedAt,
      changefreq: 'monthly',
      priority: '0.6',
    })),
  ];

  const urls = rows
    .map(
      (r) =>
        `  <url>\n    <loc>${r.loc}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
