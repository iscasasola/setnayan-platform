/**
 * preserve-picks-reach-the-sweep.test.ts — does the couple's per-capture choice
 * actually ARRIVE at the code that acts on it?
 *
 * ## Why this file exists beside preserve-picks.test.ts
 *
 * `preserve-picks.test.ts` reads the sweep as a STRING and regex-matches it. It
 * proves the column is selected and that the gate is written per capture — and it
 * passed green through the entire life of a defect it was written to prevent. Its
 * own failure message describes the exact state that shipped:
 *
 *   *"or, worse, the column is undefined and the skip silently inverts"*
 *
 * That is precisely what happened. `preserve_declined_at` was OPTIONAL on
 * `PapicDropItem` and **none of the four production mappers assigned it**, so
 * every real sweep Item carried `undefined`. The gate `keep && !it.preserve_
 * declined_at` then read `!undefined === true` for every capture, collapsing the
 * per-capture choice back into the old all-or-nothing per-event behaviour. A
 * couple could decline a capture and the sweep would preserve it anyway. The
 * picker was a control that changed no outcome.
 *
 * A source-text guard cannot see that, because nothing in the source text is
 * wrong. The bug lives in a field that is absent — and absence is invisible to a
 * regex looking for presence. So this file EXECUTES the production mappers over
 * rows shaped exactly as the real SELECTs return them, and asserts the decision
 * flips BOTH ways.
 *
 * 🔑 Same disease as the phantom column, the phantom enum value, the phantom RPC
 * argument and the blocked iframe: the only symptom is an absence.
 *
 * ## The division of labour between the two files
 *
 * The sweep is `server-only`, so it cannot be imported into a node test. This
 * file therefore mirrors the sweep's one-line preservation gate (`sweepWouldSkip`
 * below) and drives it with REAL Items. The mirror cannot drift, because
 * `preserve-picks.test.ts`'s *"the skip is PER CAPTURE"* test pins that exact
 * line in the sweep's source. Neither file is sufficient alone; together they
 * cover the text and the behaviour.
 *
 * ⚠ VOCABULARY. Declining is not deleting. It lets one ORIGINAL be replaced by
 * its compressed copy at the point already locked. The photo is never deleted and
 * the compressed copy is kept five years for everyone, paid or not. The owner has
 * corrected this twice — say "compressed", never "deleted".
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  guestClipItem,
  guestPhotoItem,
  seatClipItem,
  seatPhotoItem,
  type PapicDropItem,
} from './papic-fullres-drop-core';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Executed code only — a comment must never satisfy a check. */
const code = (p: string) =>
  readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const SWEEP = code(join(WEB, 'lib/papic-fullres-drop.ts'));

const DECLINED = '2026-08-10T04:00:00.000Z';

type Row = Record<string, unknown>;

// ── Rows shaped EXACTLY as each production SELECT returns them ───────────────
// Every field below appears in the corresponding `.select(...)` list in
// papic-fullres-drop.ts. Building the Item from anything richer would hide the
// very class of bug this file exists for.

/** papic_photos PHOTO row — the seat photo SELECT. */
const seatPhotoRow = (over: Row = {}): Row => ({
  photo_id: 'ph-1',
  event_id: 'evt-1',
  r2_object_key: 'event-abc/papic/seat.jpg',
  display_r2_key: 'r2://setnayan-media/derivatives/event-abc/seat-display.avif',
  orig_bytes: 5_000_000,
  captured_at: '2026-02-01T02:00:00.000Z',
  full_res_dropped_at: null,
  preserve_declined_at: null,
  ...over,
});

/** papic_guest_captures PHOTO row — the guest photo SELECT. */
const guestPhotoRow = (over: Row = {}): Row => ({
  capture_id: 'cap-1',
  event_id: 'evt-1',
  r2_object_key: 'event-abc/papic/guest.jpg',
  display_r2_key: 'r2://setnayan-media/derivatives/event-abc/guest-display.avif',
  orig_bytes: 4_000_000,
  captured_at: '2026-02-01T02:00:00.000Z',
  full_res_dropped_at: null,
  preserve_declined_at: null,
  ...over,
});

