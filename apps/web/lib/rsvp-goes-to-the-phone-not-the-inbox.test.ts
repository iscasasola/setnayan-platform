/**
 * rsvp-goes-to-the-phone-not-the-inbox.test.ts — A GUEST'S REPLY IS NOT EMAILED;
 * IT IS PUSHED, GROUPED, AND A TAP OPENS THE RIGHT SCREEN.
 *
 * Owner, 2026-10-31, verbatim: "I keep getting email notifications everytime a
 * person confirms rsvp. How much does that cost us?" → "Can we make the
 * notification instead like facebook even if on website and app?" → "Yes. The
 * notification on the phone not on the app."
 *
 * 🔑 FOUR HALVES OF ONE MECHANISM, and having three is indistinguishable from
 * having none: the type off the email list · on the push list · routed to the
 * GROUPED sender (never the one-per-reply push) · and a service worker that opens
 * the notice's own link. Each is held here.
 *
 *   1 · `rsvp_received` is NOT in EMAIL_ENABLED_TYPES — and still is in neither
 *       gated set, nor anywhere else that sends mail;
 *   2 · it IS in PUSH_ENABLED_TYPES and GROUPED_PUSH_TYPES;
 *   3 · the push block sends a grouped type through `pushGroupedRsvp` and RETURNS
 *       before the plain `sendWebPush` — so there is no second, ungrouped buzz;
 *   4 · the grouped sender claims rows `WHERE pushed_at IS NULL` (no row pushed
 *       twice) and reads its decision from the pure module;
 *   5 · the tail of a burst is flushed: the job is in the catalog and fired from
 *       the RSVP action and the event layout, inside `after()`;
 *   6 · the service worker reads the funnel's `url` + `tag` (it used to read only
 *       `data.thread_id`, so every notice opened /vendor-dashboard).
 *
 * SABOTAGE (each seen red, then restored): put 'rsvp_received' back on the email
 * list (1 red) · deleted the `return;` after pushGroupedRsvp (3 red) · dropped
 * `.is('pushed_at', null)` from the claim (4 red) · removed `data.url = payload.url`
 * from sw.js (6 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PERIODIC_JOB_KEYS } from './periodic-job-registry';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const EMIT = stripComments(read('lib/notification-emit.ts'));
const SERVER = stripComments(read('lib/rsvp-push.server.ts'));

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
  assert.ok(members('PUSH_ENABLED_TYPES').length >= 4);
});

test('1 · a reply is not emailed', () => {
  assert.ok(!members('EMAIL_ENABLED_TYPES').includes('rsvp_received'), 'rsvp_received is emailed again — the owner moved it to the phone');
  assert.ok(!members('MARKETING_GATED_EMAIL_TYPES').includes('rsvp_received'));
});

test('2 · a reply is pushed, grouped', () => {
  assert.ok(members('PUSH_ENABLED_TYPES').includes('rsvp_received'), 'rsvp_received is not pushed — nobody is told');
  assert.ok(members('GROUPED_PUSH_TYPES').includes('rsvp_received'), 'rsvp_received is pushed one-per-reply');
});

test('3 · a grouped type goes through pushGroupedRsvp and never also through the plain push', () => {
  const at = EMIT.indexOf('GROUPED_PUSH_TYPES.has(type)', EMIT.indexOf('PUSH_ENABLED_TYPES.has(type)'));
  assert.ok(at > -1, 'the push block no longer asks whether the type is grouped');
  const branch = EMIT.slice(at, EMIT.indexOf('sendWebPush(userId', at));
  assert.match(branch, /await pushGroupedRsvp\(userId, eventId\);\s*return;/, 'a grouped push falls through to the plain one as well');
});

test('4 · the grouped sender claims only unpushed rows, from the pure decision', () => {
  assert.match(SERVER, /decideGroupedPush\(/);
  assert.match(SERVER, /groupedPushText\(/);
  const claim = SERVER.slice(SERVER.indexOf(".update({ pushed_at"), SERVER.indexOf('.select(SELECT)', SERVER.indexOf(".update({ pushed_at")));
  assert.match(claim, /\.is\('pushed_at', null\)/, 'the claim can push a row twice');
  assert.match(claim, /\.in\('notification_id', decision\.ids\)/);
});

test('5 · the tail of a burst is flushed, from real traffic', () => {
  assert.ok(PERIODIC_JOB_KEYS.includes('rsvp-push-flush'), 'the flush job is not in the catalog');
  assert.match(SERVER, /runClaimedJob\('rsvp-push-flush'/);
  for (const rel of ['app/[slug]/actions.ts', 'app/dashboard/[eventId]/layout.tsx']) {
    assert.match(stripComments(read(rel)), /after\(\(\) => maybeFlushRsvpPushes\(\)\)/, `${rel} no longer carries the flush`);
  }
});

test('6 · the service worker opens the notice\'s own link and keeps its tag', () => {
  const sw = stripComments(read('public/sw.js'));
  assert.match(sw, /data\.url = payload\.url/, 'the funnel\'s url is dropped — every tap opens the fallback');
  assert.match(sw, /payload\.tag/, 'the funnel\'s tag is dropped — grouped notices stack instead of replacing');
  assert.match(sw, /url\.startsWith\('\/'\) && !url\.startsWith\('\/\/'\)/, 'a payload could open an off-site address');
});
