/**
 * 📅 A DATE BUILT AS MANILA MIDNIGHT MUST BE FORMATTED IN MANILA (owner walk, 10 Nov 2026).
 *
 * Seen live: the Inquire sheet listed "Indalecio & Claire · Dec 17, 2026" for an event dated 18 Dec, and
 * "Maria & Jose · Dec 11" for 12 Dec. `new Date('2026-12-18T00:00:00+08:00')` is 17 Dec 16:00 UTC; formatted
 * on Vercel (UTC) without `timeZone`, it prints the DAY BEFORE — for every user, the browser's zone never enters.
 * The same shape sat in the shop's waitlist line, the supplier calendar and a supplier email.
 *
 * Guard: any `…T00:00:00+08:00`).toLocaleDateString('en-PH', {` must name `timeZone: 'Asia/Manila'` in that options object.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('the bug itself: Manila midnight formatted without a zone on a UTC server is the day before', () => {
  const d = new Date('2026-12-18T00:00:00+08:00');
  assert.equal(d.toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'short', day: 'numeric' }), 'Dec 17');
  assert.equal(d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }), 'Dec 18');
});

test('every Manila-midnight date names Asia/Manila when it is formatted', () => {
  const hits = execSync(
    "git grep -l -F 'T00:00:00+08:00`).toLocaleDateString(' -- 'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' ':!**/*.test.ts'",
    { encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean);
  assert.ok(hits.length > 0, 'the guard found nothing to check — its pattern is stale');
  const bad: string[] = [];
  for (const f of hits) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/T00:00:00\+08:00`\)\.toLocaleDateString\('en-PH', \{([^}]*)\}/g)) {
      if (!/timeZone:\s*'Asia\/Manila'/.test(m[1])) bad.push(f);
    }
  }
  assert.deepEqual(bad, [], 'formatted without timeZone: Asia/Manila — prints the day before on the server');
});
