/**
 * THE LOCK SCREEN NAMES THE RIGHT KIND OF EVENT.
 *
 * The owner opened a private event called "Movie Night" — a `date`, not a
 * wedding — and its lock screen said:
 *
 *     "This wedding's page is private"
 *     "Only the couple's guests and moderators can view it"
 *     "Open the personal link the couple sent you"
 *
 * This is the FIRST and often ONLY screen a stranger sees on a private event,
 * and 4 of the 6 events in production are private. It was the most visible
 * instance of the wedding wording in the whole product, and it was found by
 * looking at the page — not by any test.
 *
 * 🔑 THE THING THAT MADE IT INVISIBLE: every LAUNCHED event is a wedding, so
 * the sentence was true everywhere anyone had looked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eventWordsFromProfile } from './event-words';
import { WEDDING_PROFILE, GENERIC_PROFILE } from '@/lib/event-type-profile';

const SRC = readFileSync(
  join(resolve(dirname(fileURLToPath(import.meta.url)), '../_components'), 'private-landing.tsx'),
  'utf8',
);

test('the lock screen asks the event type for its words', () => {
  assert.match(
    SRC,
    /const words = await eventWordsFor\(event\.event_type\)/,
    'the lock screen no longer resolves the event type — it will name every ' +
      'private event a wedding again',
  );
});

test('none of its three sentences is a hardcoded wedding word', () => {
  const rendered = SRC
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const bad of ['This wedding', 'the couple', 'couple&rsquo;s']) {
    assert.ok(
      !rendered.includes(bad),
      `the lock screen has "${bad}" back in its rendered text — a movie night ` +
        `will be told it is a wedding again`,
    );
  }
});

test('a wedding still reads exactly as it did', () => {
  const w = eventWordsFromProfile(WEDDING_PROFILE);
  assert.equal(
    `This ${w.eventWord}’s page is private`,
    'This wedding’s page is private',
  );
  assert.equal(
    `Only ${w.theOrganizerPossessive} guests and moderators can view it.`,
    'Only the couple’s guests and moderators can view it.',
  );
  assert.equal(
    `Open the personal link ${w.theOrganizer} sent you`,
    'Open the personal link the couple sent you',
  );
});

test('an unknown type degrades to something true, never to a wedding', () => {
  const g = eventWordsFromProfile(GENERIC_PROFILE);
  assert.equal(`This ${g.eventWord}’s page is private`, 'This event’s page is private');
  assert.ok(!g.theOrganizer.includes('couple'));
});
