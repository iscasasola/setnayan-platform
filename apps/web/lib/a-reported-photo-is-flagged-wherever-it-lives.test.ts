import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

/**
 * The property: a photo somebody has reported is marked as reported on the
 * couple's moderation page, whichever of the two grids it lives in.
 *
 * ─── MEASURED ON PRODUCTION 2026-09-18 ───────────────────────────────────
 * The page fetched every `user_reports` row for the event into `reportedSet`
 * and then consulted that set in exactly ONE place — against a
 * `papic_guest_captures` id. The one real report targets a **`papic_photos`**
 * row, and its celebration holds **10 photos and 0 guest captures**:
 *
 *     select count(*) from papic_photos         where photo_id   = '1c178ae6…'  → 1
 *     select count(*) from papic_guest_captures where capture_id = '1c178ae6…'  → 0
 *     select count(*) from papic_photos         where event_id   = '0ccc7aa3…'  → 10
 *     select count(*) from papic_guest_captures where event_id   = '0ccc7aa3…'  → 0
 *
 * So the read happened on every page load and could never mark anything. A
 * guest asked for their likeness to come down, and the couple who own the
 * photograph were shown nothing.
 *
 * 🔑 The repo's signature disease, and the reason it survived review: the query
 * is there, the set is there, the badge is there. **The lookup was the missing
 * half**, and every piece around it looked correct.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const PAGE = 'app/dashboard/[eventId]/studio/papic/moderation/page.tsx';
const src = () => stripComments(readFileSync(join(WEB, PAGE), 'utf8'));

test('the report set is consulted for BOTH photo grids, not just one', () => {
  const s = src();
  // The two identifiers the two grids key on. Both must be asked.
  assert.match(
    s,
    /reportedSet\.has\(captureId\)/,
    'the guest-capture grid stopped checking for reports',
  );
  assert.match(
    s,
    /reportedSet\.has\(photoId\)/,
    'the seat-photo grid does not check for reports — a report filed against a ' +
      'papic_photos row is read from the database and then matched against a ' +
      'list it cannot appear in. This is the exact defect, restored.',
  );
});

test('every lookup of the set actually reaches a badge', () => {
  // A count, not a presence: one lookup was the whole bug. If a third grid is
  // added later it must bring its own, and this floor says how many there are.
  const s = src();
  const lookups = s.match(/reportedSet\.has\(/g) ?? [];
  const badges = s.match(/isReported &&/g) ?? [];
  assert.equal(
    lookups.length,
    2,
    `expected one lookup per photo grid (2), found ${lookups.length} — a grid ` +
      'was added or removed without its report check',
  );
  assert.equal(
    badges.length,
    lookups.length,
    `${lookups.length} lookups but ${badges.length} rendered badges — a set was ` +
      'consulted and its answer thrown away, which is the original bug wearing ' +
      'different clothes',
  );
});

test('the set is built from the whole event, not narrowed to one grid', () => {
  const s = src();
  // Why ONE set is correct for both grids: the query keys on the event and the
  // target TYPE, never on a table or a list of ids from one grid.
  const q = s.slice(s.indexOf(".from('user_reports')"));
  const call = q.slice(0, q.indexOf('),') + 2);
  assert.match(call, /\.eq\('event_id', eventId\)/, 'the report query is not scoped to this event');
  assert.match(call, /\.eq\('target_type', 'photo'\)/, 'the report query stopped selecting photo reports');
  // ⚠ NOT a proximity check on the neighbouring queries — my first attempt
  // asserted that `papic_guest_captures` did not appear within 200 characters,
  // and it failed on innocent adjacency inside the same Promise.all. The
  // property is that THIS call carries no per-grid narrowing.
  assert.doesNotMatch(
    call,
    /\.in\(\s*'target_id'/,
    'the report query was narrowed to ids from one grid, which re-creates the ' +
      'split this test exists to prevent',
  );
});
