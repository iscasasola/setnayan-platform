import { TOPICS_EXISTING } from '@/lib/help/topics-existing';
import { SUPPLIER_1_TOPICS } from '@/lib/help/supplier-1';
import { SUPPLIER_2_TOPICS } from '@/lib/help/supplier-2';
import { USER_1_TOPICS } from '@/lib/help/user-1';
import { USER_2_TOPICS } from '@/lib/help/user-2';
import { USER_3_TOPICS } from '@/lib/help/user-3';
import { USER_4_TOPICS } from '@/lib/help/user-4';
import { SUPPLIER_FIRST_STEPS_TOPICS } from '@/lib/help/supplier-first-steps';
import { HELP_NOT_IN_THE_APP } from '@/lib/help/not-in-the-app';

/**
 * WHO A PUBLIC HELP TOPIC IS FOR. ⛔ There is deliberately no team/admin value:
 * the operations guides live in lib/help-admin.ts, which no public route may
 * import (sweep 2026-10-19 B3 — see that file). A role filter is not a wall;
 * a missing type member is.
 */
export type HelpRole = 'couple' | 'vendor' | 'guest';

/** Every audience the public help may address — the guard iterates this. */
export const PUBLIC_HELP_ROLES: ReadonlyArray<HelpRole> = ['couple', 'vendor', 'guest'];

export type HelpArticle = {
  slug: string;
  title: string;
  body: string;
  /**
   * 🍎 WHAT THE IPHONE APP SAYS INSTEAD (Apple check 2026-10-19, rows #6 · #14
   * — guideline 3.1.1 / 2.3.10). Present only where `body` points a reader at
   * the web to buy ("current rate on setnayan.com/pricing", "a one-time
   * purchase that unlocks", "Everything you buy goes into one pot"), names
   * Android or the desktop app, or walks a couple through a part the app does
   * not include. It says what the feature DOES, with no price, purchase or
   * pointer — or, where the whole answer is a part the app does not include,
   * it is `HELP_NOT_IN_THE_APP` and the app's /help index drops the question.
   * Read through `helpBodyFor` / `helpTopicsFor`, never directly; held by
   * lib/help-in-the-app-sells-nothing.test.ts.
   */
  appBody?: string;
};

/** Defined in lib/help/not-in-the-app.ts (the topic files need it without importing this module); re-exported here. */
export { HELP_NOT_IN_THE_APP };

/** The answer this reader is shown: the app's own words in the store shell. */
export function helpBodyFor(article: HelpArticle, storeShell: boolean): string {
  return storeShell && article.appBody !== undefined ? article.appBody : article.body;
}

/**
 * The topics as this reader sees them. Off the store shell: unchanged. In the
 * store shell: every body is the app's answer, a question whose whole answer
 * is `HELP_NOT_IN_THE_APP` is left out, and a topic left with no questions
 * goes too — so the app's /help lists only what the app does.
 */
export function helpTopicsFor(topics: ReadonlyArray<HelpTopic>, storeShell: boolean): HelpTopic[] {
  if (!storeShell) return [...topics];
  return topics
    .map((t) => ({
      ...t,
      articles: t.articles
        .filter((a) => a.appBody !== HELP_NOT_IN_THE_APP)
        .map((a) => ({ slug: a.slug, title: a.title, body: helpBodyFor(a, true) })),
    }))
    .filter((t) => t.articles.length > 0);
}

export type HelpTopic = {
  key: string;
  label: string;
  roles: ReadonlyArray<HelpRole>;
  articles: HelpArticle[];
};

export const HELP_ROLES: ReadonlyArray<{
  key: HelpRole;
  label: string;
  blurb: string;
}> = [
  {
    key: 'couple',
    label: 'Couple',
    blurb: "You're planning an event. Guest list, suppliers, budget, the day itself.",
  },
  {
    key: 'vendor',
    label: 'Supplier',
    blurb: 'You sell a service to couples on Setnayan.',
  },
  {
    key: 'guest',
    label: 'Guest',
    blurb: 'You got an invite. Time to RSVP and show up.',
  },
];


