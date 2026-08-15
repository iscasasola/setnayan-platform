import { publishedBlogArticles, blogCategoryLabel } from '@/lib/blog';
import { ALL_HELP_ARTICLES } from '@/lib/help';
import type { PublicSearchNoun } from '@/lib/public-search-nouns';

// ============================================================================
// SITE SEARCH · CORE — the matching, and every corpus that lives in code.
// ============================================================================
//
// The public search box has always said "Search suppliers, stories and guides".
// Its form goes to /explore, and /explore is the supplier marketplace:
// measured 2026-08-15 at origin/main, that page contained ZERO references to
// any article, story or help source, so two of the three promised nouns had no
// code path behind them at all. Not a ranking miss — nothing to rank.
//
// 🔑 IT IS A RESTORATION, NOT A NEW FEATURE. The binding front-door drawing the
// shipped page was ported from (`prototypes/front_door_and_seam_2026-08-12.html`,
// owner-approved) has a search returning THREE labelled groups — "01 ·
// Suppliers", "02 · Studio", "03 · Articles". The port kept the three-noun
// placeholder and shipped one group.
//
// ⚠ NEUTRAL BY DESIGN — no 'server-only', so the unit suite can import it.
// `server-only` is NOT an installed package in this repo, so a test importing
// a module that declares it dies with MODULE_NOT_FOUND before a single
// assertion runs. The shipped precedent is `review-fraud-screener.ts`
// (server-only) beside `review-fraud-scoring.ts` (pure, and the one its tests
// import). This file is the pure half; `site-search.ts` is the IO half.
//
// ─── WHY IN MEMORY, AND WHY THAT IS NOT A SHORTCUT ──────────────────────────
// Guides are a hardcoded TypeScript array (91 articles, 34 published today,
// releasing ~3/week) plus the help corpus (74 live pages). There is no
// full-text index anywhere in this product — measured: zero tsvector columns
// and no pg_trgm extension across the 1127 migrations OR in the production
// database. Filtering ~110 short records costs less than the round trip that
// building one would add, and it cannot go stale against the code that defines
// them. If the corpus reaches thousands, this is the file to revisit — the
// shape of the exports does not change when their insides do.

/**
 * A readable result — an article, a help page, or a published story.
 *
 * `noun` is the PROMISE this hit discharges, not decoration: the placeholder
 * is built from the same noun list, so a promise and its mechanism cannot
 * drift apart silently the way they did for two days.
 */
export type ReadHit = {
  noun: Exclude<PublicSearchNoun, 'suppliers'>;
  /** Short kind label shown on the row — "Guide · Planning", "Help", "Story". */
  tag: string;
  href: string;
  title: string;
  blurb: string;
  /** Higher is better. Title matches outrank body matches. */
  score: number;
};

/**
 * The noun the MARKETPLACE resolves with its own vendor query, untouched by
 * this work. Named so the coverage test can state the whole promise in one
 * expression instead of hardcoding an exception to it.
 */
export const MARKETPLACE_NOUN: PublicSearchNoun = 'suppliers';

/** A corpus that can be searched without leaving the process. */
type InCodeSource = {
  noun: Exclude<PublicSearchNoun, 'suppliers'>;
  find: (tokens: string[], phrase: string) => ReadHit[];
};

/**
 * Function words that must never VETO a match.
 *
 * 🪤 THIS LIST IS WHY "cancel my order" RETURNS ANYTHING. Matching is AND (see
 * `scoreDocument`), so before this existed every word had to appear — and
 * "my" appearing nowhere in a help article was enough to reject the article
 * that answered the question. Measured before the fix: `cancel my order`
 * returned 0 results while the help corpus plainly covers it. A person types
 * a sentence, not keywords, and help queries are the sentence-shaped ones.
 *
 * They are dropped only from the AND requirement. The exact-phrase bonus still
 * reads the WHOLE typed query (see `normalizedPhrase`), so "the release of
 * doves" keeps its phrase hit on a title containing exactly that.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does',
  'for', 'from', 'get', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'is',
  'it', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'our', 'so', 'that', 'the',
  'their', 'them', 'then', 'there', 'they', 'this', 'to', 'up', 'we', 'what',
  'when', 'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your',
]);

/**
 * Split a query into the tokens a document must actually contain.
 *
 * Single characters are dropped: a stray letter matches almost every document
 * and would turn one keystroke into a page of noise.
 *
 * ⚠ IF THE QUERY IS *ONLY* FUNCTION WORDS, THEY ARE KEPT. Someone searching
 * "the one" means those words; stripping them would leave nothing and silently
 * turn a real query into an empty one — the same "returns nothing, explains
 * nothing" shape this whole change exists to remove.
 */
