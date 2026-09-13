/**
 * A HOST'S "DELETE THIS PHOTO" REALLY DELETES IT — proved by calling the planner
 * and by pinning the few things about the action that a call cannot reach.
 *
 * Owner ruled 2026-08-10: *"Delete a photo" means DELETE EVERYWHERE — genuine
 * erasure, the one exception to the compress-never-delete rule.* Until
 * 2026-09-13 the host's only controls wrote `hidden_at`.
 *
 * ─── WHY HALF OF THIS IS A SOURCE PIN AND HALF IS NOT ──────────────────────
 * `planPapicRowDeletes` is pure, so which files a delete reaches is EXECUTED
 * here against refs shaped exactly like the real writers produce. What cannot be
 * executed is the server action itself — `actions.ts` is `'use server'` and
 * imports `server-only` transitively, so `tsx --test` cannot import it. For that
 * half the properties that can be got wrong are pinned against the SOURCE with
 * comments stripped, so a sentence in a docblock can never satisfy an assertion
 * about code.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { EVENT_MEDIA_KEY_SETS, planPapicRowDeletes } from './event-media-sweep-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = resolve(
  HERE,
  '../app/dashboard/[eventId]/studio/papic/moderation/actions.ts',
);
const SWEEP = resolve(HERE, 'event-media-sweep.ts');
const PAGE = resolve(
  HERE,
  '../app/dashboard/[eventId]/studio/papic/moderation/page.tsx',
);
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

const E = 'e1000000-0000-4000-8000-000000000001';
const E2 = 'e1000000-0000-4000-8000-000000000002';
const G = 'a1000000-0000-4000-8000-000000000001';
const G2 = 'a1000000-0000-4000-8000-000000000002';
const planned = (p: ReturnType<typeof planPapicRowDeletes>) =>
  p.deletes.map((d) => `${d.bucket}/${d.key}`).sort();

// ─── What the delete reaches ────────────────────────────────────────────────

test('a seat photo’s delete reaches EVERY key the row carries, not just the original', () => {
  /*
    A photograph is ten files. Deleting only `r2_object_key` leaves the display,
    tile, thumbnail, poster, web clip, wall-safe and three face-blocked copies
    fetchable at their own plain URLs — the same defect as hiding, one layer
    down. The row is built from the key list itself so a new column cannot be
    added to the schema and quietly skipped by this test too.
  */
  const row: Record<string, string> = {};
  for (const col of EVENT_MEDIA_KEY_SETS.papic) {
    const prefix = col === 'r2_object_key' ? '' : 'derivatives/';
    row[col] = `r2://setnayan-media/${prefix}papic/event-${E}/seat-s/a.${col}.bin`;
  }
  const p = planPapicRowDeletes({ table: 'papic_photos', eventId: E, row });
  assert.equal(p.refused, 0);
  assert.equal(
    p.deletes.length,
    EVENT_MEDIA_KEY_SETS.papic.length,
    'a copy of the photograph survives the host’s "delete forever"',
  );
});

test('a guest upload’s delete is pinned to the GUEST’s folder, and reaches all of it', () => {
  const row: Record<string, string> = {};
  for (const col of EVENT_MEDIA_KEY_SETS.papic) {
    const prefix = col === 'r2_object_key' ? '' : 'derivatives/';
    row[col] = `r2://setnayan-media/${prefix}papic/guest/${G}/a.${col}.bin`;
  }
  const p = planPapicRowDeletes({
    table: 'papic_guest_captures',
    eventId: E,
    guestId: G,
    row,
  });
  assert.equal(p.refused, 0);
  assert.equal(p.deletes.length, EVENT_MEDIA_KEY_SETS.papic.length);
});

test('the two tables’ tenants are NOT interchangeable — the wrong one refuses everything', () => {
  /*
    🔒 A seat photo lives under its EVENT, a guest upload under its GUEST. If the
    action ever passed the event as the guest tenant (or vice versa) the refs
    would not match, and the SAFE outcome is a refusal — never a delete under a
    guessed folder. This asserts the refusal rather than assuming it.
  */
  const guestRef = `r2://setnayan-media/papic/guest/${G}/a.jpg`;
  const seatRef = `r2://setnayan-media/papic/event-${E}/seat-s/a.jpg`;

  const wrongForGuest = planPapicRowDeletes({
    table: 'papic_photos',
    eventId: E,
    row: { r2_object_key: guestRef },
  });
  assert.deepEqual(wrongForGuest.deletes, []);
  assert.equal(wrongForGuest.refused, 1);

  const wrongForSeat = planPapicRowDeletes({
    table: 'papic_guest_captures',
    eventId: E,
    guestId: G,
    row: { r2_object_key: seatRef },
  });
  assert.deepEqual(wrongForSeat.deletes, []);
  assert.equal(wrongForSeat.refused, 1);
});