/**
 * THE PUBLIC HELP, IN ORDER. The text lives in lib/help/ (split 2026-11-14 so
 * eight sessions can each own one file): the 16 topics that existed first, then
 * one slot per answer-writing session. Pricing discipline, house words and the
 * appBody rule all still apply to every file — see topics-existing.ts. Admin
 * topics are NOT here: lib/help-admin.ts, which no public route may import.
 */
export const HELP_TOPICS: ReadonlyArray<HelpTopic> = [
  ...TOPICS_EXISTING,
  ...SUPPLIER_1_TOPICS,
  ...SUPPLIER_2_TOPICS,
  ...USER_1_TOPICS,
  ...USER_2_TOPICS,
  ...USER_3_TOPICS,
  ...USER_4_TOPICS,
  ...SUPPLIER_FIRST_STEPS_TOPICS,
];

// ───────────────────────────────────────────────────────────────────────────
// Per-article lookup helpers (SEO/GEO — /help/[slug] indexable article pages,
// 2026-06-13). Article slugs are GLOBALLY UNIQUE across all topics (verified),
// so a flat slug → article resolution is unambiguous and the public URL can be
// /help/[slug] with no topic segment.
//
// `HELP_LASTMOD` is the single honest last-substantive-edit date for the help
// corpus — every article was authored/last-revised together (GEO Phase G3,
// 2026-05-28). The sitemap-help route stamps every help URL with this one date
// rather than a build-time Date() (which Google reads as freshness fraud). Bump
// it in the same edit when an article body materially changes.
// ───────────────────────────────────────────────────────────────────────────

/**
 * 🧱 WHICH /help/[slug] PAGES ARE BUILT AHEAD (help split, 2026-11-14). Only the answers that existed before the
 * split — topics-existing.ts. Every answer the eight slot files add is rendered on its first visit and cached like
 * the rest (`revalidate`), because each page built ahead is build time on every deploy: the slots add about 250
 * answers, which would take the build past STATIC_PAGE_CEILING (apps/web/scripts/check-build-budget.mjs). Held by
 * lib/help-pages-built-ahead-stay-fixed.test.ts.
 */
export const HELP_PRERENDER_SLUGS: ReadonlyArray<string> = TOPICS_EXISTING.flatMap((t) => t.articles.map((a) => a.slug));

export const HELP_LASTMOD = '2026-11-13';

export type HelpArticleWithTopic = {
  article: HelpArticle;
  topic: HelpTopic;
};

/** Flat list of every article paired with its parent topic. */
export const ALL_HELP_ARTICLES: ReadonlyArray<HelpArticleWithTopic> =
  HELP_TOPICS.flatMap((topic) =>
    topic.articles.map((article) => ({ article, topic })),
  );

/** Resolve an article (and its topic) by its globally-unique slug. */
export function findHelpArticle(
  slug: string,
): HelpArticleWithTopic | undefined {
  return ALL_HELP_ARTICLES.find((entry) => entry.article.slug === slug);
}

/** Other articles in the same topic — used for "related" cross-links. */
export function relatedHelpArticles(
  slug: string,
  limit = 6,
): HelpArticle[] {
  const found = findHelpArticle(slug);
  if (!found) return [];
  return found.topic.articles
    .filter((a) => a.slug !== slug)
    .slice(0, limit);
}

/**
 * Trim an article body to a meta-description-friendly length (~155 chars) at a
 * word boundary, never mid-word, with an ellipsis when truncated.
 */
export function helpMetaDescription(body: string, max = 155): string {
  // Flatten paragraph newlines/indentation to single spaces so multi-line
  // article bodies still yield a clean one-line meta description.
  body = body.replace(/\s+/g, ' ').trim();
  if (body.length <= max) return body;
  const slice = body.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}
