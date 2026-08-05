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
 * ── WHY IT IS A CONTENTLESS PING, NOT A ROW SUBSCRIPTION ────────────────────
 *
 * Supabase Realtime ships two patterns here, and BOTH are already used:
 *
 *   `postgres_changes` — honours RLS. The budget, the chat and the seating plan
 *      use it. It CANNOT work here: a wedding guest holds a signed cookie, not
 *      a Supabase auth session, so to Supabase they are anonymous. Making the
 *      rows readable by `anon` would publish every couple's announcements to
 *      anyone who could guess an event id.
 *
 *   `broadcast` — the photo wall's pattern. No RLS at all, which is precisely
 *      why the payload must stay EMPTY. What travels is "there is something new
 *      for this event", which the page being live already implies. The words
 *      come from a server action that checks the guest's own cookie.
 *
 * ── AND WHY THERE IS STILL A TIMER ──────────────────────────────────────────
 * Venue wifi drops channels constantly. The ping is a HINT; the poll is the
 * guarantee. A dropped channel must cost latency, never the message — the same
 * reasoning the photo wall states for its own tiles.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = join(HERE, '..');
const CARD = readFileSync(join(ROUTE, '_components', 'day-of-announcement.tsx'), 'utf8');
const ACTION = readFileSync(join(ROUTE, 'announcement-actions.ts'), 'utf8');
const WRITER = readFileSync(
  join(ROUTE, '..', 'dashboard', '[eventId]', '_actions', 'day-of-broadcast.ts'),
  'utf8',
);

test('the announcement arrives without a reload', () => {
  assert.match(CARD, /\.channel\(`announce:\$\{eventId\}`\)/, 'the card no longer subscribes');
  assert.match(CARD, /'broadcast', \{ event: 'announcement' \}/, 'it is not listening for the ping');
  assert.match(WRITER, /\.channel\(`announce:\$\{eventId\}`\)/, 'nothing sends the ping');
  assert.match(WRITER, /type: 'broadcast'/, 'the writer stopped broadcasting');
});

test('the channel carries no words — only the fact that there are some', () => {
  // A `broadcast` channel has NO RLS. Anything on it is readable by anyone who
  // can guess an event id, and announcements are guest-only.
  assert.match(
    WRITER,
    /payload: \{\},/,
    'The ping now carries a payload. A broadcast channel is unauthenticated — ' +
      'putting the announcement text on it publishes every couple\'s ' +
      'announcements to anyone who can guess an event id. Send the fact; fetch ' +
      'the words.',
  );
  assert.ok(
    !/payload: \{[^}]*body/.test(WRITER),
    'The announcement body is being broadcast.',
  );
});

test('the words come from an authorized read, pinned to the guest\'s own event', () => {
  assert.match(ACTION, /readGuestSession\(\)/, 'the action stopped checking the cookie');
  assert.match(
    ACTION,
    /session\.event_id !== eventId/,
    'The action must pin the request to the guest\'s OWN event, or a valid ' +
      'cookie for one wedding could read another\'s announcements.',
  );
  // Both denials must look the same, so the answer does not reveal membership.
  assert.match(ACTION, /if \(!session \|\| session\.event_id !== eventId\) return null;/);
});

test('a dropped channel costs latency, never the message', () => {
  assert.match(
    CARD,
    /setInterval\(\(\) => void pull\(\), 45_000\)/,
    'The poll is gone. Venue wifi drops channels constantly; without a timer a ' +
      'dropped channel means the coordinator\'s words never arrive at all.',
  );
  assert.match(
    CARD,
    /visibilitychange/,
    'A phone that was in a pocket must catch up the moment it is looked at.',
  );
  assert.match(
    WRITER,
    /try \{[\s\S]*?\.channel\(`announce:\$\{eventId\}`\)[\s\S]*?\} catch \{/,
    'The ping must never fail the write that already succeeded.',
  );
});

test('a failed read never blanks a standing announcement', () => {
  // "Phones down" disappearing off a screen because one fetch stumbled is worse
  // than it arriving late — same rule as the rest of the guest site, and this
  // one is safety-adjacent.
  assert.match(
    CARD,
    /if \(alive && latest\?\.body\) setText\(latest\.body\)/,
    'The card now writes whatever came back, including nothing. Only ever ' +
      'replace a standing announcement with a real one.',
  );
});

test('the card still works with no eventId, so a caller cannot break it', () => {
  assert.match(CARD, /eventId\?: string;/, 'eventId must stay optional');
  assert.match(
    CARD,
    /if \(!eventId\) return;/,
    'Without the guard, a caller that forgets the prop subscribes to ' +
      '`announce:undefined` — a channel every event would share.',
  );
});
