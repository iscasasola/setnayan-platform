/**
 * THE 7-DAY GUEST NOTICE + A TAKEDOWN REACHES THE SUPPLIER'S PAGE COPY — what must never break, outside SQL.
 *
 * Owner rulings (corpus DECISION_LOG.md): 2026-10-03 "A SUPPLIER'S OWN PAPIC PHOTOS GO ON ITS PORTFOLIO AUTOMATICALLY
 * AFTER A 7-DAY GUEST NOTICE" + "CHALLENGE PHOTOS …" (2) · 2026-10-28 "OWNER: Agree to all" (1) and (3, in-app only).
 * The window, the publish and the takedown pull are proven in SQL by
 * `tests/db/a-suppliers-guest-photo-waits-seven-days.db.test.ts`; this file holds the words, the states, and the
 * places an event-album photo could escape the notice (a re-save, a service card, the shop-photo picker).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  groupGuestNotices,
  guestNoticeLine,
  guestPhotoWhen,
  putOnPageQueuedText,
  supplierPageNoticeState,
  supplierTileLabel,
  SUPPLIER_PAGE_NOTICE_DAYS,
} from './supplier-page-notice';
import { isFromAlbumPageRef, keepOnlyNoticedAlbumRefs, withoutAlbumRefs } from './put-photo-on-my-page';
import { planCleanupDelete, supplierPageAlbumCopyScope } from './cleanup-delete-scope';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SHOP = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ALBUM_REF = `r2://setnayan-media/vendors/${SHOP}/portfolio/from-album/evt-p1.jpg`;
const OWN_REF = `r2://setnayan-media/vendors/${SHOP}/portfolio/upload-1.jpg`;

test('1 · seven days, and a notice’s state: a removal wins, a publish is a fact', () => {
  assert.equal(SUPPLIER_PAGE_NOTICE_DAYS, 7);
  const base = { notice_id: 'n', public_from: '2026-11-04T00:00:00Z', published_at: null, removed_at: null, removed_by: null };
  assert.equal(supplierPageNoticeState(base), 'waiting');
  assert.equal(supplierPageNoticeState({ ...base, published_at: '2026-11-04T01:00:00Z' }), 'on_page');
  assert.equal(supplierPageNoticeState({ ...base, published_at: 'x', removed_at: 'y', removed_by: 'guest' }), 'removed_by_guest');
  assert.equal(supplierPageNoticeState({ ...base, removed_at: 'y', removed_by: 'takedown' }), 'taken_down');
  // A date in the past is NOT "on the page" — only the publish stamp says that.
  assert.equal(supplierPageNoticeState({ ...base, public_from: '2020-01-01T00:00:00Z' }), 'waiting');
});

test('2 · the supplier is told it is not public yet, and when it will be', () => {
  assert.equal(putOnPageQueuedText('2026-11-04T02:00:00Z'), 'Goes on your page Nov 4 — the guests are told first');
  assert.equal(supplierTileLabel('waiting', '2026-11-04T02:00:00Z'), 'Goes up Nov 4');
  assert.equal(supplierTileLabel('on_page', ''), 'On your page');
  assert.equal(supplierTileLabel('removed_by_guest', ''), 'A guest asked to keep it off');
});

test('3 · the guest’s one quiet line per supplier — the ruled words, counted from what is shown', () => {
  const g = {
    key: 'v1',
    supplierName: 'Lumen Studio',
    photos: [
      { noticeId: 'a', photoId: 'pa', url: null, onPage: false, publicFrom: '2026-11-04T02:00:00Z' },
      { noticeId: 'b', photoId: 'pb', url: null, onPage: true, publicFrom: '2026-11-01T02:00:00Z' },
    ],
  };
  assert.equal(guestNoticeLine(g), 'Lumen Studio will show 2 photos from this event on their page');
  assert.equal(guestNoticeLine({ ...g, photos: [g.photos[1]!] }), 'Lumen Studio shows a photo from this event on their page');
  assert.equal(guestNoticeLine({ ...g, supplierName: '  ' }), 'A supplier will show 2 photos from this event on their page');
  assert.equal(guestPhotoWhen(g.photos[0]!), 'Goes up Nov 4');
  assert.equal(guestPhotoWhen(g.photos[1]!), 'On their page');
  // No word the house rules retired.
  assert.doesNotMatch(guestNoticeLine(g), /vendor|celebration|website/i);
});

test('4 · grouping: removed notices leave the list; published ones stay (Remove keeps working after)', () => {
  const rows = [
    { notice_id: '1', photo_id: 'p1', vendor_profile_id: 'v1', public_from: 'x', published_at: null, removed_at: null, supplier_name: 'One', url: 'u1' },
    { notice_id: '2', photo_id: 'p2', vendor_profile_id: 'v1', public_from: 'x', published_at: 'y', removed_at: null, supplier_name: 'One', url: 'u2' },
    { notice_id: '3', photo_id: 'p3', vendor_profile_id: 'v1', public_from: 'x', published_at: null, removed_at: 'z', supplier_name: 'One', url: 'u3' },
    { notice_id: '4', photo_id: 'p4', vendor_profile_id: 'v2', public_from: 'x', published_at: null, removed_at: null, supplier_name: null, url: null },
  ];
  const g = groupGuestNotices(rows);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0]!.photos.map((p) => p.noticeId), ['1', '2']);
  assert.equal(g[0]!.photos[1]!.onPage, true);
  assert.equal(g[1]!.supplierName, 'A supplier');
  assert.equal(g[0]!.key, 'v1', 'the group key is not the supplier — a Remove would remount and close the open list');
  // Walk finding 2026-10-28: keyed on the FIRST photo, removing it remounted the group and closed "See them".
  assert.match(src('app/[slug]/_components/supplier-page-notice-line.tsx'), /key=\{g\.key\}/);
});

test('5 · an event-album photo cannot be ADDED to the page by a save, nor put on a service card', () => {
  assert.equal(isFromAlbumPageRef(ALBUM_REF), true);
  assert.equal(isFromAlbumPageRef(OWN_REF), false);
  assert.equal(isFromAlbumPageRef('https://example.com/vendors/x/portfolio/from-album/y.jpg'), false);
  // Kept when the page already carries it (it got there through the notice); dropped when a save tries to add it.
  assert.deepEqual(keepOnlyNoticedAlbumRefs([OWN_REF, ALBUM_REF], [ALBUM_REF]), [OWN_REF, ALBUM_REF]);
  assert.deepEqual(keepOnlyNoticedAlbumRefs([OWN_REF, ALBUM_REF], [OWN_REF]), [OWN_REF], 'a save put an album photo straight on the page');
  assert.deepEqual(withoutAlbumRefs([OWN_REF, ALBUM_REF]), [OWN_REF]);

  const save = src('app/vendor-dashboard/actions.ts');
  const noticed = save.indexOf('keepOnlyNoticedAlbumRefs(parsed, tr?.portfolio_r2_keys ?? [])');
  assert.ok(noticed > 0, 'the gallery save no longer drops a newly added album photo');
  assert.ok(noticed < save.indexOf('capPortfolioRefs(noticed,'), 'the album filter runs after the cap (or not on its input)');
  const cards = src('app/vendor-dashboard/services/actions.ts');
  assert.match(cards, /withoutAlbumRefs\(\[raw\.trim\(\)\]\)/, 'a card cover can carry an event-album photo');
  assert.match(cards, /const showcase_photo_r2_keys = withoutAlbumRefs\(/, 'a card showcase can carry an event-album photo');
  // The shop-photo picker (inspiration library, another couple's board) never offers one.
  assert.match(src('lib/shop-own-photos.server.ts'), /if \(isFromAlbumPageRef\(ref\)\) return;/, 'an event-album photo can travel on from the page');
});

test('6 · a takedown reaches the page copy’s FILE; the guest’s Remove is gated by the guest’s own session first', () => {
  const honour = src('app/admin/user-reports/actions.ts');
  assert.match(
    honour,
    /if \(hiddenIn === 'vendor_papic_portfolio_photos'\) \{\s*await deletePageCopyAfterTakedown\(admin, report\.target_id as string\);/,
    'an honoured takedown leaves the copied file behind',
  );
  const guest = src('app/[slug]/actions.ts');
  const fn = guest.slice(guest.indexOf('export async function askToTakeMyPhotoDown('));
  const gate = fn.indexOf('if (!session || session.event_id !== eventId)');
  const pull = fn.indexOf("rpc('remove_supplier_page_photo'");
  assert.ok(gate > 0, 'the takedown is not gated on the guest session');
  assert.ok(pull > 0, 'askToTakeMyPhotoDown cannot reach a supplier’s page copy');
  assert.ok(gate < pull, 'the Remove writes before it checks who is asking');
  assert.match(fn, /p_photo_id: sourceId, p_event_id: eventId/, 'the Remove is not bound to the event the cookie proved');
  assert.ok(pull < fn.indexOf(".from('user_reports')"), 'the page copy waits for a moderator — Remove must be immediate');
  assert.match(fn, /await deleteSupplierPageCopy\(row\.vendor_profile_id, row\.page_ref\);/, 'the copied file stays after a Remove');
  assert.match(guest, /sourceTable: 'papic_photos' \| 'papic_guest_captures' \| 'vendor_papic_portfolio_photos'/);
});

test('7 · the publish copies FIRST and asks SQL second; a refusal deletes the copy', () => {
  const s = src('lib/supplier-page-notice.server.ts');
  const body = s.slice(s.indexOf('export async function publishDueSupplierPagePhotos('));
  const copy = body.indexOf('await r2Copy(');
  const rpc = body.indexOf("rpc('publish_supplier_page_photo'");
  assert.ok(copy > 0 && rpc > copy, 'the ref can reach the page before the file exists');
  assert.match(body, /if \(ok === true\) published \+= 1;\s*else await deleteSupplierPageCopy\(n\.vendor_profile_id, n\.page_ref\);/, 'a refused publish leaves a copy behind');
  assert.match(s, /runClaimedJob\('supplier-page-photo-publish', SUPPLIER_PAGE_PUBLISH_GAP_MS,/);
  // Dual-mounted: it serves suppliers, so it must not wait on an admin opening the console.
  assert.match(src('app/vendor-dashboard/layout.tsx'), /after\(\(\) => maybeRunSupplierPagePublish\(\)\.catch\(\(\) => \{\}\)\);/);
  assert.match(src('app/admin/layout.tsx'), /after\(\(\) => maybeRunSupplierPagePublish\(\)\.catch\(\(\) => \{\}\)\);/);
});

test('8 · the guest sees the line in the Event Hub whenever a notice exists — not only on the day', () => {
  const body = src('app/[slug]/_components/site-body.tsx');
  assert.match(
    body,
    /\{supplierPageNotices && supplierPageNotices\.length > 0 \? \(\s*<SupplierPageNoticeLine eventId=\{event\.event_id\} groups=\{supplierPageNotices\} \/>/,
    'the notice line is not drawn',
  );
  const at = body.indexOf('<SupplierPageNoticeLine');
  const before = body.slice(Math.max(0, at - 160), at);
  assert.doesNotMatch(before, /isLive \|\| isPost \?/, 'the notice is gated on the day — a photo put up months later is never seen');
  const page = src('app/[slug]/page.tsx');
  assert.match(page, /await readGuestSupplierPageNotices\(event\.event_id\)/);
  const line = src('app/[slug]/_components/supplier-page-notice-line.tsx');
  assert.match(line, /return askToTakeMyPhotoDown\(eventId, 'vendor_papic_portfolio_photos', photoId, fd\);/);
  assert.match(line, /remove = removeFromSupplierPage,/, 'the Event Hub no longer defaults to the real takedown door');
  assert.doesNotMatch(src('app/[slug]/_components/site-body.tsx'), /<SupplierPageNoticeLine[^>]*remove=/, 'the Event Hub passes a stand-in Remove');
  assert.doesNotMatch(line, /router\.refresh|window\.location|redirect\(/, 'a Remove resets the screen');
});

test('9 · the page copy is deleted only inside THIS shop’s from-album folder', () => {
  const scope = supplierPageAlbumCopyScope(SHOP);
  assert.equal(planCleanupDelete(ALBUM_REF, scope).ok, true, 'the shop’s own page copy cannot be deleted');
  assert.equal(planCleanupDelete(OWN_REF, scope).ok, false, 'the cleanup can delete the shop’s own uploads');
  assert.equal(planCleanupDelete(ALBUM_REF.replace(SHOP, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), scope).ok, false, 'another shop’s copy');
  assert.equal(planCleanupDelete(ALBUM_REF, supplierPageAlbumCopyScope('../x')).ok, false, 'a traversal id widened the scope');
});
