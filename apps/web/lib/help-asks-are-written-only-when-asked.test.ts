/**
 * 🔒 A HELP ASK IS WRITTEN ONLY WHEN A PERSON ASKS — never on a page render, and never unbounded.
 *
 * Why (controller audit of #7614, 15 Nov 2026): /help called `logHelpAsk` inside `after()` on every
 * `GET /help?q=…` render. Any visitor, crawler or link prefetch inserted a `help_asks` row through the
 * service-role client, signed out and with no limit — a loop of GETs could fill the database (prod is on the
 * free plan). Now:
 *
 *   1. no page / layout / template file calls `logHelpAsk` — a render writes nothing;
 *   2. the only writers are the two helps' existing actions (`intent=ask` · `intent=answered`);
 *   3. `logHelpAsk` checks for a row with the same words + account + outcome in the last hour before inserting;
 *   4. both ask boxes POST to their help's action with `intent=ask`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : /\.(tsx?|mjs)$/.test(e.name) && !e.name.includes('.test.') ? [join(dir, e.name)] : [],
  );
const ROUTE_RENDER_FILE = /(^|\/)(page|layout|template|loading|default|not-found|error)\.(tsx?|jsx?)$/;
const CALLS_LOG = /\blogHelpAsk\b/;

test('1 · no page or layout writes a help ask — a render (crawler, prefetch, shared ?q= link) writes nothing', () => {
  // The matcher catches the shape it was written for (the after() call this guard replaced).
  assert.ok(CALLS_LOG.test("after(() => logHelpAsk({ words: q, coverage }))"), 'the matcher misses a real call');
  assert.ok(ROUTE_RENDER_FILE.test('app/(shell)/help/page.tsx') && ROUTE_RENDER_FILE.test('app/admin/layout.tsx'), 'the file matcher misses a page or layout');
  const renders = walk(join(WEB, 'app'))
    .map((f) => f.slice(WEB.length + 1))
    .filter((rel) => ROUTE_RENDER_FILE.test(rel));
  assert.ok(renders.length > 100, `only ${renders.length} page/layout files found — the walk is broken`);
  const offenders = renders.filter((rel) => CALLS_LOG.test(code(rel)));
  assert.deepEqual(offenders, [], `a page or layout writes help_asks on render: ${offenders.join(', ')}`);
});

test('2 · the only writers are the two helps’ own actions', () => {
  const writers = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]
    .map((f) => f.slice(WEB.length + 1))
    .filter((rel) => rel !== 'lib/help-asks.server.ts' && CALLS_LOG.test(code(rel)))
    .sort();
  assert.deepEqual(writers, ['app/admin/help/actions.ts', 'app/help/actions.ts']);
  const pub = code('app/help/actions.ts');
  assert.match(pub, /if \(formData\.get\('intent'\) === 'ask'\) return recordAsk\(formData\);/, 'the public ask does not ride the help action');
  const team = code('app/admin/help/actions.ts');
  // The team's ask sits AFTER the admin gate.
  assert.match(
    team,
    /export async function setHelpMessageStatus\(formData: FormData\) \{\s*const \{ userId \} = await requireAdmin\(\);\s*if \(formData\.get\('intent'\) === 'ask'\) return recordTeamAsk\(formData\);/,
    'the team ask is not behind requireAdmin on the admin help action',
  );
});

test('3 · one row per words + account + outcome per hour — checked before the insert', () => {
  const lib = code('lib/help-asks.server.ts');
  assert.match(lib, /export const ASK_BUCKET_MS = 60 \* 60 \* 1000;/);
  const fn = lib.slice(lib.indexOf('export async function logHelpAsk'), lib.indexOf('\n}\n', lib.indexOf('export async function logHelpAsk')));
  const check = fn.search(/\.eq\('words', words\)\s*\.eq\('coverage', row\.coverage\)\s*\.eq\('outcome', row\.outcome\)\s*\.gte\('created_at', since\)/);
  const insert = fn.indexOf('.insert(');
  assert.ok(check > 0, 'logHelpAsk has no bucket check (words + coverage + outcome since an hour ago)');
  assert.ok(insert > check, 'the bucket check does not come before the insert');
  assert.match(fn, /if \(\(seen \?\? \[\]\)\.length > 0\) return;/, 'a row already in the bucket does not stop the insert');
  assert.match(fn, /if \(seenError\) \{[^}]*return;\s*\}/, 'a failed bucket check still inserts');
});

test('4 · both ask boxes POST to their help’s action with intent=ask', () => {
  const box = code('app/_components/help-ask/ask-box.tsx');
  assert.match(box, /\{\.\.\.\(ask \? \{ action: ask\.action \} : \{ action, method: 'get' \}\)\}/, 'the ask box does not post when given an action');
  assert.match(box, /ask \? <input type="hidden" name="intent" value="ask" \/> : null/);
  assert.match(box, /ask \? <input type="hidden" name="coverage" value=\{ask\.coverage\} \/> : null/);
  assert.match(code('app/(shell)/help/page.tsx'), /<HowSearchField[^>]*\bask=\{\{ action: submitHelpMessage, coverage \}\}/, '/help: the ask box does not post to the help action');
  assert.match(code('app/admin/help/guides/page.tsx'), /<AskBox[^>]*\bask=\{\{ action: setHelpMessageStatus, coverage: 'team' \}\}/, 'team help: the ask box does not post to the admin help action');
});
