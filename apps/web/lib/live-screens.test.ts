/**
 * DAY-12 · Live Studio venue screens — the rules both ends import, EXECUTED.
 *
 * Owner rulings 2026-09-20: a Live Studio screen shows live background, mirror
 * or off, NEVER the photo wall; a mirroring screen must say it is behind.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LIVE_SCREEN_MODES,
  MAX_LIVE_SCREENS,
  MIRROR_DELAY_NOTICE,
  canAddScreen,
  decideScreenPicture,
  isLiveScreenMode,
  nextScreenIndex,
  normalizePairCode,
  normalizeScreenName,
  pairCodeUsable,
  screenPresence,
  shouldWriteCheckIn,
  LIVE_SCREEN_STALE_MS,
  LIVE_SCREEN_CHECKIN_WRITE_MS,
  LIVE_SCREEN_POLL_MS,
} from './live-screens';
import { generateScreenPairingCode } from './panood-screens';
import { liveScreenTokenMatchesRow } from './live-screen-session';

const EMBED = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';

test('the three modes are exactly the owner-ruled three — no photo wall', () => {
  assert.deepEqual([...LIVE_SCREEN_MODES].sort(), ['live_bg', 'mirror', 'off']);
  for (const legacy of ['photos', 'photo_wall', 'wall', 'cam1', '', null, undefined, 42]) {
    assert.equal(isLiveScreenMode(legacy), false, `${String(legacy)} must not be a Live Studio mode`);
  }
});

test('a legacy or unknown stored mode draws the live background, never the photo wall', () => {
  // `photos` is the column DEFAULT the legacy Cast room wrote.
  for (const mode of ['photos', 'cam2', 'garbage', null, undefined]) {
    assert.deepEqual(decideScreenPicture({ mode, embedUrl: EMBED }), { kind: 'live_bg' }, String(mode));
  }
});

test('mirror carries the delay notice, every time it draws the stream', () => {
  const p = decideScreenPicture({ mode: 'mirror', embedUrl: EMBED });
  assert.equal(p.kind, 'mirror');
  if (p.kind !== 'mirror') return;
  assert.equal(p.notice, MIRROR_DELAY_NOTICE);
  assert.match(p.notice, /behind/i, 'the notice must say the stream is behind the room');
  assert.ok(p.embedUrl.startsWith(EMBED), 'the embed is the event’s own link');
  assert.match(p.embedUrl, /[?&]mute=1/, 'a TV in the room autoplays muted — the room has the real sound');
  assert.match(p.embedUrl, /[?&]autoplay=1/);
});

test('mirror with no watch link falls back to the live background, not an error on the TV', () => {
  assert.deepEqual(decideScreenPicture({ mode: 'mirror', embedUrl: null }), { kind: 'live_bg' });
});

test('off is off', () => {
  assert.deepEqual(decideScreenPicture({ mode: 'off', embedUrl: EMBED }), { kind: 'off' });
});

test('the screen page renders the notice from the picture, beside the mirror iframe', () => {
  // The rule above is only half the promise; the render is the other half.
  const src = readFileSync(join(__dirname, '..', 'app', 'live', 'screen', 'screen-stage.tsx'), 'utf8');
  const mirrorBranch = src.slice(src.indexOf("picture.kind === 'mirror'"), src.indexOf('return <LiveBackground'));
  assert.ok(mirrorBranch.length > 0, 'precondition: found the mirror branch');
  assert.match(mirrorBranch, /<iframe/, 'the mirror branch draws the stream');
  assert.match(mirrorBranch, /\{picture\.notice\}/, 'and renders the notice with it');
  assert.equal(/photo|wall_feed/i.test(src), false, 'the screen stage never reaches for the photo wall');
});

test('every generated code survives the TV-remote normalizer unchanged', () => {
  for (let i = 0; i < 500; i += 1) {
    const c = generateScreenPairingCode();
    assert.equal(normalizePairCode(c), c);
    assert.equal(normalizePairCode(c.toLowerCase()), c, 'case-insensitive');
  }
});

test('the normalizer applies Crockford mistype rules and rejects non-codes', () => {
  assert.equal(normalizePairCode('ab-c 12o'), 'ABC120');
  assert.equal(normalizePairCode('IL1234'), '111234');
  assert.equal(normalizePairCode('ABC12'), null, 'too short');
  assert.equal(normalizePairCode('ABC1234'), null, 'too long');
  assert.equal(normalizePairCode('ABC12U'), null, 'U is not in the alphabet');
  assert.equal(normalizePairCode(null), null);
});

test('a code is usable only while live, unrevoked and unexpired', () => {
  const now = Date.parse('2026-09-20T10:00:00Z');
  const base = { pairing_code: 'ABC123', pairing_expires_at: '2026-09-21T10:00:00Z', revoked_at: null };
  assert.equal(pairCodeUsable(base, now), true);
  assert.equal(pairCodeUsable({ ...base, pairing_expires_at: '2026-09-20T09:59:59Z' }, now), false, 'expired');
  assert.equal(pairCodeUsable({ ...base, revoked_at: '2026-09-20T09:00:00Z' }, now), false, 'removed');
  assert.equal(pairCodeUsable({ ...base, pairing_code: null }, now), false, 'already used');
  assert.equal(pairCodeUsable({ ...base, pairing_expires_at: null }, now), false, 'no expiry = not issued by this flow');
});

test('presence reads the clock, not the stored status', () => {
  const now = Date.parse('2026-09-20T10:00:00Z');
  assert.equal(screenPresence({ paired_at: null, last_seen_at: null }, now), 'waiting');
  assert.equal(screenPresence({ paired_at: '2026-09-20T09:00:00Z', last_seen_at: '2026-09-20T09:59:50Z' }, now), 'on');
  assert.equal(
    screenPresence({ paired_at: '2026-09-20T09:00:00Z', last_seen_at: '2026-09-20T09:58:00Z' }, now),
    'not_responding',
    'an unplugged TV sends nothing, so only the clock can say it is gone',
  );
});

test('a healthy screen is never shown as not responding between check-in writes', () => {
  // Worst case: the last write happened just under the throttle ago, then one
  // more poll interval passes before the next write lands.
  assert.ok(LIVE_SCREEN_CHECKIN_WRITE_MS + LIVE_SCREEN_POLL_MS < LIVE_SCREEN_STALE_MS);
  const now = Date.parse('2026-09-20T10:00:00Z');
  assert.equal(shouldWriteCheckIn(new Date(now - LIVE_SCREEN_CHECKIN_WRITE_MS + 1).toISOString(), now), false);
  assert.equal(shouldWriteCheckIn(new Date(now - LIVE_SCREEN_CHECKIN_WRITE_MS).toISOString(), now), true);
  assert.equal(shouldWriteCheckIn(null, now), true);
});

test('index and cap', () => {
  assert.equal(nextScreenIndex([]), 1);
  assert.equal(nextScreenIndex([1, 2, 5]), 6, 'a removed screen’s index is never reused');
  assert.equal(canAddScreen(MAX_LIVE_SCREENS - 1), true);
  assert.equal(canAddScreen(MAX_LIVE_SCREENS), false);
  assert.equal(normalizeScreenName('  Stage   left '), 'Stage left');
  assert.equal(normalizeScreenName('   '), null);
});

test('a device token is honoured only for the live row it was minted for', () => {
  const claim = { screen_id: 7, event_id: 'e1', paired_at: '2026-09-20T09:00:00.000Z' };
  const row = { id: 7, event_id: 'e1', paired_at: '2026-09-20T09:00:00+00:00', revoked_at: null };
  assert.equal(liveScreenTokenMatchesRow(claim, row), true, 'same instant, different text rendering');
  assert.equal(liveScreenTokenMatchesRow(claim, null), false, 'row gone');
  assert.equal(liveScreenTokenMatchesRow(claim, { ...row, revoked_at: '2026-09-20T10:00:00Z' }), false, 'Remove');
  assert.equal(liveScreenTokenMatchesRow(claim, { ...row, paired_at: null }), false, 'New code clears the pairing');
  assert.equal(
    liveScreenTokenMatchesRow(claim, { ...row, paired_at: '2026-09-20T09:30:00Z' }),
    false,
    'a newer device paired — the old one is out',
  );
  assert.equal(liveScreenTokenMatchesRow(claim, { ...row, event_id: 'e2' }), false, 'another event');
  assert.equal(liveScreenTokenMatchesRow(claim, { ...row, id: 8 }), false, 'another screen');
});