test('another wedding’s photograph is never deleted, even named from this row', () => {
  /*
    THE ROW IS YOURS, THE FIELD IS NOT. These key columns are writable by a
    non-admin, and this action runs with the admin client — so a host naming a
    stranger's object must be refused, not obeyed.
  */
  const p = planPapicRowDeletes({
    table: 'papic_photos',
    eventId: E,
    row: {
      r2_object_key: `r2://setnayan-media/papic/event-${E2}/seat-s/a.jpg`,
      display_r2_key: `r2://setnayan-media/papic/guest/${G2}/b.jpg`,
      thumb_r2_key: 'r2://setnayan-vendor-verification/vendors/v1/verification/gov.png',
      tile_r2_key: 'r2://setnayan-thread-files/chat/t1/a.pdf',
      poster_r2_key: `r2://setnayan-media/events/${E}/site-music/a.mp3`,
    },
  });
  assert.deepEqual(p.deletes, [], 'an object that is not this photograph’s own was planned for deletion');
  assert.equal(p.refused, 5);
});

test('a row with no readable tenant admits nothing', () => {
  const p = planPapicRowDeletes({
    table: 'papic_guest_captures',
    eventId: E,
    guestId: null,
    row: { r2_object_key: `r2://setnayan-media/papic/guest/${G}/a.jpg` },
  });
  assert.deepEqual(p.deletes, []);
  assert.equal(p.refused, 1);
});

test('the celebration sweep and the single-photo delete see the IDENTICAL key set', () => {
  /*
    🔑 THE POINT OF PUTTING BOTH PLANNERS IN ONE FILE. The list was copied once
    before and the copy was short by three. Building the row from the shared
    constant and asserting the plan's size against that same constant means a
    new derivative column reaches both paths or fails here.
  */
  const row: Record<string, string> = {};
  for (const col of EVENT_MEDIA_KEY_SETS.papic) {
    row[col] = `r2://setnayan-media/derivatives/papic/event-${E}/seat-s/a.${col}.bin`;
  }
  const single = planPapicRowDeletes({ table: 'papic_photos', eventId: E, row });
  assert.equal(single.deletes.length, EVENT_MEDIA_KEY_SETS.papic.length);
  assert.equal(EVENT_MEDIA_KEY_SETS.guestCapture.length, EVENT_MEDIA_KEY_SETS.papic.length);
});

// ─── What the action does with the plan ─────────────────────────────────────

test('the action deletes the OBJECTS before the ROW', () => {
  /*
    🪤 ANCHORED TO THE CALLS, NOT THE IDENTIFIERS — the imports at the top of the
    file name both, so an `indexOf` on a bare name compares two import lines.
    Clearing the pointer first leaves the file addressable with nothing left to
    say whose it was, which is the ordering vendor-identity-retention settled.
  */
  const src = read(ACTIONS);
  const exec = src.indexOf('await executeCleanupDelete(');
  const del = src.indexOf(".delete()", src.indexOf('deletePhotoForever'));
  assert.ok(exec > 0, 'the action does not delete any files');
  assert.ok(del > 0, 'the action does not delete the row');
  assert.ok(exec < del, 'the row is deleted before its files — the objects become unnameable');
});

test('a refused or failed file KEEPS the row — the deletion stays retryable', () => {
  /*
    The host is told the photograph is gone, so it must be gone. If a copy
    survived, dropping the row would strand exactly the files this action exists
    to remove, with nothing left able to name them.
  */
  const src = read(ACTIONS);
  assert.match(
    src,
    /if \(filesFailed > 0 \|\| plan\.refused > 0\)/,
    'a partly-failed delete still removes the row, orphaning the copies that survived',
  );
});

test('the row is read BEFORE the delete, and a refused read never deletes', () => {
  const src = read(ACTIONS);
  const body = src.slice(src.indexOf('export async function deletePhotoForever'));
  assert.match(
    body,
    /if \(readError\)[\s\S]{0,120}error=delete_failed/,
    'a refused read falls through to the delete — the keys would be lost with the row',
  );
});

