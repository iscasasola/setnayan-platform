// public-articles.ts — pure, no server imports, so the rule can be tested on its own.
/**
 * 📅 THE ONE DEFINITION OF "A PUBLIC ARTICLE, NOW", so no read can
 * forget a clause (every read in articles.server.ts uses it). Published · has an address · not taken down · and its date has arrived. The Journal import
 * schedules posts ahead (status published, a future `published_at`), and lib/blog.ts used to hide those; a
 * read that skipped the date served them early (ship-controller review, PR #7919). The RLS policy
 * `public_can_read_published_article` holds the same rule in the database.
 */
// A shallow constraint on purpose: a self-referencing generic over the PostgREST builder trips TS2589 ("type
// instantiation is excessively deep"). The four clauses themselves are proven by the-journal-is-setnayans-and-dated.test.ts.
type Chain = {
  eq(column: string, value: unknown): Chain;
  is(column: string, value: null): Chain;
  not(column: string, operator: string, value: unknown): Chain;
  lte(column: string, value: string): Chain;
};
export function onlyPublicArticles<Q extends { eq: unknown; is: unknown; not: unknown; lte: unknown }>(
  q: Q,
  now: Date = new Date(),
): Q {
  const chain = q as unknown as Chain;
  return chain
    .eq('status', 'published')
    .is('removed_at', null)
    .not('slug', 'is', null)
    .lte('published_at', now.toISOString()) as unknown as Q;
}