export function searchTokens(query: string): string[] {
  const all = query
    .toLowerCase()
    .split(/[^a-z0-9']+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const content = all.filter((t) => !STOP_WORDS.has(t));
  return content.length > 0 ? content : all;
}

/**
 * The whole typed query, normalized — what the exact-phrase bonus reads.
 *
 * Kept separate from `searchTokens` on purpose: the tokens decide WHETHER a
 * document matches, the phrase decides how HIGH it ranks. Deriving the phrase
 * from the stripped tokens instead would have cost "the release of doves" its
 * phrase hit on the article of that exact name.
 */
export function normalizedPhrase(query: string): string {
  return query
    .toLowerCase()
    .split(/[^a-z0-9']+/i)
    .filter(Boolean)
    .join(' ');
}

/**
 * Score one document against the tokens. Returns 0 when it does not match.
 *
 * ⚠ EVERY TOKEN MUST APPEAR (AND, not OR). A person typing two words means
 * both; OR-matching "wedding checklist" would return every article containing
 * "wedding", which here is nearly all of them — a result page that looks
 * broken rather than helpful.
 *
 * Title hits are worth more than body hits, and an exact phrase in the title
 * outranks scattered tokens, so "release of doves" puts that guide FIRST
 * rather than merely somewhere.
 */
export function scoreDocument(
  title: string,
  body: string,
  tokens: string[],
  /** The whole typed query. Defaults to the tokens, for direct unit use. */
  phrase: string = tokens.join(' '),
): number {
  if (tokens.length === 0) return 0;
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    const inTitle = t.includes(token);
    const inBody = b.includes(token);
    if (!inTitle && !inBody) return 0;
    score += inTitle ? 4 : 1;
  }
  if (phrase.length > 0) {
    if (t.includes(phrase)) score += 6;
    else if (b.includes(phrase)) score += 2;
  }
  return score;
}

/** Trim a help body down to something a result row can show. */
function firstSentence(body: string, max = 150): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const stop = cut.lastIndexOf(' ');
  return `${cut.slice(0, stop > 40 ? stop : max)}…`;
}

/** Published guides — the Journal. */
function guideHits(tokens: string[], phrase: string): ReadHit[] {
  const out: ReadHit[] = [];
  for (const a of publishedBlogArticles()) {
    const category = blogCategoryLabel(a.category);
    const score = scoreDocument(a.title, `${a.excerpt} ${category}`, tokens, phrase);
    if (score > 0) {
      out.push({
        noun: 'guides',
        tag: `Guide · ${category}`,
        href: `/blog/${a.slug}`,
        title: a.title,
        blurb: a.excerpt,
        score,
      });
    }
  }
  return out;
}

/** Help pages — also "guides" to a reader; a different shelf only to us. */
function helpHits(tokens: string[], phrase: string): ReadHit[] {
  const out: ReadHit[] = [];
  for (const { article, topic } of ALL_HELP_ARTICLES) {
    const score = scoreDocument(
      article.title,
      `${article.body} ${topic.label}`,
      tokens,
      phrase,
    );
    if (score > 0) {
      out.push({
        noun: 'guides',
        tag: `Help · ${topic.label}`,
        href: `/help/${article.slug}`,
        title: article.title,
        blurb: firstSentence(article.body),
        score,
      });
    }
  }
  return out;
}

/** Every corpus searchable without IO. */
export const IN_CODE_SOURCES: ReadonlyArray<InCodeSource> = [
  { noun: 'guides', find: guideHits },
  { noun: 'guides', find: helpHits },
];

/**
 * The nouns THIS module resolves — derived from the source list, never typed
 * twice. Delete a source and its noun leaves this array on its own.
 */
export const IN_CODE_READ_NOUNS: ReadonlyArray<Exclude<PublicSearchNoun, 'suppliers'>> =
  Array.from(new Set(IN_CODE_SOURCES.map((s) => s.noun)));

/**
 * Search every in-code corpus for a raw typed query. Pure — no IO, no failure
 * mode.
 *
 * Takes the QUERY rather than pre-split tokens so the tokens and the
 * exact-phrase string are derived together, in one place. Splitting that
 * decision across callers is how one of them ends up passing stripped tokens
 * as the phrase and quietly losing every phrase hit.
 */
export function searchInCodeReads(query: string): ReadHit[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  const phrase = normalizedPhrase(query);
  return IN_CODE_SOURCES.flatMap((s) => s.find(tokens, phrase));
}

/**
 * Order and cap the combined results.
 *
 * Stable by title after score so the same query returns the same order on
 * every render — an ISR page whose result list reshuffles for no reason reads
 * as broken.
 */
export function rankReads(hits: ReadHit[], limit: number): ReadHit[] {
  return [...hits]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}
