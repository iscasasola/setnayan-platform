/**
 * CLEAN AND SAFE (a) — nothing a guest or supplier shoots reaches ANOTHER person
 * (the couple's Memories, other guests, the wall, the couple's Drive, a public
 * teaser) before the safety screen has passed it. The shooter sees their own
 * shot at once, from the bytes on their own phone.
 *
 * Owner relay 2026-10-23. Held at every door a save-first shot passes:
 *   • record — the first piece is screened BEFORE the answer (not in after()),
 *     and a classifier outage leaves the row 'unscreened' = hidden;
 *   • attach — every later still (display copy, original) is screened BEFORE
 *     its key is written, and the bytes screened are the bytes kept;
 *   • attach waits for the record's own screen to have run;
 *   • Drive receives only a screened shot — the live hand-off AND "Release to
 *     Drive", which also skips a row still pointing at its thumbnail;
 *   • every other reader is held by every-papic-media-reader-is-screened.test.ts,
 *     which derives the reader list from the tree;
 *   • the couple-side readers allowlist 'clean' — 'unscreened' is unseen, not
 *     safe (they used to let it through with `!== 'nsfw_blocked'`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd().endsWith('/apps/web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const GUEST = 'app/api/papic/guest-capture/route.ts';
const VENDOR = 'app/api/vendor/papic-capture/route.ts';

function between(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  assert.ok(a > -1, `landmark "${from}" moved — re-point this guard`);
  const b = src.indexOf(to, a + from.length);
  assert.ok(b > -1, `landmark "${to}" moved — re-point this guard`);
  return src.slice(a, b);
}

function inOrder(src: string, marks: string[], what: string): void {
  let at = -1;
  for (const m of marks) {
    const i = src.indexOf(m, at + 1);
    assert.ok(i > at, `${what}: "${m}" must come after the step before it`);
    at = i;
  }
}

test('guest record: the first piece is screened before the answer, not after it', () => {
  const rec = between(read(GUEST), 'async function handleRecord(', 'async function afterVisible(');
  const screen = rec.indexOf("await screenCapture({ table: 'papic_guest_captures', r2ObjectKey: r2Ref })");
  // The LAST after() in the record is the one that runs the post-record work.
  const later = rec.lastIndexOf('after(async () => {');
  assert.ok(screen > -1, 'the record no longer awaits the screen');
  assert.ok(screen < later, 'the screen moved into after() — the answer would go out first');
});

test('guest attach: screen → promote → write, and it waits for the record’s screen', () => {
  const att = between(read(GUEST), 'async function handleAttach(', 'export async function POST(');
  inOrder(att, ["prior.moderation_state === 'unscreened'", "'screen_unavailable'", 'screenTierBytes(', 'promoteAll(', '.update(patch)'], 'guest attach');
});

test('supplier record + attach hold the same order', () => {
  const src = read(VENDOR);
  const rec = between(src, "if (op === 'record')", "if (op === 'attach')");
  assert.match(rec, /await writeVerdict\(/, 'the supplier record must screen before answering');
  assert.ok(rec.indexOf('await writeVerdict(') < rec.indexOf('after(async () => {'));
  const att = src.slice(src.indexOf("if (op === 'attach')"));
  inOrder(att, ["'screen_unavailable'", 'screenTierBytes(', 'promoteAll(', '.update(patch)'], 'supplier attach');
});

test('Drive receives only a screened shot', () => {
  const g = between(read(GUEST), 'async function handOffToDrive(', 'enqueueDriveCopy(');
  assert.match(g, /moderation_state !== 'clean'\) return;/);
  const v = between(read(VENDOR), 'async function handOffToDrive(', 'enqueueDriveCopy(');
  assert.match(v, /nsfw_checked !== true \|\| r\.hidden_at\) return;/);
});

test('"Release to Drive" sends only screened shots, and never a row still pointing at its thumbnail', () => {
  const rel = read('lib/photo-delivery-release.ts');
  const listing = between(rel, "const [seatRes, guestRes] = await Promise.all([", ']);');
  assert.equal((listing.match(/\.eq\('moderation_state', 'clean'\)/g) ?? []).length, 2, 'a release leg is unscreened');
  assert.match(rel, /\.filter\(\(p\) => !pointsAtAPreview\(p\.r2_object_key, \[p\.thumb_r2_key\]\)\)/);
  assert.match(rel, /\.filter\(\(p\) => !pointsAtAPreview\(p\.r2_object_key, \[p\.thumb_r2_key, p\.tile_r2_key\]\)\)/);
  const fn = between(rel, 'function pointsAtAPreview(', 'export async function enqueueRelease(');
  assert.match(fn, /if \(typeof key !== 'string' \|\| !key\) return true;/, 'a row with no key is not deliverable');
});

test('the couple-side readers show only what the screen PASSED', () => {
  const gallery = read('lib/papic-gallery.ts');
  assert.doesNotMatch(gallery, /moderation_state !== 'nsfw_blocked'/, 'host Memories lets "unscreened" through again');
  assert.equal((gallery.match(/r\.moderation_state === 'clean'/g) ?? []).length, 2, 'seat + guest legs');
  const teaser = gallery.slice(gallery.indexOf('export async function fetchTeaserFrames'));
  assert.equal((teaser.slice(0, 1600).match(/\.eq\('moderation_state', 'clean'\)/g) ?? []).length, 2, 'a public teaser leg is unscreened');
  const albums = read('app/dashboard/(account)/library/_data/photos-albums.ts');
  assert.doesNotMatch(albums, /moderation_state !== 'nsfw_blocked'/);
  for (const f of [
    'app/dashboard/[eventId]/studio/papic/gallery-zip/route.ts',
    'app/dashboard/[eventId]/studio/papic/save-photo/route.ts',
  ]) {
    assert.doesNotMatch(read(f), /\.neq\('moderation_state', 'nsfw_blocked'\)/, `${f} hands out unscreened shots`);
  }
});