/** papic_photos CLIP row — the seat clip SELECT. */
const seatClipRow = (over: Row = {}): Row => ({
  photo_id: 'ph-2',
  event_id: 'evt-1',
  photo_type: 'clip',
  r2_object_key: 'r2://setnayan-media/papic/seat/clip.mp4',
  display_r2_key: 'r2://setnayan-media/papic/seat/clip-poster.jpg',
  poster_r2_key: 'r2://setnayan-media/papic/seat/clip-poster.jpg',
  clip_web_r2_key: 'r2://setnayan-media/papic/seat/clip-web.mp4',
  clip_web_bytes: 480_000,
  orig_bytes: 7_000_000,
  captured_at: '2026-02-01T02:00:00.000Z',
  full_res_dropped_at: null,
  preserve_declined_at: null,
  ...over,
});

/** papic_guest_captures CLIP row — the guest clip SELECT. */
const guestClipRow = (over: Row = {}): Row => ({
  capture_id: 'cap-2',
  event_id: 'evt-1',
  media_type: 'clip',
  r2_object_key: 'r2://setnayan-media/papic/guest/clip.mp4',
  display_r2_key: 'r2://setnayan-media/papic/guest/clip-poster.jpg',
  poster_r2_key: 'r2://setnayan-media/papic/guest/clip-poster.jpg',
  clip_web_r2_key: 'r2://setnayan-media/papic/guest/clip-web.mp4',
  clip_web_bytes: 512_000,
  orig_bytes: 8_000_000,
  captured_at: '2026-02-01T02:00:00.000Z',
  full_res_dropped_at: null,
  preserve_declined_at: null,
  ...over,
});

const MAPPERS = [
  { name: 'seatPhotoItem', map: seatPhotoItem, row: seatPhotoRow },
  { name: 'guestPhotoItem', map: guestPhotoItem, row: guestPhotoRow },
  { name: 'seatClipItem', map: seatClipItem, row: seatClipRow },
  { name: 'guestClipItem', map: guestClipItem, row: guestClipRow },
] as const;

/**
 * The sweep's preservation gate, mirrored over a REAL Item. `true` = this capture
 * is SKIPPED, i.e. its original keeps full resolution this sweep.
 *
 * Mirrors `if (keep && !it.preserve_declined_at)` in papic-fullres-drop.ts, whose
 * literal source text is pinned by preserve-picks.test.ts. `keepActive` is the
 * event's paid Keep-Full-Res entitlement (eventSkuActive HIGH_RES_ARCHIVE).
 */
const sweepWouldSkip = (it: PapicDropItem, keepActive: boolean): boolean =>
  keepActive && !it.preserve_declined_at;

// ── THE DEFECT, EXECUTED: the field must survive the mapper ──────────────────

test('EXECUTING: every production mapper CARRIES the couple\'s choice onto the Item', () => {
  for (const { name, map, row } of MAPPERS) {
    const declined = map(row({ preserve_declined_at: DECLINED }));
    assert.equal(
      declined.preserve_declined_at,
      DECLINED,
      `${name} dropped preserve_declined_at on the floor. The row carries the ` +
        'couple\'s choice and the Item does not, so the sweep reads undefined — ' +
        'which is indistinguishable from "they chose nothing". This is the exact ' +
        'defect that shipped: a picker that changes no outcome.',
    );

    const preserved = map(row());
    assert.equal(
      preserved.preserve_declined_at,
      null,
      `${name} must normalise an absent decline to null, never undefined — ` +
        'undefined is what made the bug invisible.',
    );
  }
});

// ── THE CONSEQUENCE, BOTH WAYS ──────────────────────────────────────────────

test('EXECUTING: a DECLINED capture is not skipped — its original may be compressed', () => {
  for (const { name, map, row } of MAPPERS) {
    const item = map(row({ preserve_declined_at: DECLINED }));
    assert.equal(
      sweepWouldSkip(item, true),
      false,
      `${name}: the couple took this capture OUT of preservation on a PAID event, ` +
        'so the sweep must be allowed to replace its original with the compressed ' +
        'copy. Skipping it means the choice did nothing.',
    );
  }
});

