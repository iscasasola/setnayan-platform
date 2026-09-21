/**
 * The "never a dead door" rule (S6 brief), pinned per row. Each test failure
 * names the ruling so a later edit that reintroduces a dead door is caught
 * by its own message, not by a diff nobody reads closely.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEverythingElseRows, type EverythingElseInput } from './everything-else-rows';

const base: EverythingElseInput = {
  slug: 'maria-and-jose',
  viewerKind: 'guest',
  isLive: false,
  eventDateLabel: 'December 18, 2026',
  cameraFeatureOn: false,
  broadcastConfigured: false,
  venueWalkHref: null,
  keepsakeHref: null,
  recapBodyReady: false,
  recapHasPhotos: false,
  canShare: false,
};
const at = (o: Partial<EverythingElseInput>) => resolveEverythingElseRows({ ...base, ...o });
const row = (rows: ReturnType<typeof at>, key: string) => rows.find((r) => r.key === key);

test('everything-else · every row is either a live link, a badge, or a share action — never neither', () => {
  const rows = at({
    cameraFeatureOn: true,
    broadcastConfigured: true,
    venueWalkHref: '/maria-and-jose/venue',
    recapBodyReady: true,
    recapHasPhotos: true,
    canShare: true,
    isLive: true,
  });
  assert.ok(rows.length > 0, 'fixture produced no rows to check');
  for (const r of rows) {
    const hasHref = typeof r.href === 'string' && r.href.length > 0;
    const hasBadge = typeof r.badge === 'string' && r.badge.length > 0;
    const hasAction = r.action === 'share';
    assert.ok(hasHref || hasBadge || hasAction, `${r.key} is neither a link, a badge, nor an action`);
    // A live link never ALSO carries a badge — the badge is what a non-link
    // row shows instead of a chevron, not decoration on a working door.
    if (hasHref) assert.ok(!hasBadge, `${r.key} has both an href and a badge`);
    if (hasHref) assert.notEqual(r.href, '#', `${r.key} points at "#"`);
  }
});

test('everything-else · camera row: live link only while isLive, a date badge before it, omitted when the feature is off', () => {
  assert.equal(row(at({ cameraFeatureOn: false, isLive: true }), 'camera'), undefined);
  const before = row(at({ cameraFeatureOn: true, isLive: false }), 'camera');
  assert.equal(before?.href, undefined);
  assert.equal(before?.badge, 'December 18, 2026');
  const live = row(at({ cameraFeatureOn: true, isLive: true }), 'camera');
  assert.equal(live?.href, '/papic/guest?from=maria-and-jose');
  assert.equal(live?.badge, undefined);
});

test('everything-else · watch row: same live/badge shape, gated on broadcastConfigured not cameraFeatureOn', () => {
  assert.equal(row(at({ broadcastConfigured: false, isLive: true }), 'watch'), undefined);
  const before = row(at({ broadcastConfigured: true, isLive: false }), 'watch');
  assert.equal(before?.href, undefined);
  assert.ok(before?.badge);
  const live = row(at({ broadcastConfigured: true, isLive: true }), 'watch');
  assert.equal(live?.href, '/maria-and-jose/hub');
});

test('everything-else · find-my-table is NOT day-gated — it links the moment seating is published, whether or not it is the wedding day', () => {
  const preDayGuest = row(
    at({ venueWalkHref: '/maria-and-jose/venue?t=abc', isLive: false, viewerKind: 'guest' }),
    'find-my-table',
  );
  assert.equal(preDayGuest?.href, '/maria-and-jose/find-my-table');
  const preDayAnon = row(
    at({ venueWalkHref: '/maria-and-jose/venue', isLive: false, viewerKind: 'anonymous' }),
    'find-my-table',
  );
  assert.equal(preDayAnon?.href, '/maria-and-jose/find-seat');
});

test('everything-else · find-my-table and walk-the-room are both absent when seating is unpublished — no badge, no dead door', () => {
  const rows = at({ venueWalkHref: null });
  assert.equal(row(rows, 'find-my-table'), undefined);
  assert.equal(row(rows, 'venue-walk'), undefined);
});

test('everything-else · walk-the-room mirrors doorways.venueWalk verbatim, personal token included', () => {
  const rows = at({ venueWalkHref: '/maria-and-jose/venue?t=guest-token-123' });
  assert.equal(row(rows, 'venue-walk')?.href, '/maria-and-jose/venue?t=guest-token-123');
});

test('everything-else · keepsake reel: link once photos exist, "After" badge once the recap body exists but is still empty', () => {
  // The href is HANDED IN, resolved once by `resolveAlbumDoor` — this module
  // must not build `/recap` itself (the-album-door-is-one-decision).
  assert.equal(
    row(at({ recapBodyReady: true, recapHasPhotos: true, keepsakeHref: '/maria-and-jose/recap' }), 'keepsake')?.href,
    '/maria-and-jose/recap',
  );
  assert.equal(
    row(at({ recapBodyReady: true, recapHasPhotos: true, keepsakeHref: null }), 'keepsake')?.badge,
    'After',
    'no resolved door → a dated row, never a link that may not open',
  );
  const emptyRecap = row(at({ recapBodyReady: true, recapHasPhotos: false }), 'keepsake');
  assert.equal(emptyRecap?.href, undefined);
  assert.equal(emptyRecap?.badge, 'After');
});

test('everything-else · keepsake reel pre-event: "After" badge when a date is set, omitted entirely when it is not', () => {
  const dated = row(at({ recapBodyReady: false, eventDateLabel: 'December 18, 2026' }), 'keepsake');
  assert.equal(dated?.badge, 'After');
  assert.equal(dated?.href, undefined);
  const undated = row(at({ recapBodyReady: false, eventDateLabel: '' }), 'keepsake');
  assert.equal(undated, undefined);
});

test('everything-else · print never renders before the recap body exists — it mirrors the editorial phase gate, which blocks early visitors', () => {
  assert.equal(row(at({ recapBodyReady: false }), 'print'), undefined);
  assert.equal(row(at({ recapBodyReady: true }), 'print')?.href, '/maria-and-jose/print');
});

test('everything-else · share is an action, not a link, and only when the page is effectively public', () => {
  assert.equal(row(at({ canShare: false }), 'share'), undefined);
  const shareRow = row(at({ canShare: true }), 'share');
  assert.equal(shareRow?.action, 'share');
  assert.equal(shareRow?.href, undefined);
});

test('everything-else · nothing available at all returns an empty list — the caller must render no trigger', () => {
  assert.deepEqual(at({ eventDateLabel: '' }), []);
});

test('everything-else · rows are grouped ON THE DAY before ANYTIME, in a stable order', () => {
  const rows = at({
    cameraFeatureOn: true,
    broadcastConfigured: true,
    venueWalkHref: '/maria-and-jose/venue',
    recapBodyReady: true,
    recapHasPhotos: true,
    canShare: true,
  });
  const groups = rows.map((r) => r.group);
  const firstAnytime = groups.indexOf('anytime');
  assert.notEqual(firstAnytime, -1);
  assert.ok(
    groups.slice(0, firstAnytime).every((g) => g === 'on-the-day'),
    'an "anytime" row appears before an "on-the-day" row',
  );
});
