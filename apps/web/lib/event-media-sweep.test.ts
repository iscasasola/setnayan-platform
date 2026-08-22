/**
 * Guard suite for the file sweep behind "Remove for good".
 *
 * Owner 2026-08-20: when a couple deletes their own celebration, the photographs
 * go with it — and the confirmation now says so. This suite pins the two things
 * that decide whether that is safe: WHICH buckets a stored ref may name, and
 * that a failed read is never mistaken for "there was nothing".
 *
 * The collector itself talks to the database, so these run against the pure
 * boundary rules the module exports through its source — the same split
 * `event-deletion-gate.test.ts` uses.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SWEEP = resolve(HERE, 'event-media-sweep.ts');
const ACTION = resolve(HERE, '../app/dashboard/[eventId]/delete-actions.ts');
const MENU = resolve(
  HERE,
  '../app/dashboard/(launcher)/_components/event-card-menu.tsx',
);
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('the sweep can only ever name the media bucket', () => {
  // 🔒 A SAFETY BOUNDARY, NOT A FILTER. The other four buckets hold things this
  // action has no ruling to destroy: chat attachments (owner ruled KEEP),
  // signed supplier contracts, the couple's paperwork scans, and suppliers'
  // government IDs. A stored ref is just a string — if one ever pointed outside
  // `media`, the sweep must decline rather than obey it.
  assert.match(
    read(SWEEP),
    /if \(bucket !== R2_BUCKETS\.media\) return;/,
    'The media-bucket pin is gone. A ref pointing at thread-files or ' +
      'vendor-contracts would now be obeyed, and those are not this action’s ' +
      'to delete.',
  );
});

test('chat attachments are never swept — the owner ruled KEEP', () => {
  const src = read(SWEEP);
  assert.doesNotMatch(
    src,
    /threadFiles/,
    'The sweep reaches thread-files. The owner ruled on 2026-08-20 that a ' +
      'supplier who was genuinely booked keeps their side of the paperwork.',
  );
  assert.doesNotMatch(
    src,
    /vendorContracts|vendorVerification/,
    'The sweep reaches a contracts or ID bucket — neither was ruled on.',
  );
});

test('all SEVEN papic keys are collected, not just the original', () => {
  const src = read(SWEEP);
  for (const col of [
    'r2_object_key',
    'display_r2_key',
    'thumb_r2_key',
    'poster_r2_key',
    'tile_r2_key',
    'wall_safe_r2_key',
    'clip_web_r2_key',
  ]) {
    assert.match(
      src,
      new RegExp(`'${col}'`),
      `${col} is not collected. Deleting only the original leaves the ` +
        'photograph fetchable at a derivative address — the same defect one ' +
        'layer down.',
    );
  }
});

test('a bare key with no r2:// prefix is refused, never guessed into a bucket', () => {
  assert.match(
    read(SWEEP),
    /if \(!bucket\) return;/,
    'A ref without an explicit bucket is being placed in one by assumption. ' +
      'Guessing is how a sweep deletes somebody else’s object.',
  );
});

test('the files are collected BEFORE the delete', () => {
  const src = read(ACTION);
  // 🪤 ANCHORED TO THE CALL, NOT THE IDENTIFIER. The first cut matched
  // `collectEventMediaRefs` anywhere — which the IMPORT at the top of the file
  // satisfies. Deleting the actual call left the import behind, so the index
  // still resolved, still sorted before the delete, and the guard stayed GREEN
  // while every file would have been orphaned. An import is not a call.
  const collectAt = src.indexOf('await collectEventMediaRefs(');
  const deleteAt = src.indexOf(".from('events')\n    .delete()");
  assert.ok(
    collectAt > 0,
    'the collector is never CALLED — an import alone sweeps nothing',
  );
  assert.ok(deleteAt > 0, 'the delete was not found');
  assert.ok(
    collectAt < deleteAt,
    'The keys are collected AFTER the delete. The rows carrying them are gone ' +
      'by then, so the sweep would find nothing and every file would be ' +
      'orphaned — silently.',
  );
});

test('a failed collection is not treated as "nothing to remove"', () => {
  // null means the read FAILED; an empty array means we looked and there was
  // nothing. Collapsing the two reports a clean sweep over a refused read.
  assert.match(
    read(SWEEP),
    /Promise<MediaRef\[\] \| null>/,
    'The collector no longer distinguishes a failed read from an empty one.',
  );
  assert.match(
    read(ACTION),
    /if \(mediaRefs && mediaRefs\.length > 0\)/,
    'The sweep no longer guards against a null collection.',
  );
});

test('the confirmation says the photos are gone for good', () => {
  // Owner 2026-08-20: "give them the information that you will also lose your
  // photos and information of the event permanently." Separate from the counted
  // line, because a count reads as an inventory — something you could imagine
  // asking us to restore.
  assert.match(
    read(MENU),
    /Your photos and everything about this celebration are deleted for good/,
    'The permanence warning is gone from the confirmation. Until today the ' +
      'files did not actually go; now they do, so the screen has to say so ' +
      'BEFORE the press.',
  );
});
