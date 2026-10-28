/**
 * announcement-live.test.ts — the coordinator's words must reach a phone
 * nobody is touching.
 *
 * The day-of announcement was resolved ONCE, server-side, at render. So
 * "phones down, the ceremony is starting" reached only the guests who happened
 * to reload — and nobody reloads a page they are already looking at. On the one
 * day the product exists for, the loudest thing it can say was arriving only by
 * accident.
 *
 * ── AND NOW WITHOUT ANY SOCKET (EV1, 2026-10-28) ────────────────────────────
 *
 * Owner, 2026-10-28 (DECISION_LOG "NO EVENT HUB MAY CRASH"): guests never hold
 * a live connection. The contentless `broadcast` ping (2026-08-05) is gone — it
 * needed a Realtime socket on every guest's phone, and Realtime was the
 * costliest thing on the day. The card asks one small gated route on a timer,
 * and the moment a pocketed phone is looked at; the route answers from one
 * remembered read per event, cleared the instant the coordinator sends.
 *
 * What stays pinned is the PROPERTY: the words reach a phone nobody is
 * touching, from an authorized read pinned to the guest's own event, and a
 * failed read never blanks a standing announcement.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = join(HERE, '..');
const CARD = readFileSync(join(ROUTE, '_components', 'day-of-announcement.tsx'), 'utf8');
const GATE = readFileSync(join(ROUTE, '_lib', 'latest-announcement.server.ts'), 'utf8');
const ANSWER = readFileSync(join(ROUTE, 'announcement', 'route.ts'), 'utf8');
const WRITER = readFileSync(
  join(ROUTE, '..', 'dashboard', '[eventId]', '_actions', 'day-of-broadcast.ts'),
  'utf8',
);

test('the announcement arrives without a reload — and without a socket', () => {
  assert.match(CARD, /fetch\(`\/\$\{encodeURIComponent\(slug\)\}\/announcement`\)/, 'the card no longer asks');
  assert.match(CARD, /jittered\(wait\)/, 'the card asks once and never again — nobody reloads a page they are looking at');
  assert.doesNotMatch(CARD, /\.channel\(|createClient\(/, 'a guest’s phone holds a socket again (owner 2026-10-28)');
  assert.doesNotMatch(WRITER, /\.channel\(`announce:/, 'a ping nobody listens to is a Realtime message for nothing');
  assert.match(WRITER, /revalidateTag\(liveDayTag\(eventId\)\)/, 'the send must clear the remembered words at once');
});

test('the words come from an authorized read, pinned to the guest\'s own event', () => {
  assert.match(GATE, /verified\.payload\.event_id !== eventId/, 'a valid pass for one wedding could read another’s announcements');
  assert.match(GATE, /readGuestSession\(\{ eventId \}\)/, 'a signed-in viewer must be asked the account rule');
  // Both denials look the same, so the answer does not reveal membership.
  assert.match(ANSWER, /if \(!\(await holdsThisEventsCurrentPass\(event\.event_id\)\)\) return NextResponse\.json\(\{ body: null \}/);
});

test('a pocketed phone asks nothing, and catches up the moment it is looked at', () => {
  assert.match(CARD, /if \(document\.visibilityState !== 'visible'\) return;/);
  assert.match(CARD, /visibilitychange/, 'A phone that was in a pocket must catch up the moment it is looked at.');
  assert.match(CARD, /ANNOUNCEMENT_POLL_MS \* 2 \*\* failures/, 'a venue whose Wi-Fi is down is asked at full speed by every phone');
});

test('a failed read never blanks a standing announcement', () => {
  // "Phones down" disappearing off a screen because one fetch stumbled is worse
  // than it arriving late — same rule as the rest of the guest site, and this
  // one is safety-adjacent.
  assert.match(
    CARD,
    /if \(alive && typeof answer\.body === 'string' && answer\.body\.trim\(\)\) setText\(answer\.body\)/,
    'The card now writes whatever came back, including nothing. Only ever ' +
      'replace a standing announcement with a real one.',
  );
  assert.match(ANSWER, /status: 503/, 'a refused read must be an outage the card retries, never "nothing was said"');
});
