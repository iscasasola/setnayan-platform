/**
 * the-film-wears-the-main-background.test.ts — LOOK RESTUDY ROW 6.
 *
 * Owner-approved 2026-10-08 (DECISION_LOG "APPROVED — THE LOOK RESTUDY"; BACKGROUND_RESTUDY_2026-10-08_fable.md § 4,
 * § 6 row 6): *"Save the date should adapt to the main background as well. we stay 1 design for all."* The Save the
 * Date film keeps no background of its own: it wears the main background's picture (or the page colour), and only
 * the couple's Readability is still the film's. Held here:
 *   1. the pure answer (`stdFilmOnMain`);
 *   2. ONE resolution — the film's still comes from the same picture resolver as the page's layer (`pictureOf`);
 *   3. the guest page hands the film THAT, and the loader no longer resolves a film background of its own;
 *   4. nothing can store a film background again (the studio's action and its picker);
 *   5. the migration moves what was stored, for the closed list of scenes the code knows — no drift.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PLAIN_COLOR, STD_REALISTIC_IDS, stdFilmOnMain } from './std-backgrounds';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

test('1 · the film wears the picture, else the page colour — and keeps its Readability', () => {
  assert.deepEqual(stdFilmOnMain({ still: 'https://x/a.jpg', pageColour: '#112233', legibility: 'darken' }), {
    background: { kind: 'upload', value: 'main-background', legibility: 'darken' },
    imageUrl: 'https://x/a.jpg',
  });
  assert.deepEqual(stdFilmOnMain({ still: null, pageColour: '#112233', legibility: 'auto' }), {
    background: { kind: 'plain', value: '#112233', legibility: 'auto' },
    imageUrl: null,
  });
  // A colour this product never wrote is not painted — the film's own default instead.
  assert.equal(stdFilmOnMain({ still: null, pageColour: 'url(evil)', legibility: 'auto' }).background.value, DEFAULT_PLAIN_COLOR);
});

test('2 · ONE resolution: the film\'s still and the page\'s layer ask the same picture resolver', () => {
  const layer = read('app/[slug]/_lib/main-ground-layer.tsx');
  const of = layer.slice(layer.indexOf('async function mainGroundOf('), layer.indexOf('async function pictureOf('));
  const still = layer.slice(layer.indexOf('export async function mainGroundStillFor('));
  assert.match(of, /await pictureOf\(main, input, ownsPro\)/, 'the page\'s layer resolves its picture some other way');
  assert.match(still, /await pictureOf\(main, input, ownsPro\)/, 'the film resolves its picture some other way — two opinions of one background');
  // A colour, "just the colour" or a pattern is no picture: the film then wears the page colour.
  assert.match(still, /if \(mainGroundIsNone\(main\) \|\| \(main && 'ground' in main && main\.ground === 'pattern'\)\) return null;/);
});

test('3 · the guest page hands the film the main background; the loader resolves no film background of its own', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /const filmGround = stdFilm\s*\? stdFilmOnMain\(\{\s*still: await mainGroundStillFor\(\{/, 'the film is not handed the main background');
  assert.match(body, /background=\{filmGround\?\.background\}\s*backgroundImageUrl=\{filmGround\?\.imageUrl \?\? null\}/);
  assert.match(body, /legibility: stdFollowLegibility\(event\.std_background\)/, 'the couple\'s Readability is dropped');
  assert.doesNotMatch(body, /\bstdBackgroundUrl\b|\bstdBackground,/, 'a film background of its own reaches the page again');
  const loaders = read('app/[slug]/_lib/loaders.ts');
  assert.doesNotMatch(loaders, /stdFilmBackground|resolveStdBackground|stdBackgroundUrl/, 'the loader resolves a film background of its own again');
});

test('4 · nothing stores a film background of its own again', () => {
  const action = read('app/dashboard/[eventId]/studio/save-the-date/actions.ts');
  const writes = action.match(/patch\.std_background = [^;]+;/g) ?? [];
  assert.ok(writes.length >= 1, 'anti-vacuity: the action no longer writes the film value at all');
  for (const w of writes) assert.match(w, /^patch\.std_background = stdFollowTheme\(/, `the action stores something other than "follows": ${w}`);
  const client = read('app/dashboard/[eventId]/studio/save-the-date/_components/StdBuilderClient.tsx');
  assert.doesNotMatch(client, /StdBackgroundPicker|presignStdBackground|handleUpload/, 'the studio offers a film background again');
});

test('5 · the migration moves what was stored — for exactly the scenes the code knows', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_the_film_wears_the_main_background.sql'));
  assert.ok(file, 'the migration is gone');
  const sql = readFileSync(join(dir, file), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS std_background_retired JSONB/, 'no 30-day copy');
  assert.match(sql, /SET std_background_retired = std_background/);
  // The main wins: a picture is moved only where the hero has no main of its own.
  assert.equal((sql.match(/AND NOT \(COALESCE\(w\.config_json, '\{\}'::jsonb\) \? 'main'\)/g) ?? []).length, 2, 'a film picture can overwrite a chosen main background');
  const listed = /e\.std_background->>'value' IN \(([^)]*)\)/.exec(sql)?.[1] ?? '';
  const ids = [...listed.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(ids, [...STD_REALISTIC_IDS].sort(), 'the migration\'s scene list drifted from STD_REALISTIC_BACKGROUNDS');
  assert.match(sql, /LIKE 'r2:\/\/setnayan-media\/%'/, 'an upload outside the one public bucket would be moved');
  assert.match(sql, /RAISE EXCEPTION 'a Save the Date film still holds a background of its own'/, 'no post-condition');
  // The grant lint knows the copy is service-role only, on purpose.
  assert.match(read('scripts/lint-events-column-grants.mjs'), /'std_background_retired',/);
});
