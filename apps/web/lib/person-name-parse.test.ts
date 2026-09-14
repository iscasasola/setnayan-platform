/**
 * Every fixture below is a REAL row measured on prod 2026-09-14 (or the
 * owner's own reported example), not an invented string. If a rule in
 * `person-name-parse.ts` looks over-built, the case it exists for is here.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parsePersonName, formatPersonName } from './person-name-parse';

/** Compact reader: [input, prefix, first, middle, last, suffix]. */
type Case = [string, string, string, string, string, string];

function check(cases: Case[]) {
  for (const [input, prefix, firstName, middleName, lastName, suffix] of cases) {
    assert.deepEqual(
      parsePersonName(input),
      { prefix, firstName, middleName, lastName, suffix },
      `parsed "${input}" wrong`,
    );
  }
}

test('the owner reported example splits into all four parts', () => {
  check([['Atty. Bob Casasola Jr.', 'Atty.', 'Bob', '', 'Casasola', 'Jr.']]);
});

test('the guest that was reported no longer stores a title as a first name', () => {
  // Was: first_name='Mr.', last_name='Antonio Loo'.
  check([['Mr. Antonio Loo', 'Mr.', 'Antonio', '', 'Loo', '']]);
});

test('single-word honorifics come off the head', () => {
  check([
    ['Atty. Glenn Subia', 'Atty.', 'Glenn', '', 'Subia', ''],
    ['Dr. Maria Theresa Alonzo', 'Dr.', 'Maria', 'Theresa', 'Alonzo', ''],
    ['Engr. Richard Ferrer', 'Engr.', 'Richard', '', 'Ferrer', ''],
    ['Hon. Ricardo Villahermosa', 'Hon.', 'Ricardo', '', 'Villahermosa', ''],
    ['Judge Glenn Subia', 'Judge', 'Glenn', '', 'Subia', ''],
    ['Comm. Dwight Ramos', 'Comm.', 'Dwight', '', 'Ramos', ''],
    ['USec. Gefer R. Mancol', 'USec.', 'Gefer', 'R.', 'Mancol', ''],
    ['Ombudsman Mercy N. Gutierrez', 'Ombudsman', 'Mercy', 'N.', 'Gutierrez', ''],
    ['Mrs. Liezl Cerezo', 'Mrs.', 'Liezl', '', 'Cerezo', ''],
    ['Ms. Catalina F. Sison', 'Ms.', 'Catalina', 'F.', 'Sison', ''],
  ]);
});

test('MULTI-WORD titles are not torn in half', () => {
  // These are the rows that produced first_name='Associate' / 'Vice' /
  // 'Regional' / 'IBP' under the old words[0] split.
  check([
    ['Associate Dean Cecilio Duka', 'Associate Dean', 'Cecilio', '', 'Duka', ''],
    ['Vice Dean Erik C. Lazo', 'Vice Dean', 'Erik', 'C.', 'Lazo', ''],
    [
      'Regional Prosecutor Serafin S. Salazar',
      'Regional Prosecutor', 'Serafin', 'S.', 'Salazar', '',
    ],
    [
      'IBP Governor Ellen F. Francisco',
      'IBP Governor', 'Ellen', 'F.', 'Francisco', '',
    ],
  ]);
});

test('longest title phrase wins over a shorter one it contains', () => {
  // "Associate Dean" must not degrade to "Dean" leaving "Associate" a name,
  // and "Vice President" must not degrade to "President".
  assert.equal(parsePersonName('Associate Dean Cecilio Duka').prefix, 'Associate Dean');
  assert.equal(parsePersonName('Vice President Maria Cruz').prefix, 'Vice President');
  assert.equal(parsePersonName('Chief Justice Ramon Diaz').prefix, 'Chief Justice');
});

test('STACKED titles are all consumed', () => {
  check([[
    'ED Atty. Gabriel dela Peña',
    'ED Atty.', 'Gabriel', '', 'dela Peña', '',
  ]]);
});

test('a middle initial stays a middle name — never a suffix', () => {
  check([
    ['Atty. Arnaldo M. Espinas', 'Atty.', 'Arnaldo', 'M.', 'Espinas', ''],
    ['Atty. Joseph C. Cerezo', 'Atty.', 'Joseph', 'C.', 'Cerezo', ''],
    ['Ms. Caridad M. Saldana', 'Ms.', 'Caridad', 'M.', 'Saldana', ''],
    ['Atty. Diosdado R. Mendoza', 'Atty.', 'Diosdado', 'R.', 'Mendoza', ''],
    ['Ms. Sabina N. Dimaunahan', 'Ms.', 'Sabina', 'N.', 'Dimaunahan', ''],
  ]);
});

test('THE Ma. TRAP — María is a given name, not an honorific', () => {
  // `Ma.` is an abbreviation ending in a period, exactly like `Mr.`. If it
  // ever lands in `prefix`, the guest loses half their given name.
  check([
    [
      'Atty. Ma. Teresita Sison-Baluis',
      'Atty.', 'Ma. Teresita', '', 'Sison-Baluis', '',
    ],
    [
      'Mrs. Ma. Theresa Sacdalan-Tria',
      'Mrs.', 'Ma. Theresa', '', 'Sacdalan-Tria', '',
    ],
  ]);
  assert.equal(parsePersonName('Ma. Teresita Sison-Baluis').prefix, '');
});