test('EXECUTING: an un-declined capture on a paid event IS skipped — "pick nothing, keep all"', () => {
  for (const { name, map, row } of MAPPERS) {
    const item = map(row());
    assert.equal(
      sweepWouldSkip(item, true),
      true,
      `${name}: nothing was declined, so everything is preserved. Paying protects ` +
        'a couple from the moment they pay, not from the moment they remember to ' +
        'tick boxes.',
    );
  }
});

test('EXECUTING: without the paid entitlement the choice changes nothing either way', () => {
  // The decline is not an instruction to compress — it is only the withdrawal of
  // a protection that an unpaid event never had. An unpaid event's originals are
  // swept on the normal clock whatever the couple picked.
  for (const { name, map, row } of MAPPERS) {
    assert.equal(sweepWouldSkip(map(row()), false), false, `${name} unpaid + kept`);
    assert.equal(
      sweepWouldSkip(map(row({ preserve_declined_at: DECLINED })), false),
      false,
      `${name} unpaid + declined`,
    );
  }
});

// ── VIDEO IS NOT AN AFTERTHOUGHT (owner: "chosen photos AND videos") ─────────

test('EXECUTING: a clip Item carries the choice exactly as a photo Item does', () => {
  // The clip SELECTs omitted the column entirely while the photo SELECTs carried
  // it, so preservation applied to photos and could never apply to video. The
  // mappers are the second half of that path; both halves must agree.
  const photo = seatPhotoItem(seatPhotoRow({ preserve_declined_at: DECLINED }));
  const clip = seatClipItem(seatClipRow({ preserve_declined_at: DECLINED }));
  assert.equal(clip.preserve_declined_at, photo.preserve_declined_at);
  assert.equal(sweepWouldSkip(clip, true), sweepWouldSkip(photo, true));
});

test('THE CLIP SELECTS FETCH THE COLUMN — a row without it can only read as "kept"', () => {
  // preserve-picks.test.ts pins the two PHOTO selects only (its regexes anchor on
  // `.select('photo_id…` / `.select('capture_id…`, which the multi-line clip
  // selects do not match). This closes the other half — and does it by DERIVING
  // the list of capture queries from the source rather than hand-typing four
  // pins, so a fifth query cannot be added without being covered.
  const captureSelects = [
    ...SWEEP.matchAll(
      /\.from\('(papic_photos|papic_guest_captures)'\)\s*\.select\(\s*('[^']*')\s*,?\s*\)/g,
    ),
  ];
  assert.equal(
    captureSelects.length,
    4,
    'expected exactly four capture SELECTs in the sweep (seat photo, guest photo, ' +
      'seat clip, guest clip). If a query was added, removed or reshaped, this ' +
      'guard must be re-pointed — not deleted.',
  );
  for (const [, table, list] of captureSelects) {
    assert.ok(
      list.includes('preserve_declined_at'),
      `the ${table} capture SELECT stopped fetching preserve_declined_at. The ` +
        'column then arrives undefined, every capture reads as "not declined", ' +
        'and the couple\'s choice silently stops reaching the sweep.',
    );
  }
});

// ── THE TYPE IS THE MECHANISM ───────────────────────────────────────────────

test('the field is REQUIRED on the Item type, so a future mapper cannot forget it', () => {
  const core = readFileSync(join(WEB, 'lib/papic-fullres-drop-core.ts'), 'utf8');
  assert.ok(
    /preserve_declined_at:\s*string\s*\|\s*null;/.test(core),
    'preserve_declined_at must be a REQUIRED field on PapicDropItem.',
  );
  assert.ok(
    !/preserve_declined_at\?:/.test(core),
    'preserve_declined_at is optional again. Optional is how it shipped, and ' +
      'optional is why four mappers could all forget it while the compiler stayed ' +
      'silent. Required is the mechanism that makes the next mapper fail to build ' +
      'instead of quietly disarming the picker.',
  );
});
