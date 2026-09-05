/**
 * A FLAG COMMENT IS NOT A PRODUCTION VALUE.
 *
 * `NEXT_PUBLIC_FIGURE_CHIBI` was set to "true" in Vercel Production on
 * 2026-08-31. For five days, THREE files kept asserting the opposite as fact —
 * "the only state production has ever been in", "production today",
 * "production's only state so far" — while one (kit/chibi-figure.tsx) recorded
 * the flip. A session reading any of the three would have reasoned from a dead
 * feature: no maker, no avatar_config writes, an unchanged room. All false.
 *
 * This guard cannot read Vercel. What it CAN do is refuse the sentence shape
 * that rots: a comment stating what production's flag value IS. The env is the
 * only honest source; a comment may say what the DEFAULT is, and may record a
 * dated observation, but may not present a production state as standing fact.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const FILES = [
  'lib/venue-avatars.ts',
  'app/[slug]/venue/page.tsx',
  'app/[slug]/avatar/page.tsx',
  'app/_components/plan3d/kit/chibi-figure.tsx',
  'lib/chibi-config.ts',
];

/** The exact rotted phrasings, plus the shape that produces them. */
const STANDING_CLAIMS = [
  /the only state production has ever been in/i,
  /production'?s only state so far/i,
  /unset \(production today\)/i,
  /\bunset\b[^\n]{0,40}\bproduction today\b/i,
];

test('no file states the chibi flag\'s production value as a standing fact', () => {
  const hits: string[] = [];
  for (const rel of FILES) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    for (const re of STANDING_CLAIMS) {
      // A dated correction quoting the old sentence is allowed: it must sit on a
      // line that also says it is false/used to say so.
      for (const line of src.split('\n')) {
        if (re.test(line) && !/(used to (say|add)|FALSE|false since|no longer)/i.test(line)) {
          hits.push(`${rel}: ${line.trim()}`);
        }
      }
    }
  }
  assert.deepEqual(hits, [], 'a comment asserts what production\'s flag value is — read the env instead');
});

test('the three corrected files carry the dated correction, not silence', () => {
  for (const rel of FILES.slice(0, 3)) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    assert.ok(/2026-08-31/.test(src) && /FALSE|false since/i.test(src), `${rel} must say when it became false, so the next reader does not re-derive it`);
  }
});
