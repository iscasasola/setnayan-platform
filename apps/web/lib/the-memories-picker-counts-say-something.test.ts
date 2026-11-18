/**
 * 🔢 THE MEMORIES PICKER'S COUNTS SAY SOMETHING (walk W4/W5 18 Nov 2026, #7909 follow-up: "the Memories picker counts
 * render empty").
 *
 * The Memories ▾ picker lists Home's sections (with the numbers the tab row used to carry) and every event (its photo
 * count on the right). Two reads could fail and leave a row with NOTHING on its right — the same drawing as a row that
 * never has a number:
 *   · Home's own numbers (your events, the shop's cards) — a refused read was dropped (`typeof n !== 'number'`);
 *   · each event's photo count — a refused read became 0 (`count = 0` in the catch, and a refused table read was `[]`).
 * Now each row shows the real number, or "couldn’t count" — never a blank, never a 0 for a read that failed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { COULD_NOT_COUNT, countTrail } from './count-trail';
import { homeSegOptions } from './home-seg-options';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

test('a count trail: the number, or "couldn’t count" — no trail only when the row has no number by design', () => {
  assert.deepEqual(countTrail(12), { text: '12', tone: 'muted' });
  assert.deepEqual(countTrail(0), { text: '0', tone: 'muted' }, 'a measured zero is a real number');
  assert.equal(countTrail(null)?.text, COULD_NOT_COUNT);
  assert.equal(countTrail(Number.NaN)?.text, COULD_NOT_COUNT);
  assert.equal(countTrail(undefined), undefined);
});

test('Home’s sections in the picker: a refused read says "couldn’t count", a read number shows, a numberless section stays plain', () => {
  const opts = homeSegOptions(['events', 'people', 'shop', 'memories'], {
    counts: { people: 2 },
    hot: { people: 'asking' },
    unread: { events: true, shop: true },
  });
  const by = new Map(opts.map((o) => [o.key, o]));
  assert.equal(by.get('seg:events')?.trail?.text, COULD_NOT_COUNT, 'a refused events count renders empty');
  assert.equal(by.get('seg:shop')?.trail?.text, COULD_NOT_COUNT, 'a refused shop count renders empty');
  assert.equal(by.get('seg:people')?.dotNote, '2 asking');
  assert.equal(by.get('seg:memories')?.trail, undefined, 'Memories has no total by design — no invented number');
  // Read numbers are still drawn as before.
  assert.equal(homeSegOptions(['events'], { counts: { events: 3 }, hot: {} })[0]!.trail?.text, '3');
});

test('Home marks which of its numbers it could not read', () => {
  const src = read('app/dashboard/(launcher)/_components/home-profile.tsx');
  assert.match(src, /eventCount === null \? \{ events: true as const \}/, 'a refused events count is not marked unread');
  assert.match(src, /segs\.includes\('shop'\) && cardCount === null \? \{ shop: true as const \}/, 'a refused shop count is not marked unread');
  assert.match(src, /<HomeSegCountsProvider counts=\{counts\} hot=\{hot\} unread=\{unread\}>/);
});

test('each event’s photo count: a refused read is unmeasured, never 0 — and the row says so', () => {
  const data = read('app/dashboard/(account)/library/_data/photos-albums.ts');
  assert.match(data, /measured: !seatRes\.error && !guestRes\.error/, 'a refused photo read still counts as "no photos"');
  assert.match(data, /if \(memberError\) return \{ count: 0, refs: \[\], measured: false \};/);
  assert.match(data, /if \(!gallery\) return \{ count: 0, refs: \[\], measured: false \};/, 'the live gallery’s null (a failed read) counts as none');
  // The catch-all: one bad event is an album whose count is unmeasured.
  const catchAll = data.slice(data.indexOf('} catch {', data.indexOf('const loaded =')));
  assert.match(catchAll.slice(0, 300), /countMeasured = false;/, 'the per-event catch still leaves a 0 that reads as measured');
  const seg = read('app/dashboard/(account)/library/_components/memories-segment.tsx');
  assert.match(seg, /trail: countTrail\(a\.countMeasured \? a\.count : null\)/, 'the picker’s event rows do not say when they could not count');
  assert.doesNotMatch(seg, /trail: \{ text: formatCount\(a\.count\)/, 'the event row draws the raw count again');
});
