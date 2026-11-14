/**
 * HELP CORPUS DIGEST — one fingerprint of every word the help shows.
 *
 * Prints a sha256 over everything a reader (or a crawler) can get out of the
 * help corpus: every public topic in order (key · label · roles), every article
 * (slug · title · body · appBody), the iPhone-app view (`helpTopicsFor(…, true)`),
 * the flat ALL_HELP_ARTICLES order, the role cards, HELP_LASTMOD, and the
 * internal admin topics. Two trees with the same digest show the same help.
 *
 * Use it to prove a refactor moved no word (2026-11-14, the help.ts split):
 *   git checkout origin/main && npx tsx scripts/help-corpus-digest.ts > /tmp/before.txt
 *   git checkout <branch>    && npx tsx scripts/help-corpus-digest.ts > /tmp/after.txt
 *   diff /tmp/before.txt /tmp/after.txt   # empty = no word changed
 * `--json` prints the full serialisation instead, so a non-empty diff names the article.
 *
 * Run from apps/web. It reads lib/help-admin.ts, so it is a dev script — never import it from a route.
 */
import { createHash } from 'node:crypto';
import { ALL_HELP_ARTICLES, HELP_LASTMOD, HELP_ROLES, HELP_TOPICS, helpTopicsFor } from '@/lib/help';
import { ADMIN_HELP_TOPICS } from '@/lib/help-admin';

const article = (a: { slug: string; title: string; body: string; appBody?: string }) => ({
  slug: a.slug,
  title: a.title,
  body: a.body,
  appBody: a.appBody ?? null,
});

const corpus = {
  lastmod: HELP_LASTMOD,
  roles: HELP_ROLES,
  topics: HELP_TOPICS.map((t) => ({ key: t.key, label: t.label, roles: t.roles, articles: t.articles.map(article) })),
  appView: helpTopicsFor(HELP_TOPICS, true).map((t) => ({ key: t.key, articles: t.articles.map(article) })),
  flat: ALL_HELP_ARTICLES.map(({ article: a, topic }) => `${topic.key}/${a.slug}`),
  admin: ADMIN_HELP_TOPICS.map((t) => ({ key: t.key, label: t.label, audience: t.audience, articles: t.articles.map(article) })),
};

const json = JSON.stringify(corpus, null, 1);
if (process.argv.includes('--json')) {
  console.log(json);
} else {
  const n = corpus.topics.reduce((s, t) => s + t.articles.length, 0);
  const m = corpus.admin.reduce((s, t) => s + t.articles.length, 0);
  console.log(`public topics ${corpus.topics.length} · public articles ${n} · admin topics ${corpus.admin.length} · admin articles ${m}`);
  console.log(`sha256 ${createHash('sha256').update(json).digest('hex')}`);
}
