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
import { EVENT_MEDIA_KEY_SETS, planEventMediaDeletes } from './event-media-sweep-core';

const PAPIC_KEY_COLUMNS = EVENT_MEDIA_KEY_SETS.papic;
const VENDOR_CAPTURE_KEY_COLUMNS = EVENT_MEDIA_KEY_SETS.vendorCapture;

const HERE = dirname(fileURLToPath(import.meta.url));
const SWEEP = resolve(HERE, 'event-media-sweep.ts');
const ACTION = resolve(HERE, '../app/dashboard/[eventId]/delete-actions.ts');
const MENU = resolve(
  HERE,
  '../app/dashboard/(launcher)/_components/event-card-menu.tsx',
);
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

/* The rule is proved by CALLING the planner (2026-09-10). These used to be
 * source pins on the collector (`if (bucket !== R2_BUCKETS.media) return;`);
 * the decision now lives in lib/event-media-sweep-core.ts, pure, and the
 * bucket half was never enough — media holds every couple's photographs. */
const E = 'e1000000-0000-4000-8000-000000000001';
const E2 = 'e1000000-0000-4000-8000-000000000002';
const V = 'f1000000-0000-4000-8000-000000000001';
const planned = (p: ReturnType<typeof planEventMediaDeletes>) =>
  p.deletes.map((d) => `${d.bucket}/${d.key}`).sort();

