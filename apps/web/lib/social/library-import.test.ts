/**
 * 📚 THE PLANNED LIBRARY IMPORTS ONCE, ONTO ITS SLOTS (owner, 28 Nov 2026: posting is automatic; the daily cap counts
 * planned posts). `scripts/social/import-library.ts` turns the library v2 CSV into one migration; these hold its
 * rules on the small fixture CSV. The database half (the SQL run twice inserts once) is
 * `tests/db/the-planned-library-imports-once.db.test.ts`.
 *
 * Sabotage (measured): dropping the NOT EXISTS guard turns the SQL-shape test red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  doorToUrl,
  type LibraryRow,
  libraryMigrationSql,
  libraryRowsFromCsv,
  librarySourceRef,
  normalizeManilaTime,
  parseCsv,
} from './library-import';

const fixture = readFileSync(join(__dirname, '__fixtures__', 'library-v2-sample.csv'), 'utf8');

test('the fixture parses: four slots, Manila times to UTC, quoted newlines and quotes kept', () => {
  const { rows: parsed, errors } = libraryRowsFromCsv(fixture);
  assert.deepEqual(errors, []);
  const rows = parsed as [LibraryRow, LibraryRow, LibraryRow, LibraryRow];
  assert.deepEqual(
    rows.map((r) => [r.date, r.slot, r.scheduledFor]),
    [
      ['2026-12-01', 'morning', '2026-12-01T00:00:00.000Z'],
      ['2026-12-01', 'evening', '2026-12-01T12:00:00.000Z'],
      ['2026-12-25', 'holiday', '2026-12-25T04:00:00.000Z'],
      ['2026-12-02', 'afternoon', '2026-12-02T06:00:00.000Z'],
    ],
  );
  assert.equal(rows[0].body, 'Plan it. Live it. Keep it.\nWhich one do you need most this month?');
  assert.equal(rows[1].body, `Ano'ng "set na 'yan" moment mo this week? 👇`);
  assert.equal(rows[0].title, 'What Setnayan is · The home of every Filipino celebration');
  assert.equal(rows[0].firstComment, 'Plan your event free at setnayan.com');
  assert.equal(rows[2].firstComment, null);
  assert.equal(rows[0].linkUrl, 'https://setnayan.com/');
  assert.equal(rows[1].linkUrl, 'https://setnayan.com/explore');
  assert.equal(rows[0].mediaUrl, 'https://example.org/a.jpg');
  assert.equal(rows[1].mediaUrl, null); // a folder path is not public: the branded card is used
});

test('source_ref is a stable hash of date + slot, and nothing else', () => {
  const a = librarySourceRef('2026-12-01', 'morning');
  assert.equal(a, librarySourceRef('2026-12-01', 'morning'));
  assert.match(a, /^lib-[0-9a-f]{24}$/);
  assert.notEqual(a, librarySourceRef('2026-12-01', 'evening'));
  assert.notEqual(a, librarySourceRef('2026-12-02', 'morning'));
  const edited = fixture.replace('Plan it. Live it. Keep it.', 'Edited caption.');
  assert.equal(libraryRowsFromCsv(edited).rows[0]?.sourceRef, a);
});

test('same CSV → same migration bytes (re-generating is safe)', () => {
  const once = libraryMigrationSql(libraryRowsFromCsv(fixture).rows, 'library-v2-sample.csv');
  const twice = libraryMigrationSql(libraryRowsFromCsv(fixture).rows, 'library-v2-sample.csv');
  assert.equal(once, twice);
  assert.match(once, /WHERE NOT EXISTS \(\n  SELECT 1 FROM public\.social_posts p\n   WHERE p\.source_type = 'library' AND p\.source_ref = v\.source_ref\n\)/);
  assert.match(once, /ON CONFLICT \(source_type, source_ref\) WHERE source_type != 'evergreen' AND status != 'pulled' DO NOTHING;/);
  assert.match(once, /'Ano''ng "set na ''yan" moment mo this week\? 👇'/);
});

test('bad rows are refused with their line, never guessed', () => {
  const header = 'Date,Time (Manila),Slot,Pillar,Caption (primary text),Link headline,Pinned first comment,Door,Images\n';
  const { rows, errors } = libraryRowsFromCsv(
    header +
      '2026-12-01,19:00,,P,"Off-slot time",,,,\n' +
      '2026-12-01,08:00,,P,"",,,,\n' +
      '01/12/2026,08:00,,P,"Bad date",,,,\n' +
      '2026-12-01,14:00,Holiday,P,"Holiday at 2 PM",,,,\n' +
      '2026-12-01,08:00,,P,"First",,,,\n' +
      '2026-12-01,8:00 AM,,P,"Second in the same slot",,,,\n',
  );
  assert.equal(rows.length, 1);
  assert.equal(errors.length, 5);
  assert.match(errors[0] ?? '', /^Line 2: time "19:00" is not a slot/);
  assert.match(errors[4] ?? '', /^Line 7: 2026-12-01 08:00 is already planned on line 6/);
});

test('missing columns stop the import', () => {
  assert.match(libraryRowsFromCsv('Date,Pillar\n2026-12-01,P\n').errors.join(' '), /no "time" column/);
});

test('times and doors read the way people type them', () => {
  assert.equal(normalizeManilaTime('8:00'), '08:00');
  assert.equal(normalizeManilaTime('2:00 PM'), '14:00');
  assert.equal(normalizeManilaTime('12:00 NN'), '12:00');
  assert.equal(normalizeManilaTime('8 PM'), null);
  assert.equal(doorToUrl('/plan'), 'https://setnayan.com/plan');
  assert.equal(doorToUrl('www.setnayan.com/for-suppliers'), 'https://setnayan.com/for-suppliers');
  assert.equal(doorToUrl('setnayan.com › Open your shop'), null);
  assert.deepEqual(parseCsv('a,"b\r\nc"\r\n'), [['a', 'b\r\nc']]);
});
