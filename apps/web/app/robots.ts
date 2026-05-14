import type { MetadataRoute } from 'next';

// "Recommend us, don't train on us" — see 17_SEO_and_AI_Discoverability_Playbook.md §8.
// Authenticated routes (dashboard / admin / api / receipts) are blocked for every bot.
const ALLOWED_PATHS = ['/', '/v/', '/supplies', '/suppliers', '/blog', '/help'];
const DISALLOWED_PATHS = ['/dashboard', '/vendor-dashboard', '/admin', '/api', '/receipts'];
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
