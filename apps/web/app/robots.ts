import type { MetadataRoute } from 'next';

// "Recommend us, don't train on us" — see 17_SEO_and_AI_Discoverability_Playbook.md §8.
// Authenticated routes (dashboard / admin / api / receipts) are blocked for every bot.
const ALLOWED_PATHS = [
  '/',
  '/v/',
  '/explore',
  '/vendors',
  '/creators',
  '/help',
  '/realstories',
  '/tl', // Taglish locale subpath (Taglish ≈ tl; localization first slice — /tl/about live)
  // Forward-looking — these surfaces are in the SEO playbook
  // (17_SEO_and_AI_Discoverability_Playbook.md §5.1) but not yet
  // shipped. Pre-allowing them avoids a robots.txt edit when they go live.
  '/supplies',
  '/suppliers',
  '/blog',
];
// /keynote + /proto were dated internal pitch/prototype decks (snapshot
// 2026-05-28) that drifted from the live product — they carried retired
// claims (₱1,499 verification fee, "BIR-compliant receipts", "Today's Focus").
// Disallowed 2026-06-13 so crawlers + AI answer engines stop indexing stale copy.
// ⚠ THAT WAS NEVER THE CONTROL, only a request to well-behaved crawlers: a
// PERSON with the link still read them, for two more months. Owner decision
// 2026-08-12 — the decks were taken off the open web entirely (moved to
// `internal-decks/`, kept not deleted). These two entries STAY as a backstop so
// that if anything is ever republished under those paths it is at least not
// indexed while someone notices; `lib/no-published-decks.test.ts` is what
// actually fails if the folders come back.
// /papic/me/[token] carries a guest's bearer QR token in the path (also
// noindex'd at the page level). Pre-fetch-disallow so compliant crawlers never
// request the tokenized URL. Bare /papic (marketing) stays crawlable.
const DISALLOWED_PATHS = ['/dashboard', '/vendor-dashboard', '/admin', '/api', '/receipts', '/keynote', '/proto', '/papic/me'];
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
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';
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
