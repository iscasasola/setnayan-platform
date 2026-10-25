import { HELP_TOPICS, helpTopicsFor, type HelpRole } from '@/lib/help';
import { FEATURE_PAGES, featureHref } from '@/lib/feature-pages';
import {
  normalizedPhrase,
  rankReads,
  scoreDocument,
  searchTokens,
  type ReadHit,
} from '@/lib/site-search-core';

// ============================================================================
// HOW-SEARCH · CORE — one search for "how does Setnayan work", on /help AND
// /features (owner, 25 Oct 2026, right after Discover search was narrowed to
// suppliers · people · events: *"also the HELP and Features where we can
// mazimize the app to be searchable"*).
// ============================================================================
//
// THREE KINDS, ONE LIST, ONE RANKER:
//   help      an answer from `lib/help.ts`, in the reader's words
//             (`helpTopicsFor` — the iPhone app gets the app's own answers and
//             loses the ones about parts it does not include) and, on /help,
//             the role tile's filter — exactly what /help lists today;
//   features  a page of the Features hub (`lib/feature-pages`, the ONE list
//             the hub, the sitemap and llms.txt read);
//   guide     the guides and stories `searchReads` already finds — minus its
//             help hits, which the `help` kind answers better (in place).
//
// 🔑 NO NEW RANKER. Every row is scored by `scoreDocument` (AND-matching, title
// beats body, an exact phrase wins) and ordered by `rankReads` — the same two
// functions the public search uses, so "papic" ranks the same everywhere.
//
// ⚠ PURE (no 'server-only') so the unit suite can import it; the IO half — the
// store-shell question and the story read — is `lib/how-search.ts`.

export type HowKind = 'help' | 'features' | 'guide';

export type HowHit = {
  kind: HowKind;
  /** The row's kind label — "Help · RSVP", "Features", "Guide · Planning", "Story". */
  tag: string;
  href: string;
  title: string;
  /** One short line, always visible. */
  blurb: string;
  /** Help only: the whole answer, opened in place. */
  answer?: string;
  score: number;
};

export { HOW_SEARCH_PLACEHOLDER } from '@/lib/how-search-words';

/** How many rows a search draws. */
export const HOW_SEARCH_LIMIT = 24;

function shortLine(body: string, max = 140): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const stop = cut.lastIndexOf(' ');
  return `${cut.slice(0, stop > 40 ? stop : max)}…`;
}

/** Help answers, in the reader's words, inside the role's topics when a role is picked. */
export function helpAnswerHits(
  query: string,
  opts: { storeShell: boolean; role?: HelpRole },
): HowHit[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  const phrase = normalizedPhrase(query);
  const topics = helpTopicsFor(HELP_TOPICS, opts.storeShell).filter(
    (t) => !opts.role || t.roles.includes(opts.role),
  );
  const out: HowHit[] = [];
  for (const topic of topics) {
    for (const a of topic.articles) {
      const score = scoreDocument(a.title, `${a.body} ${topic.label}`, tokens, phrase);
      if (score > 0) {
        out.push({
          kind: 'help',
          tag: `Help · ${topic.label}`,
          href: `/help/${a.slug}`,
          title: a.title,
          blurb: shortLine(a.body),
          answer: a.body,
          score,
        });
      }
    }
  }
  // 🪤 ONE ADDRESS, ONE ROW. Two different answers once shared the slug `what-is-papic` — /help/what-is-papic could
  // open only one of them, and two rows with one address drew a duplicate React key. The slug is fixed (the second is
  // `how-papic-works`) and the guard holds slugs unique; this stays so a repeat can never draw the key twice.
  const byHref = new Map<string, HowHit>();
  for (const h of out) {
    const had = byHref.get(h.href);
    if (!had || h.score > had.score) byHref.set(h.href, h);
  }
  return [...byHref.values()];
}

/** The Features hub's own entries — name, its one line, what it is, and the words people search. */
export function featurePageHits(query: string): HowHit[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  const phrase = normalizedPhrase(query);
  const out: HowHit[] = [];
  for (const f of FEATURE_PAGES) {
    const body = [f.line.en, f.description.en, f.answer.en, f.keywords.en.join(' ')].join(' ');
    const score = scoreDocument(f.name.en, body, tokens, phrase);
    if (score > 0) {
      out.push({
        kind: 'features',
        tag: 'Features',
        href: featureHref(f.slug, 'en'),
        title: f.name.en,
        blurb: f.line.en,
        score,
      });
    }
  }
  return out;
}

/** Guides and stories from `searchReads` — its help hits dropped (the `help` kind answers them in place). */
export function guideHitsFromReads(reads: ReadonlyArray<ReadHit>): HowHit[] {
  return reads
    .filter((r) => !r.href.startsWith('/help/'))
    .map((r) => ({ kind: 'guide' as const, tag: r.tag, href: r.href, title: r.title, blurb: r.blurb, score: r.score }));
}

/** The whole answer: three kinds, one `rankReads` order, capped. */
export function composeHowSearch(input: {
  query: string;
  storeShell: boolean;
  role?: HelpRole;
  reads: ReadonlyArray<ReadHit>;
  limit?: number;
}): HowHit[] {
  if (searchTokens(input.query).length === 0) return [];
  return rankReads(
    [
      ...helpAnswerHits(input.query, { storeShell: input.storeShell, role: input.role }),
      ...featurePageHits(input.query),
      ...guideHitsFromReads(input.reads),
    ],
    input.limit ?? HOW_SEARCH_LIMIT,
  );
}
