import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_WALL_GUEST_VISIBILITY,
  WALL_GUEST_VISIBILITIES,
  asWallGuestVisibility,
  storedWallGuestMirror,
  wallGuestMirrorOn,
} from './live-wall-logic';

/**
 * THE LIVE PHOTO WALL'S GUEST PHONE MIRROR — the third "gate with no handle".
 *
 * `events.live_photo_wall_visibility` shipped on 2026-11-04 and had ZERO
 * readers, ZERO writers and no database consumer but its own CHECK constraint
 * for nine months. Meanwhile the ₱2,500 SKU — titled "Live VENUE Photo Wall" —
 * mirrored the same feed onto every invited guest's phone for the whole live
 * window, gated on SKU ownership alone. A couple who revoked every venue screen
 * code would reasonably believe the wall was off. It was still running in every
 * guest's hand.
 *
 * These tests exist because the previous three instances of this bug were all
 * green in CI. So they check two different things:
 *
 *   1. the pure decision (does 'off' actually close it?), and
 *   2. that the decision is REACHED — that no guest-facing wall surface can
 *      still answer the ownership question on its own.
 *
 * (2) is the one that matters. Checking the column in three places is three
 * chances to forget, and the next guest surface makes four.
 */

const WEB = process.cwd();
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

// ───────────────────────────────────────────────────────────────────────────
// 1. THE DECISION.
// ───────────────────────────────────────────────────────────────────────────

test('only "off" closes the mirror', () => {
  assert.equal(wallGuestMirrorOn('off'), false);
  assert.equal(wallGuestMirrorOn('all_with_consent'), true);
});

test('the stored vocabulary matches the DB CHECK constraint exactly', () => {
  // Drift here is the phantom-enum-value bug: Postgres rejects the whole
  // statement, `data` comes back null, and the caller reads that as consent.
  const sql = read('../../supabase/migrations/20261104000959_papic_live_photo_wall_schema.sql');
  const check = /CHECK \(live_photo_wall_visibility IN \(([^)]+)\)\)/.exec(sql);
  const listed = check?.[1];
  assert.ok(listed, 'the CHECK constraint should still be in the schema migration');
  const inDb = (listed.match(/'([a-z_]+)'/g) ?? []).map((s) => s.replaceAll("'", ''));
  assert.deepEqual([...WALL_GUEST_VISIBILITIES].sort(), inDb.sort());
});

test('the app can only ever write two of the three legal values', () => {
  // 'tagged_only' is legal in the DB and UNIMPLEMENTED in the product. Writing
  // it would store a promise — "only the photos you are in" — that nothing
  // anywhere keeps. That is the `sponsored_included` failure: a stored value
  // whose NAME misleads every later reader, including us.
  assert.equal(storedWallGuestMirror(true), 'all_with_consent');
  assert.equal(storedWallGuestMirror(false), 'off');
  assert.notEqual(storedWallGuestMirror(true), 'tagged_only');
});

test('a legacy "tagged_only" row shows everything — deliberately, not by accident', () => {
  // This is the honest reading of a column nothing ever implemented, and it is
  // asserted so it can never be mistaken for working filtration. When the
  // per-guest filter is built, THIS test is the one that must change, and its
  // failure is the signpost to wallGuestMirrorOn().
  assert.equal(wallGuestMirrorOn('tagged_only'), true);
  assert.equal(asWallGuestVisibility('tagged_only'), 'tagged_only');
});

test('an unrecognised or missing value falls back to the shipped behaviour, not to silence', () => {
  // Fails OPEN on purpose. An unreadable value must not silently delete a
  // feature the couple paid ₱2,500 for; only the couple, saying 'off',
  // turns the mirror off. (The SERVER gate fails CLOSED on a read ERROR —
  // different question, opposite answer, both deliberate.)
  assert.equal(asWallGuestVisibility(null), DEFAULT_WALL_GUEST_VISIBILITY);
  assert.equal(asWallGuestVisibility(undefined), DEFAULT_WALL_GUEST_VISIBILITY);
  assert.equal(asWallGuestVisibility('OFF'), DEFAULT_WALL_GUEST_VISIBILITY); // case matters
  assert.equal(asWallGuestVisibility(''), DEFAULT_WALL_GUEST_VISIBILITY);
  assert.equal(wallGuestMirrorOn('something_a_later_migration_added'), true);
});

// ───────────────────────────────────────────────────────────────────────────
// 2. IS THE DECISION REACHED? — the half that would have caught the original.
// ───────────────────────────────────────────────────────────────────────────

/** Every guest-facing surface that renders or serves the wall. */
const GUEST_WALL_SURFACES = [
  'app/[slug]/_lib/loaders.ts', // the wedding page (identified + anonymous)
  'app/[slug]/hub/page.tsx', // the guest hub
  'app/[slug]/live-wall/route.ts', // the 25s freshness feed
];

/**
 * The venue projection. Owner-locked 2026-06-11 to project regardless of this
 * column; it is gated by its own single-use screen code instead. Listed so the
 * boundary is a decision on the record, not an omission.
 */
