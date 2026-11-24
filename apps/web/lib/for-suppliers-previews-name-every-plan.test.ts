/**
 * 🔗 EVERY LINK PREVIEW NAMES EVERY PLAN (supplier re-walk of /for-suppliers on live, 24 Nov 2026; controller GO).
 *
 * Measured on live: og:description read "… Plus ₱… /mo · Pro ₱… /mo." while the title, the meta description and the
 * twitter description named Ultra too. The og line was built from a second, hand-picked list (`['solo', 'pro']`).
 * Now every description reads the ONE plan list, so a plan cannot drift out of one preview again.
 *
 * Fails if:
 *   · `tierPriceCopy` is called with any list other than the one `all`;
 *   · a description (meta · og · twitter) stops reading that list's line.
 *
 * SABOTAGE (seen red, restored): bring back `const perBlockTwo = tierPriceCopy(p, ['solo', 'pro'], …)` and use it in og.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = readFileSync(join(__dirname, '..', 'app/(shell)/for-suppliers/page.tsx'), 'utf8');
const meta = PAGE.slice(PAGE.indexOf('export async function generateMetadata'), PAGE.indexOf('const SITE_URL'));

test('one plan list, every plan', () => {
  assert.ok(meta.length > 200, 'anti-vacuity: generateMetadata moved');
  assert.match(meta, /const all = \['solo', 'pro', 'enterprise'\] as const;/);
  const calls = [...meta.matchAll(/tierPriceCopy\(p, ([^,)]+)/g)].map((m) => (m[1] ?? '').trim());
  assert.ok(calls.length >= 2, 'anti-vacuity: the descriptions no longer read tierPriceCopy');
  assert.deepEqual([...new Set(calls)], ['all'], `a description reads a second plan list: ${calls.join(' · ')}`);
});

test('meta, og and twitter each read the one list', () => {
  const og = meta.slice(meta.indexOf('openGraph:'), meta.indexOf('twitter:'));
  const tw = meta.slice(meta.indexOf('twitter:'));
  const top = meta.slice(0, meta.indexOf('openGraph:'));
  assert.match(top, /description: `[^`]*\$\{perBlock \?/, 'the meta description lost the plan line');
  assert.match(og, /description: `[^`]*\$\{perBlock \?/, 'og:description lost the plan line (or reads another)');
  assert.match(tw, /description: `[^`]*\$\{allLine \?/, 'the twitter description lost the plan line');
  assert.doesNotMatch(meta, /perBlockTwo/);
});
