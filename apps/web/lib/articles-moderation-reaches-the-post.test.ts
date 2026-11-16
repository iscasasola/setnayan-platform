/**
 * ARTICLES MODERATION REACHES THE POST — Admin › User reports: Keep · Remove ·
 * Remove and pause posting; a pause stops posting in ARTICLES ONLY (owner ruling
 * 1, 16 Nov; prototype screen 6).
 *
 * 🔑 BOTH ENDS, OR NEITHER (the lesson of a-couple-can-report-a-shop.test.ts):
 * the three buttons on the desk, the resolve action that does what they say,
 * and the write path that honours the pause.
 *
 * SABOTAGE (each turns this red):
 *   · drop "Remove and pause posting" from the admin row        → red
 *   · post 'hide' from the pause button                          → red
 *   · stop calling removeReportedArticlePost in resolveReport    → red
 *   · pass pause: true for 'hide'                                → red
 *   · stop checking the pause in gateWriter                      → red
 *   · read article_posting_pauses from anywhere outside Articles → red
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the desk shows Keep · Remove · Remove and pause posting on an Articles report', () => {
  const page = code('app/admin/user-reports/page.tsx');
  const block = page.slice(page.indexOf('data-article-moderation'), page.indexOf("!isArticleTarget(r.target_type) && ("));
  assert.ok(block.length > 100, 'the Articles moderation row is missing');
  const order = ['value="dismiss"', '> Keep', 'value="hide"', '> Remove', 'value="block"', '> Remove and pause posting'];
  let at = 0;
  for (const piece of order) {
    const i = block.indexOf(piece, at);
    assert.ok(i >= 0, `the Articles row must carry ${piece}, in order`);
    at = i;
  }
  // The team sees who posted (the reader never does).
  assert.match(page, /Posted by/);
  assert.match(page, /articleReportContext\(admin, rows\)/);
});

test('resolveReport removes the post, and pauses only on "Remove and pause posting"', () => {
  const act = code('app/admin/user-reports/actions.ts');
  assert.match(act, /\(action === 'hide' \|\| action === 'block'\) && isArticleTarget\(/);
  assert.match(act, /removeReportedArticlePost\([\s\S]{0,300}\{ pause: action === 'block'/);
  const mod = code('lib/articles-moderation.server.ts');
  assert.match(mod, /\.update\(\{ removed_at: new Date\(\)\.toISOString\(\), removed_by: moderatorUserId \}\)/);
  assert.match(mod, /if \(opts\.pause\)[\s\S]{0,120}from\('article_posting_pauses'\)\.upsert/);
});

test('a paused account cannot post — and a pause reaches nothing outside Articles', () => {
  const server = code('lib/articles.server.ts');
  const gate = server.slice(server.indexOf('async function gateWriter'), server.indexOf('async function eventTypeIsActive'));
  assert.match(gate, /isPausedFromArticles\(userId\)/);
  assert.match(gate, /if \(paused\) return \{ ok: false, error: 'paused' \}/);

  const allowed = new Set([
    'lib/articles.server.ts',
    'lib/articles-moderation.server.ts',
    // Data rights, not a gate: the subject's own RA 10173 export and erasure name the row; neither decides anything.
    'lib/personal-data-export.ts',
    'lib/export-completeness.ts',
    'lib/erasure/coverage.ts',
  ]);
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      if (f === 'node_modules' || f.startsWith('.')) continue;
      const abs = join(dir, f);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f)) {
        const rel = relative(WEB, abs);
        if (stripComments(readFileSync(abs, 'utf8')).includes("'article_posting_pauses'") && !allowed.has(rel)) offenders.push(rel);
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.deepEqual(offenders, [], 'a pause is Articles only — no other surface may read it');
});

test('a removed post keeps its place with the house-rules line', () => {
  const server = code('lib/articles.server.ts');
  assert.match(server, /ARTICLE_REMOVED_LINE = 'Removed by Setnayan — it broke the house rules\.'/);
  assert.match(server, /body: removed \? ARTICLE_REMOVED_LINE/);
  assert.match(server, /body: gone \? ARTICLE_REMOVED_LINE/);
});
