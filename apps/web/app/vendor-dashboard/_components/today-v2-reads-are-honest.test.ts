/**
 * 🔒 TODAY v2'S READS ARE HONEST (the review hold on #7994, 19 Nov) — the wiring half of `lib/supplier-today-v2.test.ts`
 * R1–R4, in the style of `vendor-dashboard/reads-are-honest.test.ts`: a part that could not be READ may not be drawn as
 * an absence. The pure rules are tested there; this file holds the places a refused read could be flattened on its way
 * to them.
 *
 *   1 · unreadable fee bills reach the builder as `billsUnread` — never only as an empty list;
 *   2 · a refused Done-today read stays `null` all the way to a note on the list;
 *   3 · Done today counts every answer that leaves the list (payment declined · inquiry · meeting · cancel);
 *   4 · a refused cards read is `coversUnread`, and no Today v2 read at all is unread too;
 *   5 · the heading and the cover count the fee bills the same way — each bill is one task.
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-11-19): `billsUnread:` dropped from the page (red: 1) ·
 *   `doneUnread={doneCount === null}` → `false` (red: 2) · the `delete_answered_at` count removed (red: 3) ·
 *   `coversUnread: Boolean(services.error)` → `false` (red: 4) · `+ billCount` → `+ (billCount > 0 ? 1 : 0)` (red: 5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const PAGE = read('../page.tsx');
const BUILD = read('today-v2-assemble.tsx');
const SCREEN = read('today-v2.tsx');
const SERVER = read('../../../lib/supplier-today-v2.server.ts');

test('1 · unreadable fee bills block "done": the page says so to the builder, and the list says so to the supplier', () => {
  assert.match(PAGE, /billsUnread: feeBillsRead === FEE_BILLS_UNREADABLE,/, 'the page flattens unreadable fee bills into an empty list');
  assert.match(BUILD, /todayProgress\(left, doneCount, \{ billsUnread: i\.billsUnread \}\)/, 'the unread state never reaches allDone');
  assert.match(BUILD, /billsUnread=\{i\.billsUnread\}/);
  assert.match(SCREEN, /\{billsUnread \? <TodayNoteRow label=\{BILLS_UNREAD_LINE\}/, 'the list does not say the fees could not be loaded');
});

test('2 · a refused Done-today read is a note on the list, not a silent zero', () => {
  assert.match(SERVER, /if \(bad\) \{[\s\S]{0,220}return null;/, 'a refused Done-today count is not returned as null');
  assert.match(BUILD, /const doneCount = doneTodayTotal\(r\?\.done \?\? null, gotIt\);/);
  assert.match(BUILD, /doneUnread=\{doneCount === null\}/, 'the unread state is not handed to the list');
  assert.match(SCREEN, /\{doneUnread \? <TodayNoteRow label=\{DONE_UNREAD_LINE\}/, 'the list does not say the count could not be loaded');
  assert.match(SCREEN, /const total = pips\?\.total \?\? 0;/, 'the pips are drawn off something other than the read counts');
});

test('3 · Done today counts every answer that leaves the list', () => {
  for (const col of ['deposit_acknowledged_at', 'deposit_declined_at', 'service_marked_complete_at', 'lock_agreed_at', 'lock_declined_at', 'delete_answered_at', 'accepted_at', 'declined_at', 'vendor_reply_at', 'answered_at'])
    assert.match(SERVER, new RegExp(`\\.gte\\('${col}', since\\)`), `an answer stamped by ${col} is not counted — M would shrink instead of done growing`);
  assert.match(SERVER, /\.from\('event_appointments'\)[\s\S]{0,260}\.neq\('status', 'proposed'\)\.gte\('updated_at', since\)/, 'an answered meeting time is not counted');
  // One refused count refuses the whole answer: `all` must hold every read made.
  const reads = SERVER.match(/const \[([^\]]+)\] = await Promise\.all\(\[\s*admin\.from\('vendor_reviews'\)/)?.[1]?.split(',').map((x) => x.trim()) ?? [];
  assert.ok(reads.length >= 11, `anti-vacuity: only ${reads.length} Done-today reads found`);
  const all = SERVER.match(/const all = \[([^\]]+)\];/)?.[1]?.split(',').map((x) => x.trim()) ?? [];
  assert.deepEqual(all, reads, 'a Done-today read is left out of the refusal check — its error would count as 0');
});

test('4 · a refused cards read is unread — and so is a missing Today v2 read', () => {
  assert.match(SERVER, /coversUnread: Boolean\(services\.error\),/, 'a refused cards read is not marked unread');
  assert.match(SERVER, /readCards\(supabase, admin, vendorProfileId\)\.catch\(\(\) => \(\{ noCover: null, coversUnread: true, trendingCard: null \}\)\)/, 'a thrown cards read reads as "no card without a cover"');
  assert.match(BUILD, /coversUnread: r \? r\.coversUnread : true,/, 'no Today v2 read at all is treated as every card having a cover');
});

test('5 · the heading and the cover count the fee bills the same way', () => {
  assert.match(BUILD, /const left = i\.deskIncomplete \? null : split\.quick\.length \+ split\.screen\.length \+ i\.view\.bills\.length;/);
  assert.match(BUILD, /billCount=\{i\.view\.bills\.length\}/);
  assert.match(SCREEN, /Opens a screen · \{split\.screen\.length \+ billCount\}/, 'the heading counts all the bills as one while the cover counts each');
  assert.doesNotMatch(SCREEN, /hasBills/, 'the one-for-all bill count is back');
});
