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

test('the Hosts page uses the event’s own noun, and knows it is over', () => {
  const h = code('app/dashboard/[eventId]/hosts/page.tsx');
  assert.ok(!/planning this wedding with you/.test(h), 'the hardcoded wedding must be gone');
  assert.match(h, /eventNoun\(eventType\)/, 'the shipped noun resolver, not a second one');
  assert.match(h, /getMenuLifecyclePhase\(/, 'and the shipped phase resolver');
  assert.match(h, /Who planned this \$\{eventNounWord\} with you\?/, 'past tense after the day');
  assert.match(h, /event_date, event_end_date, cleared_at, timezone/, 'it must read the dates');
});

test('the seat plan stops telling you guests are watching once it is over', () => {
  const b = code('app/dashboard/[eventId]/seating/_components/day-of-editing-banner.tsx');
  assert.match(b, /getMenuLifecyclePhase\(eventDate, null\) === 'dayof'/);
  assert.ok(
    !/isEventDayActive/.test(b),
    'the T+60h window is right for guest surfaces and wrong for a message about them',
  );
});

test('the checklist tab does not say Setnayan twice', () => {
  const c = code('app/dashboard/[eventId]/checklist/page.tsx');
  assert.match(c, /replace\(\/\\s\*·\\s\*Setnayan\\s\*\$\/, ''\)/, 'the brand must be stripped once');
  // The behaviour, not just the source: the label table still ships the brand,
  // and the root template appends it — so the strip is what stands between the
  // person and a doubled title.
  const raw = checklistChrome('date').pageTitle;
  assert.match(raw, /· Setnayan$/, 'the table still carries it — that is why the strip exists');
  assert.equal(raw.replace(/\s*·\s*Setnayan\s*$/, ''), 'Date checklist');
});
