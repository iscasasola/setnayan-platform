/**
 * PUT THIS PHOTO ON MY PAGE (owner 2026-10-15, DECISION_LOG "SIX OWNER ANSWERS" (3)) — one tap from a photo in the
 * private album puts a COPY in the page gallery. What must never break:
 *   · the page key is inside THIS shop's own media folder (SEC-1 — the public page signs whatever the column holds);
 *   · only this shop's album lane is a source (a posted id can never pull a stranger's file onto the page);
 *   · the plan's photo cap holds and a second tap never makes a second copy;
 *   · the album photo is read with the shop's OWN client, taken-down / unscreened photos are refused, owners/admins only;
 *   · every album photo tile carries the one tap.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { parseClientRef, vendorOwnedMediaPolicy } from './r2-client-ref';
import { addToPageGallery, albumLaneOf, pagePhotoKeyFor } from './put-photo-on-my-page';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const MINE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const THEIRS = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

test('1 · the page copy lands in THIS shop’s own folder, and passes the gallery’s own tenancy pin', () => {
  const key = pagePhotoKeyFor(MINE, `${albumLaneOf(MINE)}evt-1/photo-9.jpg`);
  assert.equal(key, `vendors/${MINE}/portfolio/from-album/evt-1-photo-9.jpg`);
  assert.ok(parseClientRef(`r2://setnayan-media/${key}`, vendorOwnedMediaPolicy(MINE)), 'the page ref fails SEC-1');
  // The same photo always maps to the same page key — a second tap is "already", never a second copy.
  assert.equal(pagePhotoKeyFor(MINE, `${albumLaneOf(MINE)}evt-1/photo-9.jpg`), key);
});

test('2 · only this shop’s album lane is a source', () => {
  assert.equal(pagePhotoKeyFor(MINE, `${albumLaneOf(THEIRS)}evt/x.jpg`), null, 'another shop’s album photo was accepted');
  assert.equal(pagePhotoKeyFor(MINE, `vendors/${MINE}/verification/dti.pdf`), null);
  assert.equal(pagePhotoKeyFor(MINE, `${albumLaneOf(MINE)}../../vendors/${THEIRS}/x.jpg`), null, 'a .. path was accepted');
  assert.equal(pagePhotoKeyFor('', `papic/vendor-/portfolio/x.jpg`), null, 'an empty shop id allowed something');
});

test('3 · the plan’s photo cap holds; a second tap adds nothing', () => {
  assert.deepEqual(addToPageGallery(['a'], 'b', 10), { kind: 'added', refs: ['a', 'b'] });
  assert.deepEqual(addToPageGallery(['a', 'b'], 'b', 10), { kind: 'already' });
  assert.deepEqual(addToPageGallery(['a', 'b'], 'c', 2), { kind: 'full', max: 2 });
  assert.deepEqual(addToPageGallery(['a'], 'b', Infinity), { kind: 'added', refs: ['a', 'b'] });
});

test('4 · the action: own client, own album row, refuses taken-down/unscreened, owners only, same pins as the gallery save', () => {
  const a = src('app/vendor-dashboard/collections/actions.ts');
  assert.match(a, /export async function putAlbumPhotoOnMyPage\(/);
  assert.doesNotMatch(a, /createAdminClient/, 'the album is read past its RLS');
  assert.match(a, /\.from\('vendor_papic_portfolio_photos'\)[\s\S]{0,200}\.eq\('vendor_profile_id', vendorId\)/, 'the album read is not pinned to this shop');
  assert.match(a, /if \(photo\.hidden_at \|\| photo\.nsfw_checked !== true\) return \{ ok: false/, 'a taken-down or unscreened photo can go on the page');
  assert.match(a, /if \(!canManageVendor\(role\)\) return \{ ok: false/, 'a helper can change the page');
  assert.match(a, /pagePhotoKeyFor\(vendorId, albumKey\)/);
  assert.match(a, /parseClientRef\(pageRef, vendorOwnedMediaPolicy\(vendorId\)\)/, 'the SEC-1 pin is missing');
  assert.match(a, /addToPageGallery\(row\.portfolio_r2_keys \?\? \[\], pageRef, max\)/, 'the plan cap is not asked');
  assert.match(a, /vendorQrGuardRejects\(\[pageRef\]\)/, 'the QR guard is skipped');
  assert.match(a, /\.update\(\{ portfolio_r2_keys: next\.refs \}\)/);
  // The copy happens BEFORE the column names it — the page never points at a file that is not there.
  assert.ok(a.indexOf('r2Copy(') < a.indexOf('portfolio_r2_keys: next.refs'), 'the column is written before the copy');
});

test('5 · every album photo tile carries the one tap', () => {
  const s = src('app/vendor-dashboard/on-the-day/live/[eventId]/_components/portfolio-album-section.tsx');
  assert.match(s, /tiles\.map\(\(\{ photo, url \}\) => \([\s\S]{0,900}<PutOnMyPageButton photoId=\{photo\.photoId\} \/>/, 'a photo has no "Put on my page"');
  const b = src('app/vendor-dashboard/collections/_components/put-on-my-page-button.tsx');
  assert.match(b, /useActionState<[^>]*>\(putAlbumPhotoOnMyPage, null\)/);
  assert.match(b, /name="photo_id" value=\{photoId\}/);
});