const VENUE_SURFACES = [
  'app/wall/[eventId]/page.tsx',
  'app/api/wall/[eventId]/feed/route.ts',
];

test('no guest wall surface asks about ownership without asking about the couple’s choice', () => {
  for (const file of GUEST_WALL_SURFACES) {
    const src = read(file);
    assert.match(
      src,
      /guestWallMirrorActive\(/,
      `${file} serves the wall to guests and must gate on guestWallMirrorActive`,
    );
    assert.doesNotMatch(
      src,
      /eventSkuActive\([^)]*LIVE_WALL/s,
      `${file} still reads LIVE_WALL ownership directly — that is the permissive ` +
        `half of the question on its own, which is exactly the bug`,
    );
  }
});

test('the venue projection is deliberately NOT gated on the guest mirror', () => {
  for (const file of VENUE_SURFACES) {
    const src = read(file);
    assert.doesNotMatch(
      src,
      /guestWallMirrorActive\(/,
      `${file} is the venue screen — turning off the phone mirror must never dark the venue wall`,
    );
  }
});

test('the one gate reads the column, and fails closed when it cannot', () => {
  const src = read('lib/live-wall.ts');
  const fn = /export async function guestWallMirrorActive\([\s\S]*?\n}/.exec(src);
  assert.ok(fn, 'guestWallMirrorActive should exist in lib/live-wall.ts');
  const body = fn[0];

  // Anchored to the SELECT, not to "the column name appears somewhere". The
  // first cut of this assertion was `/live_photo_wall_visibility/` over the
  // whole body — and it stayed GREEN with the query gutted to `.select('event_id')`,
  // because the type cast further down still mentions the column. A guard that
  // matches a string rather than the thing the string does is decorative; this
  // is the same shape as the sabotage check that matched `f.event_dateX` on a
  // prefix. Mutation-proved.
  assert.match(
    body,
    /\.select\('live_photo_wall_visibility'\)/,
    'it must actually ASK the database for the column, not merely mention it',
  );
  assert.match(body, /eventSkuActive\(/, 'it must still enforce SKU ownership');
  // Supabase resolves with { error }; it does not throw. A gate that ignores
  // `error` reports "no objection" on a failed read — indistinguishable from a
  // couple who said yes.
  assert.match(
    body,
    /if \(error \|\| !data\) return false;/,
    'a failed or empty read must fail CLOSED, not fall through to allowed',
  );
});

test('the couple’s switch is couple-only and refuses a 0-row save', () => {
  const src = read('app/dashboard/[eventId]/studio/papic/_components/live-wall-actions.ts');
  const fn = /export async function setWallGuestMirror\([\s\S]*?\n}/.exec(src);
  assert.ok(fn, 'setWallGuestMirror should exist');
  const body = fn[0];

  // A coordinator runs the day; only the couple decides whether their whole
  // wedding is mirrored onto a hundred personal phones.
  assert.match(body, /member_type !== 'couple'/, 'must be couple-only');
  // Without this, a save that matched no row reports success and the couple
  // believes they turned the wall off their guests' phones.
  assert.match(body, /data\.length === 0/, 'a 0-row update is not success');
});

test('closing the mirror reaches phones that already have the wall open', () => {
  // Turning it off closes the feed, but a phone with the page already open
  // holds the tiles it downloaded. Without this branch the couple's "off" only
  // reached people who reloaded — and everyone else kept the wall on screen
  // under the promise that photos appear the moment they're taken.
  //
  // 404 is the REFUSAL (the wall is not on offer to guests). An outage is a 5xx
  // or a thrown fetch and must NOT clear the wall — a network blip that wiped
  // the celebration off every phone would be its own bug.
  const src = read('app/[slug]/_components/live-wall-block.tsx');
  assert.match(
    src,
    /if \(res\.status === 404\) \{/,
    'the poll must treat a refusal differently from an outage',
  );
  const branch = /if \(res\.status === 404\) \{[\s\S]*?\n        \}/.exec(src)?.[0] ?? '';
  assert.match(branch, /setTiles\(\[\]\)/, 'a refusal must clear the photos already on screen');
  assert.match(branch, /stop\(\)/, 'and stop polling — the answer will not change by asking again');
  // The miss counter is for outages only; sharing it would mean two network
  // blips silently emptied a wall nobody had closed.
  assert.doesNotMatch(branch, /misses/, 'a refusal is not a missed fetch');
});

test('the couple is told the wall plays on guests’ phones, on the card that controls it', () => {
  // The one honest sentence about the phone mirror used to live only on the
  // website privacy page — a different surface entirely, which nobody managing
  // the wall would ever meet. A control without the fact beside it is not a
  // control.
  const card = read('app/dashboard/[eventId]/studio/papic/_components/live-wall-card.tsx');
  assert.match(card, /guests[^<]*phones/i, 'the wall card must say the phone mirror exists');

  const controls = read(
    'app/dashboard/[eventId]/studio/papic/_components/live-wall-controls.tsx',
  );
  assert.match(controls, /setWallGuestMirror\(/, 'and must offer the switch');
  assert.match(controls, /role="switch"/, 'as a real switch, with its state announced');
});