test('the sweep can only ever name the media bucket — AND only this celebration’s folders in it', () => {
  // 🔒 A SAFETY BOUNDARY, NOT A FILTER. Chat attachments (owner ruled KEEP),
  // contracts, paperwork scans and government IDs live in the other buckets.
  const p = planEventMediaDeletes({
    eventId: E,
    photos: [
      {
        r2_object_key: `r2://setnayan-vendor-verification/vendors/${V}/verification/gov.png`,
        display_r2_key: `r2://setnayan-thread-files/chat/t/a.pdf`,
        thumb_r2_key: `r2://setnayan-vendor-contracts/paperwork/${E}/x.pdf`,
        // Media, but ANOTHER couple's photograph and a supplier's logo — the
        // bucket pin alone would have obeyed both.
        poster_r2_key: `r2://setnayan-media/papic/event-${E2}/seat-s/a.jpg`,
        tile_r2_key: `r2://setnayan-media/vendors/${V}/logo/l.png`,
      },
    ],
    guestCaptures: [],
    captures: [],
    event: { site_bg_music_r2_key: `r2://setnayan-media/events/${E2}/site-music/a.mp3` },
  });
  assert.deepEqual(p.deletes, [], 'a ref outside this celebration’s own folders was planned for deletion');
  assert.equal(p.refused, 6);
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

test('all TEN papic keys are collected, not just the original', () => {
  const photo: Record<string, string> = {};
  for (const col of PAPIC_KEY_COLUMNS) {
    photo[col] = `r2://setnayan-media/${col === 'r2_object_key' ? '' : 'derivatives/'}papic/event-${E}/seat-s/${col}.bin`;
  }
  /*
    🪤 THIS NUMBER SAID SEVEN AND THE SCHEMA SAID TEN. The three face-blocked
    copies (`safe_display_r2_key`, `safe_tile_r2_key`, `safe_thumb_r2_key`) are
    written by papic-derivatives.ts after a face-block bake and were missing
    from the list, so this assertion PASSED while three public-facing copies of
    every photograph survived the sweep. The count is asserted BOTH ways on
    purpose: the length pin fails if a column is dropped, and the explicit
    membership below fails if the three that were missing go missing again —
    a length alone would be satisfied by any ten columns.
  */
  assert.equal(PAPIC_KEY_COLUMNS.length, 10);
  for (const col of ['safe_display_r2_key', 'safe_tile_r2_key', 'safe_thumb_r2_key'] as const) {
    assert.ok(
      (PAPIC_KEY_COLUMNS as readonly string[]).includes(col),
      `${col} is not swept — the face-blocked copy a PUBLIC surface may show stays fetchable`,
    );
  }
  const p = planEventMediaDeletes({ eventId: E, photos: [photo], guestCaptures: [], captures: [], event: null });
  assert.equal(
    p.deletes.length,
    10,
    'a derivative is not collected — the photograph stays fetchable at a derivative address',
  );
});

test('a GUEST’s uploads are swept too — their rows cascade and their files did not', () => {
  /*
    🔑 THE TABLE WAS NOT READ AT ALL. `papic_guest_captures.event_id` is
    ON DELETE CASCADE, so removing the celebration took every row and left every
    file — permanently orphaned, with nothing able to name it. The tenant is the
    GUEST, not the event: the writer files under `papic/guest/<guest_id>/`, so a
    planner that pinned these to the event's folder would refuse all of them,
    which is the failure this asserts against in both directions.
  */
  const G = 'a1000000-0000-4000-8000-000000000001';
  const p = planEventMediaDeletes({
    eventId: E,
    photos: [],
    guestCaptures: [
      {
        guest_id: G,
        r2_object_key: `r2://setnayan-media/papic/guest/${G}/papic-1.jpg`,
        safe_display_r2_key: `r2://setnayan-media/derivatives/papic/guest/${G}/papic-1.jpg.safe-display.avif`,
      },
    ],
    captures: [],
    event: null,
  });
  assert.deepEqual(planned(p), [
    `setnayan-media/derivatives/papic/guest/${G}/papic-1.jpg.safe-display.avif`,
    `setnayan-media/papic/guest/${G}/papic-1.jpg`,
  ], 'a guest’s uploaded photographs survive the celebration being removed');
  assert.equal(p.refused, 0);
});

test('a guest capture belonging to ANOTHER guest is refused, not swept', () => {
  const G = 'a1000000-0000-4000-8000-000000000001';
  const OTHER = 'a1000000-0000-4000-8000-000000000002';
  const p = planEventMediaDeletes({
    eventId: E,
    photos: [],
    guestCaptures: [
      { guest_id: G, r2_object_key: `r2://setnayan-media/papic/guest/${OTHER}/papic-1.jpg` },
      // No readable tenant at all — must admit nothing rather than everything.
      { guest_id: null, r2_object_key: `r2://setnayan-media/papic/guest/${G}/papic-2.jpg` },
    ],
    captures: [],
    event: null,
  });
  assert.deepEqual(p.deletes, []);
  assert.equal(p.refused, 2);
});

test('a bare key with no r2:// prefix is refused, never guessed into a bucket', () => {
  const p = planEventMediaDeletes({
    eventId: E,
    photos: [{ r2_object_key: `papic/event-${E}/seat-s/a.jpg` }],
    guestCaptures: [],
    captures: [],
    event: { landing_page_hero_image_url: 'https://cdn.example.com/hero.jpg' },
  });
  assert.deepEqual(p.deletes, []);
  assert.equal(p.refused, 2);
});

test('the celebration’s own files ARE planned — photos, derivatives and site media', () => {
  const p = planEventMediaDeletes({
    eventId: E,
    photos: [
      {
        r2_object_key: `r2://setnayan-media/papic/event-${E}/seat-s/a.jpg`,
        display_r2_key: `r2://setnayan-media/derivatives/papic/event-${E}/seat-s/a.jpg.display.avif`,
      },
    ],
    guestCaptures: [],
    captures: [],
    event: {
      site_bg_music_r2_key: `r2://setnayan-media/events/${E}/site-music/a.mp3`,
      pakanta_song_r2_key: `r2://setnayan-media/events/${E}/pakanta-song/s.mp3`,
      our_photos: [`r2://setnayan-media/events/${E}/our-photos/1.jpg`, { r2_key: `r2://setnayan-media/events/${E}/our-photos/1.jpg` }],
    },
  });
  assert.deepEqual(planned(p), [
    `setnayan-media/derivatives/papic/event-${E}/seat-s/a.jpg.display.avif`,
    `setnayan-media/events/${E}/our-photos/1.jpg`,
    `setnayan-media/events/${E}/pakanta-song/s.mp3`,
    `setnayan-media/events/${E}/site-music/a.mp3`,
    `setnayan-media/papic/event-${E}/seat-s/a.jpg`,
  ], 'the celebration’s own files are not being removed — the owner’s 2026-08-20 ruling is broken');
  assert.equal(p.refused, 0);
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

test('a supplier’s own captures are swept too — the rows cascade, the files do not', () => {
  // `vendor_papic_captures.event_id` is ON DELETE CASCADE, so the rows go with
  // the celebration and take the only record of which objects those were. The
  // owner's 2026-08-20 ruling did not say "except the ones a supplier took".
  const src = read(SWEEP);
  const collectorStart = src.indexOf('export async function collectEventMediaRefs');
  const captureRead = src.indexOf(".from('vendor_papic_captures')");
  assert.ok(
    collectorStart > -1 && captureRead > collectorStart,
    'the capture read must sit inside the collector, which runs before the delete',
  );
  assert.deepEqual([...VENDOR_CAPTURE_KEY_COLUMNS], ['r2_object_key', 'poster_r2_key']);
  // Behaviour: pinned to supplier AND celebration.
  const base = `r2://setnayan-media/papic/vendor-${V}/event-${E}/cap-1`;
  const p = planEventMediaDeletes({
    eventId: E,
    photos: [],
    guestCaptures: [],
    captures: [
      { vendor_profile_id: V, r2_object_key: `${base}.mp4`, poster_r2_key: `${base}-poster.jpg` },
      // The same supplier's capture at ANOTHER celebration, forged onto this row.
      { vendor_profile_id: V, r2_object_key: `r2://setnayan-media/papic/vendor-${V}/event-${E2}/cap-9.jpg` },
    ],
    event: null,
  });
  assert.deepEqual(planned(p), [
    `setnayan-media/papic/vendor-${V}/event-${E}/cap-1-poster.jpg`,
    `setnayan-media/papic/vendor-${V}/event-${E}/cap-1.mp4`,
  ]);
  assert.equal(p.refused, 1);
});

test('a refused capture read is not an empty one', () => {
  // Same rule the papic and events reads already follow: `null` means "we
  // looked and could not see", and the caller must not report "nothing to
  // remove" from a read that fell over.
  const src = read(SWEEP);
  assert.match(
    src,
    /if \(captureErr\) return null;/,
    'A failed capture read now degrades to "no supplier files", which is a ' +
      'claim the query never earned.',
  );
});
