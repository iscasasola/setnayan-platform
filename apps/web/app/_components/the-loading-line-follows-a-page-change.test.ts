/**
 * THE TOP LOADING LINE ONLY STARTS FOR A NAVIGATION IT CAN SEE FINISH.
 *
 * Measured on the guest page (`/maria-and-jose`, 375 × 812, 2026-10-11): tap
 * Details, press the phone's Back. The page was drawn at once — and a gold line
 * grew across the top for 10–12 seconds (63 px at 0.5 s, 338 px at 8 s). The
 * line finishes when `usePathname()` changes; Back from `?tab=details` changes
 * only the query, so nothing ever finished it and its ten-second safety timer
 * did. The link-click door already refused same-path navigations; the
 * Back / Forward door started the line for every one.
 *
 * 🔑 THE PROPERTY, not the phrase: EVERY door that starts the line asks the one
 * rule first, and the rule starts it only when the pathname changes. A third
 * door added tomorrow fails this until it asks too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { navStartsTheLine } from '@/lib/nav-progress-rule';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'nav-progress.tsx'), 'utf8'));

test('the rule: only a change of pathname starts the line', () => {
  // The measured case and its neighbours: one page, its tabs, its marks.
  const page = '/maria-and-jose';
  for (const to of [page]) assert.equal(navStartsTheLine(page, to), false, 'a tab or a mark on the same page started the line');
  // Every pair of addresses a browser can hand us: the line starts exactly when the pathname differs.
  const paths = ['/', '/maria-and-jose', '/maria-and-jose/hub', '/maria-and-jose/find-seat', '/explore', '/dashboard/x/guests'];
  const tails = ['', '?tab=details', '?tab=home', '#site-details', '?tab=details#site-details'];
  let pairs = 0;
  for (const a of paths) for (const b of paths) for (const ta of tails) for (const tb of tails) {
    const from = new URL(a + ta, 'https://x.test');
    const to = new URL(b + tb, 'https://x.test');
    pairs++;
    assert.equal(navStartsTheLine(from.pathname, to.pathname), a !== b, `${a + ta} → ${b + tb}`);
  }
  assert.ok(pairs >= 900, `only ${pairs} pairs were tried`);
});

test('every door that starts the line asks the rule first', () => {
  // The listeners' own bodies (a named function declared inside the mount effect).
  const doors = [...SRC.matchAll(/function (on[A-Z]\w*)\([^)]*\) \{([\s\S]*?)\n    \}/g)].map((m) => ({ name: m[1]!, body: m[2]! }));
  const starting = doors.filter((d) => /\bbegin\(\)/.test(d.body));
  assert.deepEqual(starting.map((d) => d.name).sort(), ['onClick', 'onPopState'], 'the doors that start the line changed — read each one, then update this list');
  for (const d of starting) {
    const ask = d.body.search(/if \(!navStartsTheLine\(/);
    const start = d.body.search(/\bbegin\(\)/);
    assert.ok(ask >= 0 && ask < start, `${d.name} starts the line without asking navStartsTheLine first — a same-page Back or tab runs it for ten seconds`);
  }
  // Nothing outside those doors starts it.
  const calls = [...SRC.matchAll(/(?<!function )\bbegin\(\)/g)].length;
  assert.equal(calls, starting.length, `begin() is called ${calls} times but only ${starting.length} doors are checked`);
  // Back is measured from the page that is still on screen, not from the address that already moved.
  assert.match(SRC, /navStartsTheLine\(last\.current, window\.location\.pathname\)/);
  assert.match(SRC, /last\.current = pathname/);
});
