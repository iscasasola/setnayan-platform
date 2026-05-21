import type { MetadataRoute } from 'next';

/**
 * Public sitemap. Includes the marketing landing + open public pages
 * (help, privacy, terms, vendor marketplace, vendor-acquisition page).
 * Dashboard/admin routes are deliberately excluded — they're auth-gated
 * and shouldn't appear in search results.
 *
 * Vendor public profiles at /v/[slug] are listed if their is_published
 * flag is on; that requires a DB call, deferred until R2/CDN are wired
 * since vendor profile pages need image hosting to be useful.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const now = new Date();
  return [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/vendors`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/weddings`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/features`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/for-vendors`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/how-it-works`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/help`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/waitlist`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/download`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/signup`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
