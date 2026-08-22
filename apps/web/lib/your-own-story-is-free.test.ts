/**
 * Guard — correcting the story we wrote about you is free.
 *
 * Owner 2026-08-21: *"make this feature part of free and not part of the event
 * hub pro."*
 *
 * Setnayan AUTO-CRAFTS an event's editorial — `composeCopy` builds the headline,
 * kicker, byline and deck from the couple's own names, venue and tone, and the
 * editor opens pre-filled with it. Until this change a non-PRO couple met a
 * paywall instead: the story we had already written ABOUT THEM was visible to
 * them only as a price.
 *
 * 🔑 An auto-written story its own subject cannot correct reads worse than no
 * story at all — the first name a generator gets wrong is the couple's own.
 *
 * PRO still sells the premium touches (chapter curation, section order, manual
 * guest wishes), and this suite pins that boundary in BOTH directions so the fix
 * cannot drift into "everything is free".
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const base = '../app/dashboard/[eventId]/website/editorial/';
const read = (f: string) =>
  stripComments(readFileSync(resolve(HERE, base + f), 'utf8'));

test('the editor is not behind a PRO wall', () => {
  const page = read('page.tsx');
  assert.doesNotMatch(
    page,
    /<WebsiteProLock/,
    'the editorial editor shows a PRO lock again — a couple would meet a price ' +
      'where the story we wrote about them should be',
  );
});

test('saving your own words is not refused for being free', () => {
  const actions = read('actions.ts');
  assert.doesNotMatch(
    actions,
    /Editing your editorial is part of Event Hub PRO/,
    'saveEditorial refuses a non-PRO couple again — they cannot correct our ' +
      'sentence about their own wedding',
  );
});

test('the premium extras are STILL gated — the fix must not become "all free"', () => {
  // The counterweight. Chapter curation, section order and manual guest wishes
  // are genuinely premium and were never what the owner freed.
  const actions = read('actions.ts');
  assert.match(
    actions,
    /const isPro = await isEditorialProActive\(admin, eventId\);/,
    'isPro is no longer resolved — the premium extras would become free too',
  );
  assert.match(
    actions,
    /if \(isPro\) \{/,
    'nothing is gated on isPro any more; PRO would sell nothing here',
  );
});
