/**
 * THE SEAT-RELEASE PIN.
 *
 * `event_seat_assignments` has an ON DELETE CASCADE foreign key to `guests` —
 * so a HARD delete cleans up after itself. This app never hard-deletes a guest.
 * It sets `deleted_at`, and **a soft delete does not fire a cascade**, so the
 * assignment row survives its guest unless the code deletes it explicitly.
 *
 * ─── WHY AN ORPHANED ASSIGNMENT IS WORSE THAN IT SOUNDS ──────────────────
 * It is invisible AND it still counts. Both seat editors join assignments to
 * LIVING guests, so the chair renders empty and nothing on screen is wrong.
 * But `computeAutoSeat` and `reconcileProvisionalSeats` read
 * `event_seat_assignments` directly, so they still see that seat as occupied:
 *
 *   · the chair is never auto-filled again, for the life of the event
 *   · nothing anywhere says why
 *   · the unique constraint is only (event_id, guest_id), so a manual drop
 *     onto that chair DOUBLE-BOOKS it
 *
 * Four paths got this right and two did not — `removeGuestAction` and
 * `linkGuestAction` in the claims queue, both reachable in normal use because
 * `applyReconcileForEvent` gap-fills unlisted joiners into chairs from the
 * public RSVP path. This file is why the next one cannot.
 *
 * ─── WHY IT IS A SOURCE SCAN ─────────────────────────────────────────────
 * The defect is a MISSING statement. There is no return value to assert on and
 * no rendered output to check — the bug is silent by construction, which is
 * precisely the kind that needs the code itself read.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');

/**
 * Every file that soft-deletes a row from `guests`. Listed rather than globbed
 * so that ADDING a soft-delete somewhere new is a deliberate edit to this list,
 * not something a glob quietly absorbs — the same reason `STUDIO_APPS` pins its
 * own count. The "no soft-delete outside this list" test below is what keeps
 * the list honest.
 */
const SOFT_DELETERS = [
  join(APP, 'dashboard', '[eventId]', 'guests', 'claims', 'actions.ts'),
  join(APP, 'dashboard', '[eventId]', 'guests', 'groups-actions.ts'),
  join(APP, 'dashboard', '[eventId]', 'guests', '[guestId]', 'actions.ts'),
];

/**
 * Strip comments so a docblock mentioning the table cannot satisfy a check.
 *
 * ⚠ USE THE REPO'S ONE STRIPPER. The first draft here hand-rolled the usual
 * two-replace regex, and `lint-one-comment-stripper` refused it — correctly.
 * That shape strips BLOCK comments first, so a line comment containing `video/*`
 * opens a block that closes at the next real `*​/` and blanks everything
 * between. The guard then asserts against a blank and PASSES. A scan that can
 * be silently emptied is worse than no scan.
 */
const code = stripComments;

/**
 * The soft-delete statements in one file: a `.update()` on `guests` that SETS
 * `deleted_at`.
 *
 * ⚠ IT MUST BE THE UPDATE, NOT THE COLUMN NAME. The first version of this
 * matched `.from('guests')` followed by `deleted_at` within 200 characters,
 * which also matched every `.select('… deleted_at')` and `.is('deleted_at',
 * null)` — reads, not deletes. It reported 4 soft-deletes in a file that has 2
 * and failed against correct code. A guard that miscounts in the safe direction
 * is still a guard nobody can trust.
 *
 * ⚠ AND `deleted_at: null` IS A RESTORE, NOT A DELETE. The second version still
 * counted `restoreDeletedGuests` — which sets the column back to NULL and
 * correctly UPSERTS the seat row — as a soft delete, and reported a file with
 * two deletes and two releases as having three deletes. Hence the `(?!null)`.
 * Both misses were the guard being wrong about correct code, which is the
 * failure mode a source scan is most prone to and the reason each tightening is
 * written down instead of quietly applied.
 */
/**
 * Every `.update()` on `guests` and the object it writes. Parsed in two steps
 * rather than one clever regex, because two clever ones were wrong:
 *
 *  1. matching `.from('guests')` … `deleted_at` within 200 chars also matched
 *     `.select('… deleted_at')` and `.is('deleted_at', null)` — READS. It
 *     reported 4 deletes in a file with 2.
 *  2. adding a `(?!null)` lookahead after `deleted_at:\s*` did nothing, because
 *     `\s*` can match ZERO characters — so the lookahead was tested against the
 *     space, not against `null`, and `restoreDeletedGuests` (which sets the
 *     column BACK to null and correctly re-upserts the seat) still counted as a
 *     delete.
 *
 * Both misses were the guard being wrong about correct code. That is the
 * failure mode a source scan is most prone to, so the check is now boring:
 * capture the update object, then read it.
 */
