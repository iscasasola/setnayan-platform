import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checklistChrome } from './checklist';

/**
 * three-screens-still-spoke-in-the-present.test.ts
 *
 * Three defects read off the owner's LIVE signed-in dashboard on 2026-08-21,
 * the day after his Movie Night, while auditing what was left:
 *
 *   · Hosts        — "Who's planning this wedding with you?" on a movie night
 *   · Seat plan    — a red pulsing "Live — guests are seeing this now"
 *   · Checklist    — a browser tab reading "Date checklist · Setnayan · Setnayan"
 *
 * 🛡 Every assertion mutation-checked by occurrence count. Comments are
 * stripped first: each fix quotes the string it removes.
 */

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (p: string) =>
  readFileSync(join(WEB, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

// ⚖ Since the Hosts fold (owner 2026-09-30) the only screen left at /hosts is a
// helper's OWN access view; the rule it was held to is unchanged.
test('the Hosts page uses the event’s own noun, and knows it is over', () => {
  const h = code('app/dashboard/[eventId]/hosts/page.tsx');
  assert.ok(!/this wedding/.test(h), 'the hardcoded wedding must be gone');
  assert.match(h, /eventNoun\(eventType\)/, 'the shipped noun resolver, not a second one');
  // ⏱ The one clock — `eventClockOf(row).menu` is the shipped phase resolver on the venue's zone.
  assert.match(h, /eventClockOf\(ev\)\.menu === 'after'/, 'and the shipped phase resolver');
  assert.match(h, /What you could do on this \$\{eventNounWord\}/, 'past tense after the day');
  assert.match(h, /\.select\(`display_name, event_type, timezone, \$\{EVENT_CLOCK_COLUMNS\}`\)/, 'it must read the dates');
});

test('the seat plan stops telling you guests are watching once it is over', () => {
  const b = code('app/dashboard/[eventId]/seating/_components/day-of-editing-banner.tsx');
  // ⏱ The one clock: The Day's instants from the seat plan's server page (06:00 → 06:00 the morning after the last day).
  assert.match(b, /setLive\(theDayIsOpenAt\(eventDate\)\)/);
  assert.ok(
    !/isEventDayActive/.test(b),
    'the T+60h window is right for guest surfaces and wrong for a message about them',
  );
});

// ("The checklist tab does not say Setnayan twice" retired 2026-11-01: the Checklist page now only forwards to
// Planning Stage's To do filter and has no title of its own.)
