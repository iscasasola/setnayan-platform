/**
 * ARTICLES' PAGES FOLLOW THE 16 NOV RULINGS (DECISION_LOG, specs repo):
 *
 *   · "Discover happens inside the account" + Articles ruling 3: the topic LIST
 *     is inside the account — a signed-out visitor is sent to sign in.
 *   · Articles ruling 3: a topic's EXACT LINK opens read-only signed out — the
 *     topic page never sends anyone away, draws no composer and no Report for a
 *     signed-out reader, and offers "Sign in to reply".
 *   · Report reuses the SHIPPED six-reason sheet (`ReportPageButton`) and the
 *     shipped filing path (`fileReport` → user_reports) with the two new targets.
 *   · Discover's "Articles" shelf has one read to call: `latestArticleTopics`.
 *   · ZERO new server actions — the write is one route.
 *
 * SABOTAGE (each turns this red):
 *   · delete the redirect from /articles                    → red
 *   · add a redirect (or getCurrentUser gate) to the topic  → red
 *   · render ReplyComposer without the signedIn branch       → red
 *   · swap ReportPageButton for a new sheet                  → red
 *   · drop 'article_reply' from PUBLIC_TARGETS                → red
 *   · put 'use server' on the write path                      → red
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const LIST = 'app/(shell)/articles/page.tsx';
const TOPIC = 'app/(shell)/articles/[topicId]/page.tsx';

test('the topic list is inside the account', () => {
  const src = code(LIST);
  assert.match(
    src,
    /const user = await getCurrentUser\(\);\s*if \(!user\) redirect\(loginRedirectPath\('\/articles'\)\);/,
    'a signed-out visitor must be sent to sign in before anything is read',
  );
  assert.ok(src.indexOf('redirect(') < src.indexOf('listArticleTopics('), 'the gate comes before the read');
});

test("a topic's exact link opens read-only when signed out", () => {
  const src = code(TOPIC);
  assert.ok(!/\bredirect\(/.test(src), 'the topic page must never send a signed-out reader away');
  assert.match(src, /getCurrentUser\(\)/);
  assert.match(src, /readArticleThread\(topicId, user\?\.id \?\? null\)/, 'it reads the topic for anyone');
  // The composer lives only on the signed-in branch, after the signed-out one.
  const signedOut = src.indexOf('!signedIn ? (');
  const composer = src.indexOf('<ReplyComposer');
  assert.ok(signedOut > 0 && composer > signedOut, 'ReplyComposer must sit behind the signed-out branch');
  assert.match(src, /Sign in to reply/);
  // Report is offered only to a signed-in reader.
  for (const m of src.matchAll(/<ReportPageButton/g)) {
    const before = src.slice(Math.max(0, (m.index ?? 0) - 200), m.index);
    assert.match(before, /signedIn &&/, 'Report must be signed-in only');
  }
  // The desktop list pane is signed-in only too (the list is inside the account).
  assert.match(src, /signedIn \? listArticleTopics\(/);
});

test('report reuses the shipped sheet and the one queue', () => {
  const topic = code(TOPIC);
  assert.match(topic, /import \{ ReportPageButton \} from '@\/app\/_components\/report-page-button'/);
  assert.match(topic, /targetType="article_topic"/);
  assert.match(topic, /kind="article_reply"/);
  const reports = code('lib/reports.ts');
  assert.match(reports, /PUBLIC_TARGETS = \[[^\]]*'article_topic', 'article_reply'\]/);
  const sheet = code('app/_components/report-page-button.tsx');
  assert.match(sheet, /'article_topic' \| 'article_reply'/);
  assert.match(sheet, /fileReport\(/, 'the sheet still files through the shipped path');
});

test('Discover has one read for its Articles shelf', () => {
  const src = code('lib/articles.server.ts');
  assert.match(src, /export async function latestArticleTopics\(limit = \d+\): Promise<ArticleRead<ArticleTopicCard\[\]>>/);
});

test('zero new server actions — the writes go through one route', () => {
  for (const f of [
    'app/api/articles/route.ts',
    'lib/articles.server.ts',
    'lib/articles-moderation.server.ts',
    'app/(shell)/articles/_components/article-composer.tsx',
  ]) {
    assert.ok(!/^\s*['"]use server['"]/m.test(code(f)), `${f} must not be a server-action file`);
  }
  const route = code('app/api/articles/route.ts');
  assert.match(route, /export async function POST\(/);
  assert.ok(!/export async function (GET|PUT|PATCH|DELETE)\(/.test(route), 'one door: POST only');
  assert.match(route, /if \(!user\) return NextResponse\.json\(\{ ok: false, error: 'sign_in' \}, \{ status: 401 \}\)/);
});
