/**
 * rsvp-goes-to-the-phone-not-the-inbox.test.ts — A GUEST'S REPLY IS NOT EMAILED;
 * IT REACHES THE HOST'S PHONE AT ONCE AND REPLACES THE LAST ONE.
 *
 * Owner, 2026-10-31, verbatim: "I keep getting email notifications everytime a
 * person confirms rsvp. How much does that cost us?" → "Can we make the
 * notification instead like facebook even if on website and app?" → "Yes. The
 * notification on the phone not on the app." — and then "Yes" to: "instant, but
 * each new RSVP notification replaces the last one on the lock screen instead of
 * stacking."
 *
 * 🔑 ONE MECHANISM, SEVERAL HALVES — having some is indistinguishable from having
 * none. Each is held here:
 *   1 · `rsvp_received` is NOT emailed;
 *   2 · it IS pushed, through `pushRsvpReply` (never the plain bell twin);
 *   3 · INSTANT BY DAY: the RSVP action notifies inside `after()` (never in front of
 *       the guest's reply), and the push path has no hold of its own — no timer, no
 *       window, no "already pushed" state. Quiet hours are the one wait, decided by
 *       its level (Normal, lib/push-levels.ts), not here;
 *   4 · COLLAPSE: the key is `rsvp:<eventId>`; Web Push sends it as `tag` AND the
 *       `Topic` header; the service worker shows it with `renotify: true`;
 *   5 · THE COUNT is the host's UNREAD reply rows for this event (run in
 *       lib/rsvp-push-count.test.ts), and opening Guests marks them read.
 *
 * SABOTAGE (each seen red, then restored): put 'rsvp_received' back on the email
 * list (1) · swapped pushRsvpReply for sendPushForNotice (2) · moved the RSVP emit
 * out of after() (3) · collapse key `rsvp:${eventId}` → `rsvp` (4) · removed
 * `renotify: true` from sw.js (4) · dropped `.is('read_at', null)` from the count
 * read (5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PUSH_LEVEL } from './push-levels';

const WEB = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const EMIT = read('lib/notification-emit.ts');
const RSVP = read('lib/rsvp-push.server.ts');

function members(name: string): string[] {
  const start = EMIT.indexOf(`const ${name}`);
  assert.ok(start > -1, `${name} moved — this guard is blind`);
  const open = EMIT.indexOf('new Set([', start);
  const close = EMIT.indexOf(']);', open);
  assert.ok(open > start && close > open, `could not bound ${name}`);
  return [...EMIT.slice(open, close).matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]!);
}

test('anchor — the lists were really read', () => {
  assert.ok(members('EMAIL_ENABLED_TYPES').length >= 40);
});

test('1 · a reply is not emailed', () => {
  assert.ok(!members('EMAIL_ENABLED_TYPES').includes('rsvp_received'), 'rsvp_received is emailed again — the owner moved it to the phone');
});

test('2 · a reply is pushed, through pushRsvpReply', () => {
  assert.equal(PUSH_LEVEL.rsvp_received, 'normal', 'rsvp_received is not pushed by day — nobody is told');
  assert.match(EMIT, /if \(type === 'rsvp_received' && eventId\) \{\s*await pushRsvpReply\(userId, eventId\);\s*\} else \{/);
});

test('3 · instant — after the reply is saved, and no hold anywhere on the way', () => {
  const action = read('app/[slug]/actions.ts');
  const at = action.indexOf("type: 'rsvp_received'");
  assert.ok(at > -1, 'the RSVP emit moved — this guard is blind');
  const before = action.slice(Math.max(0, at - 600), at);
  assert.match(before, /after\(async \(\) => \{[\s\S]*await emitNotification\(\{\s*userId,\s*$/, 'the RSVP notice is sent in front of the guest\'s reply, not after it');
  assert.ok(!/setTimeout|WINDOW|pushed_at|claimPeriodicJob|runClaimedJob/.test(RSVP), 'the RSVP push holds or delays');
});

test('4 · one collapse key per event, sent as tag + Topic, shown with renotify', () => {
  assert.match(RSVP, /collapseKey: `rsvp:\$\{eventId\}`/, 'RSVP notices no longer share a per-event key — they would stack');
  const web = read('lib/web-push.ts');
  assert.match(web, /topic: message\.topic/, 'the Web Push Topic header is gone');
  assert.match(read('lib/push-message.ts'), /tag: m\.collapseKey/);
  const sw = read('public/sw.js');
  assert.match(sw, /renotify: true/, 'a replacement swaps in silently instead of buzzing');
  assert.match(sw, /payload\.tag/, 'the service worker drops the collapse key');
});

test('5 · the count is the unread replies, and opening Guests resets it', () => {
  const count = RSVP.slice(RSVP.indexOf(".from('notifications')"), RSVP.indexOf('.limit(500)'));
  for (const re of [/\.eq\('user_id', userId\)/, /\.eq\('event_id', eventId\)/, /\.eq\('type', 'rsvp_received'\)/, /\.is\('read_at', null\)/]) {
    assert.match(count, re, `the reply count lost ${re}`);
  }
  assert.match(RSVP, /rsvpPushFacts\(/);
  const reset = RSVP.slice(RSVP.indexOf('export async function markReplyNoticesSeen'));
  assert.match(reset, /\.eq\('user_id', userId\)[\s\S]*\.eq\('event_id', eventId\)[\s\S]*\.eq\('type', 'rsvp_received'\)[\s\S]*\.is\('read_at', null\)/);
  assert.match(
    read('app/dashboard/[eventId]/guests/page.tsx'),
    /if \(viewer\.isCouple && guestsMeasured\) after\(\(\) => markReplyNoticesSeen\(user\.id, eventId\)\);/,
    'opening Guests no longer resets the count',
  );
});
