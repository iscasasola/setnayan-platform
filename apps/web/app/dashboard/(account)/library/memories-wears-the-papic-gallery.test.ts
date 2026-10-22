/**
 * memories-wears-the-papic-gallery.test.ts — owner 2026-10-22: *"Memories must look similar to the gallery of papic.
 * Somewhat but not exactly"*, and, of the counts line the prototype drew at the top ("14 frames · 2 clips · 3 with
 * you"), *"remove these"*. Contract: `prototypes/people_and_memories_template_2026-10-22.html` M1–M4 + its §5 map.
 *
 * Read from the CODE (comments stripped):
 *   1 · THE TOP IS THE LIFE-FLASH TILE — no counts line; the clip and with-you marks are ON the tiles; the foot line
 *       only explains a capped list.
 *   2 · EVERY EVENT KEEPS ITS PLACE — an empty event keeps its heading and its monogram tile (owner 2026-08-19).
 *   3 · NOTHING SHIPPED LOST ITS SEAT — every row of the §5 map is still reached.
 *   4 · A FAILED READ SAYS SO — a refused wall or events read never draws "nothing yet".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const HERE = __dirname;
const code = (rel: string) => {
  const src = readFileSync(join(HERE, rel), 'utf8');
  assert.ok(src.length > 400, `${rel} is missing or a stub`);
  return stripComments(src);
};
const CH = code('_components/memories-chapters.tsx');
const THUMB = code('_components/memories-thumb.tsx');
const PAGE = code('page.tsx');

const between = (src: string, a: string, b: string) => {
  const i = src.indexOf(a);
  assert.ok(i >= 0, `${a} is gone — re-anchor this guard`);
  const j = src.indexOf(b, i + a.length);
  return src.slice(i, j < 0 ? undefined : j);
};

// ── 1 · the top is the Life-Flash tile ──────────────────────────────────────

test('🔴 no counts line at the top — the page starts with the Life-Flash tile (owner: "remove these")', () => {
  const intro = between(CH, 'const intro = (', 'if (picked) {');
  const first = intro.indexOf('<');
  assert.ok(intro.slice(first).startsWith('<>\n') || intro.slice(first).startsWith('<>'), 'the intro is not a fragment');
  assert.ok(intro.indexOf('<LifeFlashTile') >= 0, 'the Life-Flash tile left the top');
  for (const counted of ['frames ·', '· clips', 'with you</']) {
    assert.ok(!CH.includes(counted) && !PAGE.includes(counted), `a counts line came back ("${counted}")`);
  }
  assert.ok(!/data-memories-counts/.test(CH + PAGE), 'a counts line block came back');
});

test('🔴 the clip and the with-you marks live on the tile itself', () => {
  const tile = between(CH, 'function Tile(', '\nfunction Heading(');
  assert.match(tile, /item\.withMe \? \([\s\S]{0,120}data-tile-with-me=""/, 'the gold you-are-in-it dot left the tile');
  assert.match(tile, /item\.isClip \? \([\s\S]{0,120}data-tile-clip=""/, 'the clip ▶ left the tile');
});

test('🔴 the foot line is drawn only where it explains a capped list', () => {
  const all = between(CH, 'const events = albumsForLens(albums, lens);', 'function MonogramTile(');
  assert.match(all, /\{more > 0 \? \(\s*<p[^>]*data-memories-capped=""/, 'the "showing the newest" line is drawn on an uncapped list');
  assert.match(CH, /const more = picked \? 0 : total - shown\.length;/);
  // One event is never capped, so it carries no foot line at all.
  const one = between(CH, 'if (picked) {', 'const events = albumsForLens(albums, lens);');
  assert.ok(!/frames?'? kept|frames kept/.test(one), 'the one-event view prints a foot line that explains nothing');
});

test('🔒 Life-Flash is quiet — and NOT pressable — until there is something to play (controller, question 3)', () => {
  const lf = between(CH, 'export function LifeFlashTile(', '\nexport function MemoriesUnreadable(');
  const quiet = between(lf, 'if (!hasFrames) {', '  return (\n    <Link');
  assert.ok(!/<Link|<a |href=/.test(quiet), 'the quiet Life-Flash row became a door to nothing');
  assert.match(lf, /href="\/dashboard\/life-flash"/, 'the Life-Flash door is gone');
});

// ── 2 · every event keeps its place ─────────────────────────────────────────

test('🔴 every event is a chapter — an empty one keeps its heading and its monogram tile', () => {
  const lensAlbums = between(CH, 'export function albumsForLens(', '\nexport async function MemoriesChapters(');
  assert.ok(!/count/.test(lensAlbums), 'events are filtered by their count — an empty event vanishes');
  const all = between(CH, 'const events = albumsForLens(albums, lens);', 'function MonogramTile(');
  assert.match(all, /events\.map\(\(album\) =>/);
  assert.match(all, /mine\.length > 0 \? mine\.map\(\(it\) => <Tile key=\{it\.key\} item=\{it\} \/>\) : <MonogramTile album=\{album\} unknown=\{wall\.unreadable\} \/>/);
  // …in the shelf's order: by the event date, undated last.
  assert.match(PAGE, /if \(da\) return -1;\s*if \(db\) return 1;/);
});

// ── 3 · nothing shipped lost its seat (the §5 map) ──────────────────────────

const SEATS: Array<[string, string, RegExp]> = [
  ['Life-Flash door (lifeStoryEnabled)', PAGE, /lifeFlash=\{lifeStoryEnabled\(\)\}/],
  ['The heading opens the event where the cover did (album.href)', CH, /href=\{album\.href\}/],
  ['Gallery › door on each event heading (hosts only — GalleryDoor)', CH, /door=\{<GalleryDoor event=\{album\.event\} \/>\}/],
  ['Show — the five lenses', PAGE, /\.\.\.LENSES\.map\(/],
  ['Show — "Also kept"', PAGE, /\.\.\.KEPT\.map\(\(\{ key, label \}\) => \(\{ key, label, group: 'Also kept'/],
  ['Show — every lens and "Also kept" — in the ≡ menu', THUMB, /\.\.\.show\.map\(\(o\) => \(\{\s*\.\.\.o,\s*key: `show:\$\{o\.key\}`/],
  ['The Event choice in the ≡ menu', THUMB, /\.\.\.\(events \?\? \[\]\)\.map\(\(o\) => \(\{ \.\.\.o, key: `event:\$\{o\.key\}`/],
  ['⤓ Download all in the ≡ menu, once a hosted event is picked', THUMB, /download \? \[\{ key: 'download', label: 'Download all'/],
  ['Per-event download (gallery-zip)', PAGE, /\/studio\/papic\/gallery-zip/],
  ['The People lens — faces and Open People', PAGE, /<AlaalaLensBody lens="people" wall=\{wall\}/],
  ['Albums by event', PAGE, /active === 'albums' \?[\s\S]{0,300}<PhotosTab userId=\{user\.id\} \/>/],
  ['Editorials', PAGE, /<EditorialsTab userId=\{user\.id\} \/>/],
  ['Saved suppliers', PAGE, /<VendorsTab userId=\{user\.id\} \/>/],
  ['A frame opens the studio (owned) or the photo (attended)', CH, /item\.role === 'couple'\) return \{ href: `\/dashboard\/\$\{item\.eventId\}\/studio\/papic`/],
  ['The day’s chapters come from the run of show', CH, /groupIntoChapters\(\{/],
];
for (const [what, src, re] of SEATS) {
  test(`🔒 still reachable: ${what}`, () => assert.match(src, re, `"${what}" lost its seat`));
}

test('🔴 THE ONE THUMB ROW (owner 2026-10-22): ≡ · "Search memories" — no band, no ＋ (nothing is added here)', () => {
  assert.match(THUMB, /from '\.\.\/\.\.\/_components\/account-thumb-row';/, 'Memories draws its own bottom row instead of the one row');
  assert.ok(!/gs\.lower|sn-glass-row/.test(THUMB), 'Memories brought back a band of its own');
  const row = between(THUMB, '<AccountThumbRow', '\n      />');
  assert.ok(row.includes('tools={') && row.includes('field={'), 'the row lost ≡ or the field');
  assert.ok(!row.includes('action={'), 'a ＋ appeared on Memories — nothing is added here');
  assert.ok(/<PickMenu\b/.test(row) && (row.match(/<PickMenu\b/g) ?? []).length === 1, '≡ is not ONE dropdown');
  const words = (THUMB.match(/placeholder="([^"]+)"/) ?? [])[1] ?? '';
  assert.equal(words, 'Search memories');
  // The field narrows what is on the page, by name — every chapter carries its name.
  assert.match(CH, /data-memories-filter-name=\{album\.event\.display_name\}/);
  assert.match(CH, /data-memories-filter-name=\{`\$\{picked\.event\.display_name\} \$\{c\.label\}`\}/);
});

// ── 4 · a failed read says so ───────────────────────────────────────────────

test('🔴 a refused wall says "could not be loaded" — never the empty line', () => {
  const intro = between(CH, 'const intro = (', 'if (picked) {');
  const refused = intro.indexOf('wall.unreadable ? (');
  const empty = intro.indexOf('lensEmptyLine(');
  assert.ok(refused >= 0 && empty > refused, 'the empty line can be drawn before the refusal is checked');
  assert.match(intro, /\{!albumsMeasured \? <MemoriesUnreadable what="events" \/> : null\}/, 'a refused events read is silent');
  // …and an event's heading over a refused wall gives no count and no "nothing yet" — it is not known.
  assert.match(CH, /: wall\.unreadable \? undefined : null\}/, 'an event says "nothing yet" over a refused wall read');
  assert.match(CH, /<MonogramTile album=\{album\} unknown=\{wall\.unreadable\} \/>/);
  // A refused run of show falls to time-of-day chapters, never a blank gallery.
  assert.match(CH, /catch \{[\s\S]{0,160}blocks = \[\];/);
});
