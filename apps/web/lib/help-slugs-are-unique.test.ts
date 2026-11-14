/**
 * EVERY HELP SLUG IS GLOBALLY UNIQUE — across lib/help/ AND lib/help-admin/.
 *
 * `/help/[slug]` resolves an article with no topic segment (`findHelpArticle`),
 * so a slug must name exactly one answer. Before 2026-11-14 the whole public
 * corpus was one literal in lib/help.ts and a duplicate stood out in review.
 * The help split put the answers into eight files written by eight sessions in
 * parallel — two of them can each add `slug: 'booking-fee'` and both PRs pass
 * alone. This test reads the merged corpus, so the second one goes red.
 *
 * The admin topics count too: an admin slug that equals a public one would let
 * `findHelpArticle` hand an internal guide's slug to a public page (B3), and
 * public-help-says-what-is-true.test.ts would then refuse it — better to be told
 * here, by name, which file holds the twin. Topic keys are held the same way.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_TOPICS } from '@/lib/help';
import { ADMIN_HELP_TOPICS } from '@/lib/help-admin';

function twins(items: ReadonlyArray<{ id: string; where: string }>): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const { id, where } of items) {
    const first = seen.get(id);
    if (first !== undefined) out.push(`"${id}" — in ${first} AND in ${where}`);
    else seen.set(id, where);
  }
  return out;
}

const topics = [
  ...HELP_TOPICS.map((t) => ({ t, side: 'public' })),
  ...ADMIN_HELP_TOPICS.map((t) => ({ t, side: 'admin' })),
];

test('every help slug names exactly one answer (public + admin)', () => {
  const slugs = topics.flatMap(({ t, side }) => t.articles.map((a) => ({ id: a.slug, where: `${side} topic ${t.key}` })));
  assert.ok(slugs.length >= 100, `only ${slugs.length} slugs read — the corpus moved; re-point this test`);
  assert.deepEqual(twins(slugs), [], 'Two help answers share a slug — /help/[slug] can only open one of them');
});

test('every help topic key is unique (public + admin)', () => {
  assert.deepEqual(twins(topics.map(({ t, side }) => ({ id: t.key, where: `${side} help` }))), [], 'Two help topics share a key');
});

test('every slug is a URL segment (lowercase words joined by hyphens)', () => {
  const bad = topics.flatMap(({ t }) => t.articles.map((a) => a.slug)).filter((s) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s));
  assert.deepEqual(bad, [], 'A help slug is not a clean URL segment');
});
