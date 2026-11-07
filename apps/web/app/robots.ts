import type { MetadataRoute } from 'next';

// "Recommend us, don't train on us" — see 17_SEO_and_AI_Discoverability_Playbook.md §8,
// with ONE exception since 2026-11-02 (DECISION_LOG "BE FINDABLE BY AI"): Google-Extended
// may read the public pages so Gemini can find and recommend us.
// Authenticated routes (dashboard / admin / api / receipts) are blocked for every bot.
const ALLOWED_PATHS = [
  '/',
  '/v/',
  '/explore',
  '/for-suppliers',
  '/for-coordinators',
  '/creators',
  '/help',
  '/realstories',
  // Taglish locale SUBPATH (Taglish ≈ tl): /tl/about, /tl/features, /tl/features/<slug>.
  // ⚠ '/tl/' with the slash (2026-10-13): there is no bare /tl page — the corpus
  // keeps /tl as the locale prefix for twins, not a Tagalog home — and the bare
  // 'Allow: /tl' read as a page that 404s (quality sweep item 10). The prefix
  // still allows every twin. Guard: app/robots-allows-only-real-pages.test.ts.
  '/tl/',
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
// Google-Extended is not a crawler of its own — Googlebot fetches, and this token
// only says whether Gemini may use what it fetched. Owner 2026-11-02 ("Be findable
// by AI"): let Gemini read our PUBLIC pages. It gets exactly the `*` rule (same
// allow list, same private + query disallows), stated explicitly so a reader of
// robots.txt sees the choice rather than an absence. The answer-engine list above
// is unchanged. Guard: app/robots-lets-gemini-read.test.ts.
const AI_READERS_WE_WELCOME = ['Google-Extended'];
// Pure training / resale scrapers — still blocked from everything.
const AI_TRAINING_BOTS = [
  'GPTBot',
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
      ...AI_READERS_WE_WELCOME.map((userAgent) => ({
        userAgent,
        allow: ALLOWED_PATHS,
        disallow: [...DISALLOWED_PATHS, ...QUERY_DISALLOWS],
      })),
      ...AI_TRAINING_BOTS.map((userAgent) => ({
        userAgent,
        disallow: ['/'],
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
