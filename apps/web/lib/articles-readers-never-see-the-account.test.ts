/**
 * ARTICLES ARE ANONYMOUS TO READERS, KNOWN TO SETNAYAN — and suppliers are
 * marked (owner, 16 Nov: "articles anonymous to readers but known to Setnayan";
 * Articles ruling 2: "Suppliers may post, marked 'Supplier · code'").
 *
 * The schema half (Pattern F: no reader can select the tables) is proved in
 * `tests/db/articles-hold-their-rules.db.test.ts`. This is the server half:
 * what the reader functions HAND a page.
 *
 * SABOTAGE (each turns this red):
 *   · add `authorUserId` / `email` / `display_name` to a reader type → red
 *   · return the author id on an ArticlePost                          → red
 *   · label everybody "Guest" (drop the supplier branch)               → red
 *   · stop reading vendor_team_members (team members post as Guest)   → red
 *   · let an unreadable kind fall through to 'guest' (fail open)      → red
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = stripComments(readFileSync(join(WEB, 'lib/articles.server.ts'), 'utf8'));

function typeBody(name: string): string {
  const at = src.indexOf(`export type ${name} = {`);
  assert.ok(at >= 0, `${name} is missing`);
  return src.slice(at, src.indexOf('\n};', at));
}

test('no reader type carries the account', () => {
  for (const t of ['ArticleTopicCard', 'ArticlePost', 'ArticleThread']) {
    const body = typeBody(t);
    for (const leak of ['user', 'User', 'email', 'display_name', 'displayName', 'name:', 'account']) {
      assert.ok(!body.includes(leak), `${t} carries "${leak}" — a reader would get the real account`);
    }
  }
  // The thread read builds posts from a label map; the account id is only a map KEY.
  const read = src.slice(src.indexOf('export async function readArticleThread'), src.indexOf('export async function isPausedFromArticles'));
  assert.ok(!/author_user_id\s*:/.test(read), 'readArticleThread must not put author_user_id on what it returns');
  assert.ok(!/authorUserId/.test(read));
  // The list never even selects it.
  const list = src.slice(src.indexOf('export async function listArticleTopics'), src.indexOf('export async function latestArticleTopics'));
  assert.ok(!list.includes('author_user_id'), 'the topic list must not select the author');
});

test('the only name a reader sees is "Guest · code" or "Supplier · code"', async () => {
  const { articleLabel } = await import('@/lib/articles-names');
  assert.equal(articleLabel('guest', '3F'), 'Guest · 3F');
  assert.equal(articleLabel('supplier', 'K2'), 'Supplier · K2');
});

test('a shop owner OR a shop team member posts as a Supplier, and an unknown kind refuses', () => {
  const fn = src.slice(src.indexOf('export async function articleAuthorKind'), src.indexOf('const CODE_ALPHABET'));
  assert.match(fn, /from\('vendor_profiles'\)/);
  assert.match(fn, /from\('vendor_team_members'\)/);
  assert.match(fn, /'supplier' : 'guest'/);
  assert.match(fn, /if \(owned\.error \|\| team\.error\)[\s\S]{0,160}return null/, 'a refused read must return null, never "guest"');
  const gate = src.slice(src.indexOf('async function gateWriter'), src.indexOf('async function eventTypeIsActive'));
  assert.match(gate, /kind === null\) return \{ ok: false, error: 'unavailable' \}/, 'the write must refuse when the kind is unknown');
});

test('the code is fixed per person per topic and comes from the codes table', () => {
  const fn = src.slice(src.indexOf('async function codeInTopic'), src.indexOf('export type ArticleWriteError'));
  assert.match(fn, /from\('article_topic_codes'\)[\s\S]{0,200}\.eq\('topic_id', topicId\)[\s\S]{0,80}\.eq\('user_id', userId\)/);
  assert.match(fn, /if \(existing\) return/, 'an existing code is reused — never a second one');
});
