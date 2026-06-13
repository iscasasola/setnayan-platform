import type { MetadataRoute } from 'next';

// "Recommend us, don't train on us" — see 17_SEO_and_AI_Discoverability_Playbook.md §8.
// Authenticated routes (dashboard / admin / api / receipts) are blocked for every bot.
const ALLOWED_PATHS = [
  '/',
  '/v/',
  '/explore',
  '/venues',
  '/venue/',
  '/for-vendors',
  '/help',
  '/weddings',
  '/tl', // Taglish locale subpath (Taglish ≈ tl; localization first slice — /tl/about live)
  // Forward-looking — these surfaces are in the SEO playbook
  // (17_SEO_and_AI_Discoverability_Playbook.md §5.1) but not yet
  // shipped. Pre-allowing them avoids a robots.txt edit when they go live.
  '/supplies',
  '/suppliers',
  '/blog',
];
// /keynote + /proto are dated internal pitch/prototype decks (snapshot
// 2026-05-28) that drifted from the live product — they carried retired
// claims (₱1,499 verification fee, "BIR-compliant receipts", "Today's Focus").
// Disallowed 2026-06-13 so crawlers + AI answer engines stop indexing stale copy.
const DISALLOWED_PATHS = ['/dashboard', '/vendor-dashboard', '/admin', '/api', '/receipts', '/keynote', '/proto'];
const QUERY_DISALLOWS = ['/*?sort=', '/*?filter=', '/*?session=', '/*?ref='];

const AI_ANSWER_ENGINES = ['ChatGPT-User', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot'];
const AI_TRAINING_BOTS = [
  'GPTBot',
  'Google-Extended',
  'Applebot-Extended',
  'Amazonbot',
  'cohere-ai',
  'Bytespider',
  'Diffbot',
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ALLOWED_PATHS,
        disallow: [...DISALLOWED_PATHS, ...QUERY_DISALLOWS],
      },
      ...AI_ANSWER_ENGINES.map((userAgent) => ({
        userAgent,
        allow: ALLOWED_PATHS,
        disallow: DISALLOWED_PATHS,
      })),
      ...AI_TRAINING_BOTS.map((userAgent) => ({
        userAgent,
        disallow: ['/'],
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
