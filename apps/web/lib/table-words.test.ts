/**
 * table-words.test.ts — ONE "Table" word next to a guest, never two.
 *
 * Owner, live on maria-and-jose at 375 px (2026-10-05): the bride's and the
 * groom's rows read "Table Sweetheart Table", cut off at the card's edge. The
 * rows prefixed every table name with "Table ", whatever the couple had called
 * it. The real labels on that event are the fixtures below.
 *
 *   (1) the rule itself, executed on the event's real table names;
 *   (2) every surface on the Guests route and the check-in desk that writes a
 *       table name next to a guest goes through `tableWords` — no
 *       `Table ${…}` template literal is left to prefix a name a second time.
 *
 * (2) is a comment-stripped source scan: the hazard is a template literal that
 * is PRESENT, and the files' own comments may quote the bad string.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { tableWords } from '@/lib/table-words';

test('(1) a bare number gets the word; a named table is printed as named', () => {
  // maria-and-jose's real table names (read 2026-10-05).
  assert.equal(tableWords('Sweetheart Table'), 'Sweetheart Table');
  assert.equal(tableWords('Table 9'), 'Table 9');
  assert.equal(tableWords('Entourage'), 'Entourage');
  assert.equal(tableWords('Family of the Bride'), 'Family of the Bride');
  assert.equal(tableWords('Principal Sponsors 1'), 'Principal Sponsors 1');
  assert.equal(tableWords('Friends — Barkada'), 'Friends — Barkada');
  // A table the couple numbered only.
  assert.equal(tableWords('7'), 'Table 7');
  assert.equal(tableWords(' 12 '), 'Table 12');
  for (const label of ['Sweetheart Table', 'Table 9', '7']) {
    assert.equal(
      (tableWords(label).match(/\bTable\b/g) ?? []).length,
      1,
      `"${label}" must carry exactly one "Table" word`,
    );
  }
});

/** Every .ts/.tsx under a directory, recursively. */
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('(2) no guest row, card, heading or check-in line prefixes a table name itself', () => {
  const root = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
  const files = filesUnder(root);
  // The scan must SEE the surfaces it is about — a moved folder would make it
  // pass over nothing.
  for (const must of ['guest-list-multiselect.tsx', 'guest-card-body.tsx', 'page.tsx', 'checkin-desk.tsx']) {
    assert.ok(
      files.some((f) => f.endsWith(must)),
      `${must} is no longer under the Guests route — re-anchor this guard`,
    );
  }
  const offenders: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/`[^`\n]*?\bTable\s*[·:\-]?\s*\$\{[^}]*\}|>\s*Table\s*[·:\-]?\s*\{[^}]*\}/g)) {
      offenders.push(`${f.slice(root.length + 1)}: ${m[0]}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'A table name is prefixed with "Table " by hand. A couple\'s "Sweetheart Table" ' +
      'then reads "Table Sweetheart Table" (and "Table 9" reads "Table Table 9"). ' +
      'Write it through tableWords() from lib/table-words.ts.',
  );
});

test('(2) the phone row never lets a table name run off the card', () => {
  const list = stripComments(
    readFileSync(
      join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-list-multiselect.tsx'),
      'utf8',
    ),
  );
  const row = list.slice(list.indexOf('function MobileListRow('), list.indexOf('function SwipeToDelete('));
  assert.ok(row.length > 0, 'MobileListRow moved — re-anchor this guard');
  assert.match(row, /tableWords\(seat\.placed\)/, 'the row writes the table without tableWords');
  const span = /<span[^>]*data-row-table=""[^>]*>/.exec(row)?.[0] ?? '';
  assert.ok(span, 'the row lost its table span');
  assert.match(span, /\btruncate\b/, 'a name wider than the card is clipped mid-word instead of ending in "…"');
  assert.match(span, /\bmax-w-full\b/, 'a table name can be wider than the card');
  assert.doesNotMatch(span, /whitespace-nowrap|shrink-0/, 'the table span is unshrinkable again');
  // The line WRAPS the table under it when it does not fit, instead of pushing
  // it past the card's edge; the editors keep their words whole.
  assert.match(row, /<div className="flex flex-wrap items-center gap-x-1\.5 gap-y-0\.5">/);
  assert.match(row, /<span className="flex shrink-0 items-center gap-1\.5">/);
  assert.doesNotMatch(row, /flex w-max items-center gap-1\.5/, 'the line is max-content again, so the table runs off the card');
});