test('the delete counts its rows — a zero-row delete is success-shaped', () => {
  /*
    PostgREST returns NO ERROR when the filters match nothing. Without
    `.select()` and a count, a photo id from another wedding would redirect to
    "Photo deleted. Every copy of it is gone."
  */
  const body = read(ACTIONS).slice(read(ACTIONS).indexOf('export async function deletePhotoForever'));
  assert.match(body, /\.select\(idColumn\)/, 'the delete does not ask for its rows back');
  assert.match(
    body,
    /!deleted \|\| deleted\.length === 0/,
    'the delete reports success without counting the rows it removed',
  );
});

test('both predicates bind the tenancy — id AND event, on the read and the delete', () => {
  /*
    ⚠ ONE QUERY, TWO PREDICATES: dropping `.eq('event_id', eventId)` alone leaves
    every other assertion here green while letting a host delete a photograph
    from another wedding. Counted, because the action issues exactly two such
    queries.
  */
  const body = read(ACTIONS).slice(read(ACTIONS).indexOf('export async function deletePhotoForever'));
  assert.equal(
    (body.match(/\.eq\('event_id', eventId\)/g) ?? []).length,
    2,
    'the read or the delete is not bound to this celebration',
  );
  assert.equal((body.match(/\.eq\(idColumn, id\)/g) ?? []).length, 2);
});

test('the host must be a couple on this event', () => {
  const body = read(ACTIONS).slice(read(ACTIONS).indexOf('export async function deletePhotoForever'));
  assert.match(body, /await requireCouple\(eventId\)/, 'the delete is not gated on the caller being a host');
});

test('the delete reaches the cached copies, like the hide path does', () => {
  const body = read(ACTIONS).slice(read(ACTIONS).indexOf('export async function deletePhotoForever'));
  assert.match(
    body,
    /await everyCopyIsNowStale\(eventId\)/,
    'the story, prints and share card keep showing a photograph that no longer exists',
  );
});

test('HIDE IS STILL THERE — delete did not replace the reversible option', () => {
  /*
    Owner: hiding is the recoverable thing a host usually wants. Losing it while
    adding erasure would be a regression dressed as a feature.
  */
  const src = read(ACTIONS);
  assert.match(src, /export async function setCaptureHidden/);
  assert.match(src, /export async function setSeatPhotoHidden/);
});

test('the celebration sweep actually READS the guest table — the planner cannot see this', () => {
  /*
    🪤 THE SABOTAGE THAT FOUND THIS ASSERTION. `planEventMediaDeletes` is pure:
    hand it an empty `guestCaptures` and it correctly plans nothing, so every
    behavioural test above stays green while the I/O half quietly stops reading
    the table — which is exactly the state main was in. The read is a fact about
    the query, so it is pinned against the query.
  */
  const src = read(SWEEP);
  assert.match(
    src,
    /\.from\('papic_guest_captures'\)/,
    'the celebration sweep does not read the guest uploads — their files outlive the wedding',
  );
  assert.match(
    src,
    /guestCaptures: \(guestCaptures \?\? \[\]\)/,
    'the guest rows are read but never handed to the planner',
  );
  assert.match(
    src,
    /\['guest_id', \.\.\.GUEST_CAPTURE_KEYS\]/,
    'guest_id is not selected — it is the tenant, and without it every ref is refused',
  );
});

// ─── What the host actually sees ────────────────────────────────────────────

test('BOTH photo kinds get the control, each naming its own table', () => {
  /*
    🪤 A FILE-LEVEL MATCH CANNOT SAY WHICH COMPONENT. A single mount would
    satisfy "the page has a delete button" while seat photos — the majority —
    kept having no way to be deleted. So the two hidden `table` inputs are
    counted separately.
  */
  const src = read(PAGE);
  assert.equal(
    (src.match(/deletePhotoForever\.bind\(null, eventId\)/g) ?? []).length,
    2,
    'only one of the two photo kinds can be deleted',
  );
  assert.equal((src.match(/value="papic_guest_captures"/g) ?? []).length, 1);
  assert.equal((src.match(/value="papic_photos"/g) ?? []).length, 1);
});

test('the control is behind a confirm that says it cannot be undone', () => {
  const src = read(PAGE);
  assert.equal(
    (src.match(/<ConfirmForm/g) ?? []).length,
    2,
    'an irreversible delete fires on a single accidental click',
  );
  assert.match(src, /cannot be undone/i);
});

test('a partial delete does NOT tell the host the photo is gone', () => {
  /*
    The row is kept on purpose when a file survives. Reusing the generic
    "something went wrong" sentence would leave a host believing a retry is
    cosmetic; reusing the SUCCESS sentence would be the original defect exactly.
  */
  const src = read(PAGE);
  assert.match(src, /search\.error === 'delete_partial'/);
  assert.match(src, /it is still here/i);
});
