/**
 * apns-request.test.ts — THE IPHONE APP'S PUSH SAYS WHAT THE TEMPLATE SAYS, AND
 * REPLACES THE LAST ONE.
 *
 * Owner, 2026-10-31: "The notification on the phone not on the app" and "each new
 * RSVP notification replaces the last one on the lock screen". Runs the pure APNs
 * request (`lib/apns-request.ts`):
 *   1 · the body is the template's message — aps.alert title/body, badge, sound,
 *       and the url a tap opens — nothing written here;
 *   2 · `apns-collapse-id` is the template's collapse key (`rsvp:<eventId>`), and a
 *       key over 64 bytes is hashed down, never sent too long;
 *   3 · the provider token is a real ES256 JWT that verifies with the key's public
 *       half (kid = key id, iss = team id);
 *   4 · missing env → no config (the channel is a quiet no-op); APNS_ENV picks
 *       the host; an escaped-newline .p8 (how Vercel stores it) is accepted;
 *   5 · a device token must be hex; Apple's "gone" answers prune.
 *
 * SABOTAGE (seen red, then restored): `apns-collapse-id` set to the kind only (2 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { pushMessage, rsvpSentence } from './push-message';
import { APNS_HOST, apnsCollapseId, apnsConfigFrom, apnsJwt, apnsRequest, apnsTokenIsGone, isApnsDeviceToken } from './apns-request';

const EV = '11111111-2222-4333-8444-555555555555';
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const P8 = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const msg = pushMessage({
  subject: { kind: 'event', name: 'Indalecio & Claire' },
  sentence: rsvpSentence({ latestGuest: 'Maria', others: 2, coming: 34 }),
  url: `/dashboard/${EV}/guests`,
  collapseKey: `rsvp:${EV}`,
  level: 'normal',
  badge: 4,
});

test('1 · the body is the template\'s message', () => {
  const { body } = apnsRequest(msg, { bundleId: 'com.setnayan.app' }, 'jwt');
  assert.deepEqual(JSON.parse(body), {
    aps: { alert: { title: 'Indalecio & Claire', body: 'Maria + 2 others replied · 34 coming so far' }, sound: 'default', badge: 4 },
    url: `/dashboard/${EV}/guests`,
  });
});

test('2 · the collapse id is the template\'s key, at most 64 bytes', () => {
  const { headers } = apnsRequest(msg, { bundleId: 'com.setnayan.app' }, 'jwt');
  assert.equal(headers['apns-collapse-id'], `rsvp:${EV}`);
  assert.equal(headers['apns-topic'], 'com.setnayan.app');
  assert.equal(headers['apns-push-type'], 'alert');
  assert.equal(headers.authorization, 'bearer jwt');
  assert.equal(headers['apns-priority'], '10');
  const low = pushMessage({ subject: { kind: 'account' }, sentence: 'x', url: '/a', collapseKey: 'summary:today', level: 'low' });
  assert.equal(apnsRequest(low, { bundleId: 'b' }, 'jwt').headers['apns-priority'], '5');
  const long = apnsCollapseId(`inquiry:/vendor-dashboard/messages/${EV}/and/a/very/long/tail`);
  assert.ok(Buffer.byteLength(long) <= 64 && long.startsWith('inquiry:'), long);
  assert.equal(long, apnsCollapseId(`inquiry:/vendor-dashboard/messages/${EV}/and/a/very/long/tail`));
});

test('3 · the provider token is an ES256 JWT that verifies', () => {
  const jwt = apnsJwt({ keyP8: P8, keyId: 'ABC123DEFG', teamId: 'TEAM123456' }, 1_800_000_000);
  const [h, c, sig] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h!, 'base64url').toString()), { alg: 'ES256', kid: 'ABC123DEFG' });
  assert.deepEqual(JSON.parse(Buffer.from(c!, 'base64url').toString()), { iss: 'TEAM123456', iat: 1_800_000_000 });
  const ok = verify('sha256', Buffer.from(`${h}.${c}`), { key: createPublicKey(privateKey), dsaEncoding: 'ieee-p1363' }, Buffer.from(sig!, 'base64url'));
  assert.ok(ok, 'the signature does not verify');
});

test('4 · env: missing → quiet no-op; APNS_ENV picks the host; escaped newlines accepted', () => {
  const full = { APNS_KEY_P8: P8.replace(/\n/g, '\\n'), APNS_KEY_ID: 'K', APNS_TEAM_ID: 'T', APNS_BUNDLE_ID: 'com.setnayan.app', APNS_ENV: 'sandbox' };
  const cfg = apnsConfigFrom(full);
  assert.ok(cfg && cfg.keyP8.includes('\n-----END PRIVATE KEY-----'));
  assert.equal(cfg!.env, 'sandbox');
  assert.equal(APNS_HOST[cfg!.env], 'https://api.sandbox.push.apple.com');
  assert.equal(apnsConfigFrom({ ...full, APNS_ENV: undefined })!.env, 'production');
  for (const k of ['APNS_KEY_P8', 'APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_BUNDLE_ID'] as const) {
    assert.equal(apnsConfigFrom({ ...full, [k]: undefined }), null, `${k} missing must switch the channel off`);
  }
});

test('5 · tokens are hex; Apple\'s "gone" answers prune', () => {
  assert.ok(isApnsDeviceToken('a'.repeat(64)));
  assert.ok(!isApnsDeviceToken('not-a-token'));
  assert.ok(!isApnsDeviceToken(''));
  assert.ok(apnsTokenIsGone(410, null) && apnsTokenIsGone(400, 'BadDeviceToken') && apnsTokenIsGone(400, 'Unregistered'));
  assert.ok(!apnsTokenIsGone(429, 'TooManyRequests'));
});
