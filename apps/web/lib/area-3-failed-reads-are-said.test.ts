/**
 * area-3-failed-reads-are-said.test.ts — final check, area 3: failed reads that drew as real.
 *
 *   E-05 · the Maker's sections row ("0 showing"), the Story Maker's desk and chapters, Our photos (bounced to Home)
 *   E-16 · Stories about your day: a refused authors read drew "A Setnayan storyteller"
 *   L-08 · /live counts and mode, Live Watch's stats and YouTube grant, cameras / broadcast / print
 *   I-07 · the invite panel's waiting requests; the invitation print sheet (404 on a refused read, a blank sheet for none)
 *   S-05 · mood board, playlist, Setnayan AI briefing, guest columns
 *
 * CLAUDE.md §5 rule 4: a failed read never renders as zero, empty or success.
 * 🔒 Source assertions on the comment-stripped files; each fails when its fix is reverted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = process.cwd();
const D = 'app/dashboard/[eventId]';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('E-05 · the sections row is never "0 showing" on a refused read', () => {
  assert.match(read(`${D}/website/editor/page.tsx`), /if \(widgetsRawError\) return todo\('Couldn’t read'\);/);
});

test('E-05 · the Story Maker says when its desk or chapters could not load', () => {
  const src = read(`${D}/story/page.tsx`);
  assert.match(src, /desk = null;\s*deskReadFailed = true;/);
  assert.match(src, /chaptersReadFailed = true;/);
  assert.match(src, /\{deskReadFailed \? <ReadRefusedNotice /);
  assert.match(src, /\{chaptersReadFailed \? <ReadRefusedNotice /);
});

test('E-05 · Our photos throws on a refused event read instead of bouncing to Home', () => {
  assert.match(read(`${D}/website/our-photos/page.tsx`), /if \(eventReadError\) throw new Error\(/);
});

test('E-16 · a refused authors read is said on each story', () => {
  const src = read(`${D}/website/stories/page.tsx`);
  assert.match(src, /authorsUnread = true;/);
  assert.match(src, /: authorsUnread \? 'Couldn’t read who wrote this' :/);
});

test('L-08 · /live: refused counts draw "—"; an unread event row hides the mode picker and the Flash switch', () => {
  const src = read(`${D}/live/page.tsx`);
  assert.match(src, /value: visibleCountError \? '—' : String\(visibleCount \?\? 0\)/);
  assert.match(src, /value: hiddenCountError \? '—' : String\(hiddenCount \?\? 0\)/);
  assert.match(src, /\{eventError \? \(\s*<ReadRefusedNotice what="what Memory lane is showing" \/>/);
  assert.match(src, /\{eventError \? null : <FlashAutoWallToggle /);
});

test('L-08 · Live Watch: stats say "Couldn\'t read"; a refused grant read never offers Connect again', () => {
  const lib = read('lib/add-on-stats.ts');
  assert.match(lib, /readFailed: Boolean\(orderRes\.error \|\| totalRes\.error \|\| reviewRes\.error\),/);
  const src = read(`${D}/studio/live-studio-control/page.tsx`);
  assert.equal((src.match(/caption: stats\.readFailed\s*\? 'Couldn’t read'/g) ?? []).length, 2);
  assert.match(src, /\{grantUnread \? \(\s*<ReadRefusedNotice /);
});

test('L-08 · cameras, broadcast and print say a refused read', () => {
  assert.match(read(`${D}/studio/panood/cameras/page.tsx`), /\{camerasReadFailed \? \(\s*<ReadRefusedNotice what="your camera seats" \/>/);
  assert.match(read(`${D}/studio/panood/broadcast/page.tsx`), /\{camerasReadFailed \? <ReadRefusedNotice /);
  assert.match(read(`${D}/studio/panood/cameras/print/page.tsx`), /\{zoneRowsError \? \(/);
});

test('I-07 · the invite panel keeps the requests door on a refused count', () => {
  const src = read(`${D}/guests/invite/_components/share-link-panel.tsx`);
  assert.match(src, /const pendingUnread = Boolean\(pendingRes\.error\);/);
  assert.match(src, /\{pendingClaims > 0 \|\| pendingUnread \? \(/);
});

test('I-07 · the invitation print sheet: a refused read is an error, zero guests is said', () => {
  const src = read(`${D}/invitation/print/page.tsx`);
  assert.match(src, /if \(eventReadError\) throw new Error\(/);
  assert.match(src, /if \(guests\.length === 0\) \{\s*return \(/);
  assert.match(src, /title="No guests to print yet\."/);
});

test('S-05 · mood board, playlist, Setnayan AI and guest columns say a refused read', () => {
  assert.match(
    read(`${D}/studio/mood-board/_components/mood-board-editor.tsx`),
    /if \(inspirationRes\.error \|\| finalizationRes\.error\) \{[\s\S]{0,200}?return \{ ok: false as const \};/,
  );
  const playlist = read(`${D}/studio/playlist/page.tsx`);
  assert.match(playlist, /readEventSongRequests\(supabase, eventId\)/);
  assert.match(playlist, /\{flatRead\.failed \? <ReadRefusedNotice /);
  assert.match(playlist, /\{musicVendorRow\.error \? \(\s*<ReadRefusedNotice /);
  assert.match(
    read(`${D}/studio/setnayan-ai/_components/setnayan-ai-value.tsx`),
    /\{live && activity && !activity\.measured \? \(\s*<ReadRefusedNotice /,
  );
  assert.match(read(`${D}/studio/guest-columns/page.tsx`), /\{columnsError \? \(\s*<ReadRefusedNotice /);
});

test('L-08 (owner ruling, Add 45) · cameras: a failed plan read says so and provisions nothing against a guessed tier', async () => {
  const { PLAN_UNREAD } = await import('./plan-unread');
  assert.equal(PLAN_UNREAD, 'We couldn’t check your plan, try again.');
  const src = read(`${D}/studio/panood/cameras/page.tsx`);
  assert.equal((src.match(/planReadFailed = true;/g) ?? []).length, 2, 'both plan reads mark a failure');
  assert.match(src, /if \(!planReadFailed\) await provisionPanoodCamerasAdmin\(/);
  assert.match(src, /\{planReadFailed \? \(\s*<p role="status"[^>]*>\s*\{PLAN_UNREAD\}/);
});
