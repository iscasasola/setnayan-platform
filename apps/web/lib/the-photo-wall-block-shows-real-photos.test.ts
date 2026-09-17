/**
 * the-photo-wall-block-shows-real-photos.test.ts — DAY-32g.
 *
 * The recap's "Live Photo Wall" read `events.photo_wall_photos` — a `jsonb` column
 * with **no writer anywhere in the application**. Every occurrence in the tree was a
 * read, a column-grant list, a media sweep, a migration or a comment. It defaults to
 * `'[]'::jsonb`, so the block's own gate was permanently false and the section was
 * dark for every couple who had ever paid for LIVE_WALL.
 *
 * 🔑 AND THE OBVIOUS FIX WAS THE WRONG ONE. An absent writer reads as "somebody
 * forgot to build the writer". The capability was two files away under a different
 * noun: `getWallSnapshot` is the same screened feed the venue projector and the
 * day-of guest wall already render. Writing a second store for "the day's candid
 * photos" would have manufactured a rival source of truth for one fact, and the two
 * would disagree the first time either was fixed.
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────────
 * Everything here is PARSED: `data.ts` is a `server-only` resolver a unit test
 * cannot import, and the read it makes needs a database. So the guard asserts the
 * three properties that can be read off the source, and says plainly that it does
 * not prove a photograph reached a page.
 *
 *   1. the resolver asks `getWallSnapshot`;
 *   2. it does NOT read `photo_wall_photos` as the wall's source again — the
 *      standing temptation, because the column is still in the select;
 *   3. **nothing in the app writes that column.** This is the load-bearing one: it
 *      fails the day somebody "fixes" the dead column instead of the dead read, and
 *      that is the mistake this row exists to prevent.
 *
 * 🛡 Sabotage-checked, each mutation still parsing, counts printed before verdicts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const data = stripComments(
  readFileSync(join(WEB, 'app', '[slug]', '_components', 'editorial', 'data.ts'), 'utf8'),
);

test('the recap wall reads the live feed, gated by the paid SKU', () => {
  const calls = data.match(/getWallSnapshot\(/g)?.length ?? 0;
  console.log(`  getWallSnapshot( calls in the resolver: ${calls}`);
  assert.equal(calls, 1, 'the recap wall no longer reads the live feed');

  /*
   * THE PAID GATE IS STILL THERE — IT MOVED ONE HOP, AND THIS ASSERTS IT ACROSS
   * THE HOP RATHER THAN BY SPELLING.
   *
   * This test first demanded the literal `eventSkuActive(… 'LIVE_WALL')` in the
   * resolver. That is the implementation, not the property — and asking only
   * about ownership was itself the defect: `live-wall-guest-mirror.test.ts`
   * derives the guest wall surfaces by sweeping for `getWallSnapshot(`, so
   * pointing the recap at the feed MADE IT ONE, and every guest wall surface
   * must gate on the couple's choice, not just their receipt. A couple who had
   * switched the guest mirror off would have had the recap publish the wall.
   *
   * `guestWallMirrorActive` is strictly STRONGER: its own first half is
   * `eventSkuActive(client, eventId, 'LIVE_WALL')`, so the purchase is still
   * required, and it additionally requires Papic active, the couple's
   * visibility choice, and not-archived. So the property — no wall without the
   * purchase — is proven here in two steps: the resolver delegates, and the
   * helper still asks. Asserting the literal in the resolver would now FORBID
   * the correct code.
   */
  assert.match(
    data,
    /guestWallMirrorActive\(/,
    'the recap wall no longer gates on the couple’s choice',
  );

  // Step two: the delegate must still require the purchase. Windowed to the
  // helper's own body, so a LIVE_WALL check belonging to some other function in
  // the module cannot satisfy this.
  const wallLib = readFileSync(join(WEB, 'lib', 'live-wall.ts'), 'utf8');
  const at = wallLib.indexOf('export async function guestWallMirrorActive');
  assert.ok(at > 0, 'guestWallMirrorActive has moved — re-point this assertion');
  const body = wallLib.slice(at, at + 1200);
  console.log(`  guestWallMirrorActive body window: ${body.length} chars`);
  assert.match(
    body,
    /eventSkuActive\([^)]*'LIVE_WALL'\)/,
    'guestWallMirrorActive stopped requiring the LIVE_WALL purchase — the recap ' +
      'now delegates to a gate that no longer asks, so nothing requires it',
  );
  // And the feed is only asked for once the SKU is owned — never the other way
  // round, which would presign tiles for a couple who never bought the wall.
  assert.match(
    data,
    /if \(photoWallActive\) \{[\s\S]{0,400}?getWallSnapshot\(/,
    'the feed is read before the entitlement is known',
  );
});

test('the dead column is not the wall’s source again', () => {
  const asSource = data.match(/photo_wall_photos[\s\S]{0,80}?\.filter\(/g)?.length ?? 0;
  console.log(`  photo_wall_photos used as the wall's source: ${asSource}`);
  assert.equal(asSource, 0, 'the recap wall is reading the dead column again');
});

test('🔴 NOTHING in the app writes `photo_wall_photos` — do not fix the column', () => {
  /*
   * The standing temptation. An empty column with a reader looks like a missing
   * writer, and building one would give "the day's candid photos" a SECOND source
   * of truth beside `wall_visible_photos`. If this ever goes red, the question to
   * ask is not "who broke the test" but "which of the two stores is now the real
   * one" — and the answer must be the feed.
   */
  const roots = [join(WEB, 'lib'), join(WEB, 'app')];
  const writers: string[] = [];
  let scanned = 0;
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.next') continue;
        walk(full);
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        scanned++;
        // A write names the column as an object KEY: `photo_wall_photos:`.
        if (/photo_wall_photos\s*:/.test(stripComments(readFileSync(full, 'utf8')))) {
          writers.push(full.slice(WEB.length + 1));
        }
      }
    }
  };
  roots.forEach(walk);
  console.log(`  files scanned: ${scanned} · writers of photo_wall_photos: ${writers.length}`);
  assert.ok(scanned > 500, `floor: expected 500+ source files, walked ${scanned} — the walk broke`);
  assert.deepEqual(
    writers,
    [],
    `something now writes photo_wall_photos — that is a SECOND source of truth for the day's photos:\n  ${writers.join('\n  ')}`,
  );
});
