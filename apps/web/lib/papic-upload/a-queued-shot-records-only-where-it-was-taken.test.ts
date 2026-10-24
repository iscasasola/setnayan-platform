/**
 * A QUEUED SHOT RECORDS ONLY INTO THE EVENT, AND AS THE PERSON, IT WAS TAKEN BY.
 *
 * Review 2026-10-23, blocker 2: a shot waits on the phone, sometimes for hours.
 * Meanwhile the phone's guest pass can move to another event, or a shared phone
 * can be signed in as another supplier. Without a binding, the queue recorded
 * yesterday's shots into whichever event and person the phone spoke for NOW —
 * someone else's photo, charged to someone else, in someone else's Memories.
 *
 * Held three ways:
 *   1. the tag (lib/papic-upload/owner-tag.server.ts) is RUN: it differs per
 *      lane, person and event, and only the shot's own session matches it;
 *   2. both routes refuse a mismatch with a WAIT code (`other_event` /
 *      `other_owner`) BEFORE any sign, record or attach — and the classifier
 *      reads those codes as `context` (wait), never `drop`;
 *   3. the replayer only sends a shot whose event has a camera open on this
 *      device (lib/papic-upload/replayer.test.ts runs that).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { classifyAnswer, DROP_REFUSALS } from '@/lib/papic-upload/schedule';
import { ownerTagMatchesWith, ownerTagWith } from '@/lib/papic-upload/owner-tag-core';
import type { CaptureLane as Lane } from '@/lib/papic-upload/tiers';

const WEB = process.cwd().endsWith('/apps/web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const KEY = 'test-only-guest-session-secret-for-owner-tags-0123456789';

test('the owner tag differs per lane, person and event — and only the shot’s own session matches it', () => {
  const papicOwnerTag = (lane: Lane, ownerId: string, eventId: string) => ownerTagWith(KEY, lane, ownerId, eventId);
  const ownerTagMatches = (sent: unknown, ...a: [Lane, string, string]) => ownerTagMatchesWith(KEY, sent, ...a);
  const mine = papicOwnerTag('guest', 'guest-A', 'ev-1');
  assert.ok(mine && /^[0-9a-f]{32}$/.test(mine));
  const others = [
    papicOwnerTag('guest', 'guest-A', 'ev-2'), // same guest, another event
    papicOwnerTag('guest', 'guest-B', 'ev-1'), // another guest, same event (a shared phone)
    papicOwnerTag('vendor', 'guest-A', 'ev-1'), // another lane
  ];
  for (const t of others) assert.notEqual(t, mine);

  assert.equal(ownerTagMatches(mine, 'guest', 'guest-A', 'ev-1'), true);
  assert.equal(ownerTagMatches(mine, 'guest', 'guest-B', 'ev-1'), false, 'a shared phone records as someone else');
  assert.equal(ownerTagMatches(mine, 'guest', 'guest-A', 'ev-2'), false, 'a pass for another event records it there');
  assert.equal(ownerTagMatches(mine, 'vendor', 'guest-A', 'ev-1'), false);
  assert.equal(ownerTagMatches(42, 'guest', 'guest-A', 'ev-1'), false, 'a non-string tag is not a match');
  assert.equal(ownerTagMatches(mine.slice(0, 31), 'guest', 'guest-A', 'ev-1'), false);
  // A shot adopted from the old queue carries no tag; it was always sent as whoever was signed in.
  assert.equal(ownerTagMatches(undefined, 'guest', 'guest-A', 'ev-1'), true);
  // The server half is only the key: it must delegate, not re-implement.
  const server = read('lib/papic-upload/owner-tag.server.ts');
  assert.match(server, /return ownerTagWith\(material\(\), lane, ownerId, eventId\);/);
  assert.match(server, /return ownerTagMatchesWith\(material\(\), sent, lane, ownerId, eventId\);/);
});

test('a mismatch is a WAIT, never a drop', () => {
  for (const code of ['other_event', 'other_owner']) {
    assert.equal(classifyAnswer(409, { error: code }).verdict, 'context', `${code} must wait`);
    assert.ok(!DROP_REFUSALS.has(code));
  }
  // No pass on this phone for the shot's event: retried, never dropped.
  assert.notEqual(classifyAnswer(401, { error: 'no_session' }).verdict, 'drop');
});

function before(src: string, first: string, ...later: string[]): void {
  const a = src.indexOf(first);
  assert.ok(a > -1, `"${first}" is gone — re-point this guard`);
  for (const l of later) {
    const b = src.indexOf(l);
    assert.ok(b > -1, `"${l}" is gone — re-point this guard`);
    assert.ok(a < b, `"${first}" must come before "${l}"`);
  }
}

test('guest route: the pass is read FOR THE SHOT’S EVENT, and both checks run before any sign / record / attach', () => {
  const src = read('app/api/papic/guest-capture/route.ts');
  const post = src.slice(src.indexOf('export async function POST('));
  assert.match(post, /readGuestSession\(askedEventId \? \{ eventId: askedEventId \} : undefined\)/);
  assert.match(post, /if \(askedEventId && session\.event_id !== askedEventId\) \{\s*return json\(\{ error: 'other_event' \}, 409\);/);
  assert.match(
    post,
    /if \(!ownerTagMatches\(body\.owner_tag, 'guest', session\.guest_id, session\.event_id\)\) \{\s*return json\(\{ error: 'other_owner' \}, 409\);/,
  );
  before(post, "'other_event'", 'return handleSign(', 'return handleRecord(', 'return handleAttach(');
  before(post, "'other_owner'", 'return handleSign(', 'return handleRecord(', 'return handleAttach(');
});

test('supplier route: the owner tag is checked before any sign / record / attach', () => {
  const src = read('app/api/vendor/papic-capture/route.ts');
  assert.match(
    src,
    /if \(!ownerTagMatches\(body\.owner_tag, 'vendor', vendorProfileId, eventId\)\) \{\s*return json\(\{ error: 'other_owner' \}, 409\);/,
  );
  before(src, "'other_owner'", "if (op === 'sign')", "if (op === 'record')", "if (op === 'attach')");
});

test('every queued shot carries its event and its owner tag on every call', () => {
  const lanes = read('lib/papic-upload/lanes.ts');
  assert.match(lanes, /event_id: shot\.eventId/);
  assert.match(lanes, /owner_tag/);
  for (const cam of [
    'app/papic/guest/_components/papic-guest-capture.tsx',
    'app/papic/decorate/_components/kwento-decorator.tsx',
    'app/vendor-dashboard/on-the-day/live/[eventId]/_components/papic-capture-controller.tsx',
  ]) {
    assert.match(read(cam), /papicUploader\(\)\.register\(\{ lane: '(guest|vendor)', eventId, ownerTag: uploadOwner \}\)/, `${cam} registers no camera`);
  }
});
