/**
 * old-photo-copies.test.ts — the rules of "Make small copies of old photos" (owner 2026-10-23), and that the tool is
 * wired the way the owner asked: a dry-run count first, a press that writes, the original never deleted, prints on
 * the original. The database half is `tests/db/old-photo-copies.db.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { OVERSIZED_BYTES, formatBytes, isOversized, webCopyKey } from './old-photo-copies';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the copy sits beside the original, in the same folder, named as a copy', () => {
  assert.equal(webCopyKey('events/e1/std-background/abc-Prenup7.jpg'), 'events/e1/std-background/abc-Prenup7.web.jpg');
  assert.equal(webCopyKey('events/e1/scene-background/a.b.PNG'), 'events/e1/scene-background/a.b.web.jpg');
  assert.equal(webCopyKey('events/e1/scene-background/noext'), 'events/e1/scene-background/noext.web.jpg');
});

test('oversized is a measured size over the line — an unknown size never is', () => {
  assert.equal(isOversized(4_320_000), true);
  assert.equal(isOversized(OVERSIZED_BYTES), false);
  assert.equal(isOversized(null), false);
  assert.equal(isOversized(Number.NaN), false);
  assert.equal(formatBytes(4_320_000), '4.3 MB');
  assert.equal(formatBytes(380_000), '380 KB');
});

test('the tool is a dry run until pressed, never deletes, and prints keep the original', () => {
  const server = code('lib/old-photo-copies.server.ts');
  assert.doesNotMatch(server, /DeleteObject|deleteObject|r2Delete/, 'the tool deletes an object');
  assert.match(server, /if \(copy\.byteLength >= original\.bytes\.byteLength\) \{\s*skipped\+\+;\s*continue;/, 'a copy that is not smaller is still pointed at');
  const page = code('app/admin/papic-storage/page.tsx');
  assert.match(page, /const oldPhotos = await listOldPhotos\(admin\)/, 'the page draws the dry run');
  assert.doesNotMatch(page, /makeSmallCopies\(/, 'opening the page writes');
  const action = code('app/admin/papic-storage/old-photos-actions.ts');
  assert.match(action, /await requireAdminAction\(\);[\s\S]*makeSmallCopies\(createAdminClient\(\), userId\)/, 'the press is not behind the admin gate');
  const print = code('lib/print-set.server.ts');
  assert.match(print, /mode === 'print' \? await printOriginalMain\(admin, event\.event_id, await readHeroConfig\(admin, event\.event_id\)\)/, 'a print would print the small copy');
});