test('hyphenated married surnames stay one last name', () => {
  check([
    [
      'Atty. Cherry Liez O. Rafal-Roble',
      'Atty.', 'Cherry', 'Liez O.', 'Rafal-Roble', '',
    ],
    ['Atty. Jessica Jota-Javier', 'Atty.', 'Jessica', '', 'Jota-Javier', ''],
  ]);
});

test('surname particles start the last name', () => {
  check([
    ['Estrella Dela Cruz', '', 'Estrella', '', 'Dela Cruz', ''],
    ['Jose Dela Cruz', '', 'Jose', '', 'Dela Cruz', ''],
    ['Miguel Dela Cruz', '', 'Miguel', '', 'Dela Cruz', ''],
    ['Gabriel dela Peña', '', 'Gabriel', '', 'dela Peña', ''],
    ['Juan de la Cruz', '', 'Juan', '', 'de la Cruz', ''],
  ]);
});

test('a HYPHENATED particle binds the word after it', () => {
  check([[
    'Mrs. Fely Sacdalan-dela Rosa',
    'Mrs.', 'Fely', '', 'Sacdalan-dela Rosa', '',
  ]]);
});

test('THE Sr. COLLISION — position decides Sister from Senior', () => {
  assert.deepEqual(parsePersonName('Sr. Maria Consuelo'), {
    prefix: 'Sr.', firstName: 'Maria', middleName: '', lastName: 'Consuelo', suffix: '',
  });
  assert.deepEqual(parsePersonName('Bob Casasola Sr.'), {
    prefix: '', firstName: 'Bob', middleName: '', lastName: 'Casasola', suffix: 'Sr.',
  });
});

test('generational and post-nominal suffixes come off the tail', () => {
  check([
    ['Bob Casasola III', '', 'Bob', '', 'Casasola', 'III'],
    ['Dr. Jose Rizal MD', 'Dr.', 'Jose', '', 'Rizal', 'MD'],
    ['Ana Cruz, Jr.', '', 'Ana', '', 'Cruz', 'Jr.'],
    ['Atty. Bob Casasola Jr., CPA', 'Atty.', 'Bob', '', 'Casasola', 'Jr., CPA'],
  ]);
});

test('NOT NULL is protected — nothing ever eats the whole name', () => {
  // `guests.first_name` / `.last_name` are NOT NULL. A title or suffix rule
  // that consumed the only word would turn a typo into a failed INSERT.
  for (const lone of ['Judge', 'Atty.', 'Mr.', 'Jr.', 'III', 'Madonna']) {
    const p = parsePersonName(lone);
    assert.equal(p.firstName, lone, `"${lone}" must survive as a first name`);
    assert.equal(p.prefix, '', `"${lone}" alone is a name, not a title`);
    assert.equal(p.suffix, '', `"${lone}" alone is a name, not a suffix`);
  }
});

test('a title typed with NO space after the period still splits', () => {
  // Real prod row: first_name='Mrs.Yolanda', last_name='Brondial'.
  check([['Mrs.Yolanda Brondial', 'Mrs.', 'Yolanda', '', 'Brondial', '']]);
});

test('the glued-title rule does not fire on initials or a period in a name', () => {
  // Only a token in the honorific vocabulary may be split off, or "J.R." and
  // any surname carrying a period would be torn apart.
  assert.equal(parsePersonName('J.R. Santos').prefix, '');
  assert.equal(parsePersonName('St.John Smith').prefix, '');
});

test('empty and whitespace-only input yield all-empty parts, never a throw', () => {
  const blank = { prefix: '', firstName: '', middleName: '', lastName: '', suffix: '' };
  for (const v of ['', '   ', '\t\n', null, undefined]) {
    assert.deepEqual(parsePersonName(v as string), blank);
  }
});

test('casing is never rewritten', () => {
  // `guest-name.ts` documents why: de la Cruz / Ng / McName all break under
  // naive Title-Case, so this parser must not smuggle casing changes in.
  const p = parsePersonName('atty. bob CASASOLA jr.');
  assert.equal(p.firstName, 'bob');
  assert.equal(p.lastName, 'CASASOLA');
  assert.equal(p.prefix, 'atty.');
  assert.equal(p.suffix, 'jr.');
});

test('no token is ever dropped — the parts rejoin to the input', () => {
  // The strongest guard against a silently lossy rule: whatever the split,
  // the words must all still be there. A comma before a suffix is the one
  // permitted loss (it is punctuation, not a word).
  const inputs = [
    'Atty. Bob Casasola Jr.',
    'Associate Dean Cecilio Duka',
    'ED Atty. Gabriel dela Peña',
    'Atty. Ma. Teresita Sison-Baluis',
    'Mrs. Fely Sacdalan-dela Rosa',
    'Atty. Cherry Liez O. Rafal-Roble',
    'Regional Prosecutor Serafin S. Salazar',
    'IBP Governor Ellen F. Francisco',
    'Ms. Caridad M. Saldana',
    'Judge',
  ];
  for (const input of inputs) {
    assert.equal(
      formatPersonName(parsePersonName(input)),
      input,
      `round-trip lost or reordered a token in "${input}"`,
    );
  }
});
