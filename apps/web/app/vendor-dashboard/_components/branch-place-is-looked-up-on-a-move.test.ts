/**
 * branch-place-is-looked-up-on-a-move.test.ts — the add-a-branch form asks
 * where the pin is only when the supplier MOVES it, and asks once per spot.
 *
 * QA 2026-10-22 (F9): `AddBranchForm` reverse-geocoded its opening centre in a
 * mount effect. The form mounts with the page, folded shut inside
 * <Collapsible>, so every open of Your details cost a server action and a
 * Nominatim call before anyone pressed "Add a branch".
 *
 * Properties held:
 *   1. No effect in branch-manager.tsx performs the lookup — not by calling the
 *      server action, the cache, or the form's own `detect` (an effect is what
 *      runs with no press). A lookup is reached only from the pin's onChange.
 *   2. Every lookup goes through the page-wide cache: one call per spot; a
 *      blank answer (a refused session) or a failure is not kept.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { makeBranchPlaceCache, branchSpotKey } from './branch-place-cache';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'branch-manager.tsx'), 'utf8'));

/** The body of every `useEffect(` / `useLayoutEffect(` call, by bracket matching. */
function effectBodies(src: string): string[] {
  const out: string[] = [];
  const re = /\buse(?:Layout)?Effect\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
    }
    out.push(src.slice(m.index, i));
  }
  return out;
}

const LOOKUPS = /\b(?:detect|detectBranchLocation|lookUpBranchPlace|reverseGeocode\w*)\s*\(/;

test('no effect looks up the place — the form asks nothing on mount (F9)', () => {
  const bodies = effectBodies(SRC);
  console.log(`[branch-place] ${bodies.length} effect(s) in branch-manager.tsx`);
  assert.ok(bodies.length >= 2, 'the effects moved — re-anchor this guard');
  const asking = bodies.filter((b) => LOOKUPS.test(b));
  assert.deepEqual(
    asking.map((b) => b.slice(0, 120)),
    [],
    'An effect in branch-manager.tsx looks up the branch place — it runs on every open of Your details, before anyone adds a branch',
  );
});

test('the lookup is reached from the pin moving, and only through the cache (F9)', () => {
  assert.match(SRC, /const onPinChange = \(v: LatLng\) => \{[^}]*\bdetect\(v\)/, 'moving the pin no longer looks up its city');
  assert.match(SRC, /<BranchPinMap[^>]*onChange=\{onPinChange\}/);
  // The server action is never called directly — only handed to the cache.
  const direct = SRC.match(/\bdetectBranchLocation\s*\(/g) ?? [];
  assert.equal(direct.length, 0, 'detectBranchLocation is called around the cache');
  assert.match(SRC, /lookUpBranchPlace\(v, detectBranchLocation\)/);
});

test('one call per spot; a blank or failed answer is asked again (F9)', async () => {
  let calls = 0;
  const answer = { city: 'Cebu City', address: 'Cebu City, Cebu' };
  const lookup = async () => {
    calls++;
    return answer;
  };
  const lookUp = makeBranchPlaceCache();
  const a = { lat: 10.31672, lng: 123.89071 };
  assert.deepEqual(await lookUp(a, lookup), answer);
  assert.deepEqual(await lookUp({ ...a }, lookup), answer);
  // A sub-metre wobble is the same spot.
  assert.equal(branchSpotKey(a), branchSpotKey({ lat: a.lat + 1e-7, lng: a.lng - 1e-7 }));
  await lookUp({ lat: a.lat + 1e-7, lng: a.lng }, lookup);
  assert.equal(calls, 1, 'the same spot was looked up twice');
  await lookUp({ lat: 14.5995, lng: 120.9842 }, lookup);
  assert.equal(calls, 2, 'a new spot was not looked up');

  // A refused session answers blank — not kept.
  let blanks = 0;
  const refused = async () => {
    blanks++;
    return { city: '', address: '' };
  };
  const b = { lat: 7.07, lng: 125.61 };
  await lookUp(b, refused);
  await Promise.resolve();
  await lookUp(b, refused);
  assert.equal(blanks, 2, 'a blank answer was cached — the city could never be found for that spot');

  // A failure — not kept.
  let fails = 0;
  const failing = async (): Promise<{ city: string; address: string }> => {
    fails++;
    throw new Error('offline');
  };
  const c = { lat: 16.41, lng: 120.59 };
  await assert.rejects(lookUp(c, failing));
  await assert.rejects(lookUp(c, failing));
  assert.equal(fails, 2, 'a failed lookup was cached');
});
