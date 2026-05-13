import type { MetadataRoute } from 'next';

/**
 * Public robots.txt. Allow indexing of the marketing surfaces; disallow
 * authenticated routes + the API gateway (those shouldn't show in search).
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/help', '/login', '/signup', '/privacy', '/terms', '/v/'],
        disallow: ['/dashboard', '/vendor-dashboard', '/admin', '/api', '/receipts'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