const GUEST_UPDATE_RE = /\.from\(\s*'guests'\s*\)\s*\.update\(\s*\{([^}]*)\}/g;

function softDeleteCount(src: string): number {
  let n = 0;
  for (const m of src.matchAll(GUEST_UPDATE_RE)) {
    const body = m[1] ?? '';
    if (!/\bdeleted_at\s*:/.test(body)) continue; // not touching the flag
    if (/\bdeleted_at\s*:\s*null\b/.test(body)) continue; // a RESTORE, not a delete
    n += 1;
  }
  return n;
}

/** Explicit seat releases: `.from('event_seat_assignments')` … `.delete()`. */
function seatReleaseCount(src: string): number {
  return [...src.matchAll(/\.from\(\s*'event_seat_assignments'\s*\)[\s\S]{0,120}?\.delete\(\)/g)]
    .length;
}

test('every file that soft-deletes a guest also releases seats — at least as often', () => {
  for (const file of SOFT_DELETERS) {
    const src = code(readFileSync(file, 'utf8'));
    const deletes = softDeleteCount(src);
    const releases = seatReleaseCount(src);
    const name = file.slice(file.indexOf('app/'));

    assert.ok(deletes > 0, `${name}: expected to soft-delete a guest — has this file moved?`);
    assert.ok(
      releases >= deletes,
      `${name}: ${deletes} guest soft-delete(s) but only ${releases} seat release(s).\n\n` +
        'A soft delete does NOT fire the ON DELETE CASCADE, so the assignment row\n' +
        'outlives its guest. The chair then renders EMPTY (both editors join to\n' +
        'living guests) while computeAutoSeat still counts it as OCCUPIED — so it\n' +
        'is never auto-filled again, nothing says why, and a manual drop onto it\n' +
        'double-books the seat.\n\n' +
        "Delete from 'event_seat_assignments' for that guest FIRST, as the other\n" +
        'paths do (see the note above bulkSoftDeleteGuests in groups-actions.ts).',
    );
  }
});

test('the claims queue specifically — remove AND link both release', () => {
  // These two are named because they are the two that were wrong, and they are
  // reachable in normal use: applyReconcileForEvent gap-fills unlisted joiners
  // into chairs from the public RSVP path, so a claims-queue guest usually HAS
  // a seat by the time the couple removes or merges them.
  const src = code(
    readFileSync(join(APP, 'dashboard', '[eventId]', 'guests', 'claims', 'actions.ts'), 'utf8'),
  );
  for (const fn of ['removeGuestAction', 'linkGuestAction']) {
    const start = src.indexOf(`export async function ${fn}`);
    assert.ok(start > 0, `${fn} not found — has it been renamed?`);
    // Window: this function up to the next exported one (or EOF).
    const next = src.indexOf('export async function ', start + 1);
    const body = src.slice(start, next === -1 ? undefined : next);
    assert.match(
      body,
      /\.from\(\s*'event_seat_assignments'\s*\)[\s\S]{0,120}?\.delete\(\)/,
      `${fn} soft-deletes a guest without releasing their seat. That strands an ` +
        'assignment which renders empty but still counts as occupied.',
    );
    // …and it must come BEFORE the soft-delete, matching the bulk path: a guest
    // row outliving a failed seat-DELETE is recoverable; the reverse is not.
    const release = body.search(/\.from\(\s*'event_seat_assignments'\s*\)/);
    const soften = [...body.matchAll(GUEST_UPDATE_RE)]
      .filter((m) => /\bdeleted_at\s*:/.test(m[1] ?? '') && !/\bdeleted_at\s*:\s*null\b/.test(m[1] ?? ''))
      .map((m) => m.index ?? -1)[0] ?? -1;
    assert.ok(
      release < soften,
      `${fn} releases the seat AFTER the soft-delete. Order matters: if the ` +
        'release fails, a still-live guest with no seat is fixable by hand, ' +
        'whereas a deleted guest holding a seat is the invisible state.',
    );
  }
});

test('no OTHER file soft-deletes a guest without this file knowing', () => {
  // The list above is only trustworthy if nothing outside it does this. Walk the
  // app tree and fail on a soft-delete of `guests` in an unlisted file — that is
  // a new path that has not been checked for seat release.
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  const known = new Set(SOFT_DELETERS);
  const offenders: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry) || /\.test\./.test(entry)) continue;
      if (known.has(full)) continue;
      if (softDeleteCount(code(readFileSync(full, 'utf8'))) > 0) {
        offenders.push(full.slice(full.indexOf('app/')));
      }
    }
  };
  walk(APP);

  assert.deepEqual(
    offenders,
    [],
    `These files soft-delete a guest but are not in SOFT_DELETERS, so nothing ` +
      `checked whether they release the seat:\n  ${offenders.join('\n  ')}\n\n` +
      'Add the seat release, then add the file to the list above.',
  );
});
