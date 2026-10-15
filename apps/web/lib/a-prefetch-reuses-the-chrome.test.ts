/**
 * a-prefetch-reuses-the-chrome.test.ts — ⚡ A PREFETCH REUSES THE CHROME THE SAME PERSON JUST HAD; NOTHING CROSSES PEOPLE.
 *
 * Measured 2026-10-16 (production build, the owner's rows replayed): one visit of `/dashboard`
 * fired nine RSC prefetches, and each re-read the account chrome — the switcher and the rail's
 * account slot — for the person the page had just read it for. The rail also asked the auth
 * server who was looking a SECOND time per render (`auth.getUser()` beside `getCurrentUser()`).
 * Holds the rules in `lib/chrome-snapshot.ts` (decision: `lib/chrome-snapshot-core.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { __clearChromeSnapshots, chromeSnapshotWith as chromeSnapshot, SNAPSHOT_MS } from './chrome-snapshot-core';

let clock = 1_000_000;
const now = () => clock;
const yes = async () => true;
const no = async () => false;

function counter(tag: string) {
  let n = 0;
  return { load: async () => ({ tag, n: (n += 1), measured: true }), reads: () => n };
}

test('a page the person opens always reads fresh; a prefetch right after reuses it', async () => {
  __clearChromeSnapshots();
  const c = counter('a');
  await chromeSnapshot('switcher', 'user-a', c.load, undefined, now, no);
  await chromeSnapshot('switcher', 'user-a', c.load, undefined, now, no);
  assert.equal(c.reads(), 2, 'an opened page must never be served a snapshot');
  const pf = await chromeSnapshot('switcher', 'user-a', c.load, undefined, now, yes);
  assert.equal(c.reads(), 2, 'the prefetch read again instead of reusing');
  assert.equal(pf.n, 2, 'the prefetch got an older answer than the page it came from');
});

test("one person's chrome is never another's", async () => {
  __clearChromeSnapshots();
  const a = counter('a');
  const b = counter('b');
  await chromeSnapshot('switcher', 'user-a', a.load, undefined, now, no);
  const got = await chromeSnapshot('switcher', 'user-b', b.load, undefined, now, yes);
  assert.equal(got.tag, 'b');
  assert.equal(b.reads(), 1);
});

test('a snapshot older than the window is read again', async () => {
  __clearChromeSnapshots();
  const c = counter('a');
  await chromeSnapshot('rail-account', 'user-a', c.load, undefined, now, no);
  clock += SNAPSHOT_MS + 1;
  await chromeSnapshot('rail-account', 'user-a', c.load, undefined, now, yes);
  assert.equal(c.reads(), 2);
});

test('a failed or unmeasured answer is never replayed', async () => {
  __clearChromeSnapshots();
  let n = 0;
  const load = async () => ({ n: (n += 1), measured: n > 1 });
  const keep = (v: { measured: boolean }) => v.measured;
  await chromeSnapshot('switcher', 'user-a', load, keep, now, no); // unmeasured
  const pf = await chromeSnapshot('switcher', 'user-a', load, keep, now, yes);
  assert.equal(pf.n, 2, 'a prefetch was handed the unmeasured answer');
});

test('the switcher and the rail slot go through it, keyed by the verified user; the rail asks auth once', () => {
  const WEB = join(__dirname, '..');
  const sw = stripComments(readFileSync(join(WEB, 'app/_components/account-switcher/get-switcher-data.ts'), 'utf8'));
  assert.match(sw, /chromeSnapshot\('switcher', userId, \(\) => loadSwitcherData\(userId\), \(v\) => v\.eventsMeasured === true\)/);
  const rail = stripComments(readFileSync(join(WEB, 'app/_components/frontdoor/rail-data.ts'), 'utf8'));
  const fn = rail.slice(rail.indexOf('export async function resolveRailAccount('));
  assert.doesNotMatch(fn, /auth\.getUser\(\)/, 'the rail asks the auth server a second time per render');
  assert.match(fn, /const user = await getCurrentUser\(\);/);
  assert.match(fn, /chromeSnapshot\(\s*'rail-account',\s*user\.id,/);
});
