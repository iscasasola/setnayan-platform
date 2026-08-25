import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  assembleInvitable,
  chooseAllShown,
  isInSamahan,
  matchesInvitableQuery,
  nameKey,
  samahanGroupsIn,
  type InvitableCandidate,
} from './people-you-can-invite-core';

const row = (o: Partial<InvitableCandidate> & { name: string }): InvitableCandidate => {
  const [first, ...rest] = o.name.split(' ');
  return {
    key: o.key ?? `k:${o.name}`,
    firstName: o.firstName ?? first!,
    lastName: o.lastName ?? rest.join(' '),
    name: o.name,
    source: o.source ?? 'event',
    from: o.from ?? 'Somewhere',
    email: o.email ?? null,
  };
};

test('the same person from two sources is offered ONCE, richest first', () => {
  /*
    The tita who is a guest of last year's graduation AND a person on the
    People page. Offering her twice makes the host choose one and wonder what
    the other one was.
  */
  const out = assembleInvitable(
    [
      row({ name: 'Ana Cruz', source: 'event', from: 'Graduation', email: 'ana@x.ph' }),
      row({ name: 'Ana Cruz', source: 'people', from: 'Your people' }),
    ],
    new Set(),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.source, 'event');
  assert.equal(out[0]!.email, 'ana@x.ph', 'the richer row must be the survivor');
});

test('de-duplication is blind to case and spacing', () => {
  const out = assembleInvitable(
    [row({ name: 'Ana Cruz' }), row({ name: '  ANA   cruz ', key: 'other' })],
    new Set(),
  );
  assert.equal(out.length, 1);
});

test('AN EMAIL RIDES ONLY ON AN event ROW — the others are dropped here', () => {
  /*
    The load-bearing privacy assertion, and it is enforced in the merge rather
    than trusted from the caller: a future caller who did not read the header
    cannot smuggle a co-member's address onto a host's guest list.
  */
  const out = assembleInvitable(
    [
      row({ name: 'Bea Reyes', source: 'people', email: 'bea@x.ph' }),
      row({ name: 'Caloy Tan', source: 'samahan', email: 'caloy@x.ph' }),
      row({ name: 'Dina Lim', source: 'event', email: 'dina@x.ph' }),
    ],
    new Set(),
  );
  const by = Object.fromEntries(out.map((p) => [p.name, p.email]));
  assert.equal(by['Bea Reyes'], null, 'a People-page row must carry no address');
  assert.equal(by['Caloy Tan'], null, 'a samahan co-member must carry no address');
  assert.equal(by['Dina Lim'], 'dina@x.ph', 'the host’s own guest row keeps its address');
});

test('somebody already on this list is MARKED, never dropped', () => {
  /*
    Hiding them is indistinguishable from not having them — and a host who
    cannot find their own tita types her in a second time.
  */
  const out = assembleInvitable(
    [row({ name: 'Ana Cruz' }), row({ name: 'Bea Reyes' })],
    new Set([nameKey('Ana', 'Cruz')]),
  );
  assert.equal(out.length, 2);
  const ana = out.find((p) => p.name === 'Ana Cruz')!;
  assert.equal(ana.alreadyHere, true);
});

test('the ones you can add come first, then alphabetical', () => {
  const out = assembleInvitable(
    [row({ name: 'Zeny Uy' }), row({ name: 'Ana Cruz' }), row({ name: 'Bea Reyes' })],
    new Set([nameKey('Ana', 'Cruz')]),
  );
  assert.deepEqual(
    out.map((p) => p.name),
    ['Bea Reyes', 'Zeny Uy', 'Ana Cruz'],
  );
});

test('a one-word name still matches, and keeps its empty surname', () => {
  const out = assembleInvitable(
    [row({ name: 'Madonna', firstName: 'Madonna', lastName: '', source: 'people' })],
    new Set(),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.lastName, '', 'the picker asks for the missing half; nothing is invented');
});

test('a nameless row is skipped rather than rendered blank', () => {
  const out = assembleInvitable(
    [row({ name: '', firstName: '', lastName: '' }), row({ name: 'Ana Cruz' })],
    new Set(),
  );
  assert.deepEqual(out.map((p) => p.name), ['Ana Cruz']);
});

test('TWO DIFFERENT PEOPLE WITH THE SAME NAME ARE BOTH OFFERED', () => {
  /*
    The cousin Maria Santos on last year's guest list and the colleague Maria
    Santos on another. Merging them on the name alone emitted ONE row whose
    address belonged to whichever came first — and picking it wrote that
    address onto the new guest, which the Save-the-Date then mails. The screen
    cannot warn anybody: it shows the name and the `from` line, and the address
    never reaches the browser at all.
  */
  const out = assembleInvitable(
    [
      row({ name: 'Maria Santos', key: 'a', from: 'Graduation', email: 'maria.santos@gmail.com' }),
      row({ name: 'Maria Santos', key: 'b', from: 'Movie Night', email: 'msantos@work.com' }),
    ],
    new Set(),
  );
  assert.equal(out.length, 2, 'two known-and-different addresses are two people');
  assert.deepEqual(
    out.map((p) => p.from).sort(),
    ['Graduation', 'Movie Night'],
    'the `from` line is what tells them apart, so both must survive',
  );
});

test('the SAME address twice is still one person', () => {
  const out = assembleInvitable(
    [
      row({ name: 'Ana Cruz', key: 'a', from: 'Graduation', email: 'ana@x.ph' }),
      row({ name: 'Ana Cruz', key: 'b', from: 'Movie Night', email: 'ANA@X.PH' }),
    ],
    new Set(),
  );
  assert.equal(out.length, 1, 'case differs, the person does not');
  assert.equal(out[0]!.from, 'Graduation');
});

test('an UNKNOWN address still merges — absence is not disagreement', () => {
  /*
    The common case and the one rule 1 exists for: the same tita as a guest of
    another event AND as a connection on the People page. The People row carries
    no address by construction, so it cannot disagree with anything.
  */
  const out = assembleInvitable(
    [
      row({ name: 'Ana Cruz', key: 'a', from: 'Graduation', email: 'ana@x.ph' }),
      row({ name: 'Ana Cruz', key: 'b', source: 'people', from: 'Your people' }),
    ],
    new Set(),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.email, 'ana@x.ph');
});

test('three same-name people with three addresses are three rows', () => {
  const out = assembleInvitable(
    [
      row({ name: 'Jose Rizal', key: 'a', from: 'A', email: 'one@x.ph' }),
      row({ name: 'Jose Rizal', key: 'b', from: 'B', email: 'two@x.ph' }),
      row({ name: 'Jose Rizal', key: 'c', from: 'C', email: 'three@x.ph' }),
    ],
    new Set(),
  );
  assert.equal(out.length, 3);
});

// ── THE GROUP GESTURE (2026-08-25) ──────────────────────────────────────────
// "You cannot invite a whole samahan" was half true and worth measuring before
// building: a samahan's members have been offered in this picker one at a time
// since 2026-08-21. What was missing was the group — twelve taps for a barkada.

test('a samahan name finds its members, because the `from` line is matched too', () => {
  const rows = [
    { name: 'Ana Cruz', from: 'Barkada ng Bayan' },
    { name: 'Ben Diaz', from: 'Barkada ng Bayan' },
    { name: 'Cara Reyes', from: 'Graduation 2025' },
  ];
  const hit = rows.filter((r) => matchesInvitableQuery(r, 'barkada'));
  assert.deepEqual(
    hit.map((r) => r.name),
    ['Ana Cruz', 'Ben Diaz'],
  );
  // And a name still matches a name.
  assert.equal(rows.filter((r) => matchesInvitableQuery(r, 'cara')).length, 1);
  // An empty search hides nobody.
  assert.equal(rows.filter((r) => matchesInvitableQuery(r, '   ')).length, 3);
});

test('choosing everyone shown never picks somebody already on the list', () => {
  const shown = [
    { key: 'a', alreadyHere: false },
    { key: 'b', alreadyHere: true },
    { key: 'c', alreadyHere: false },
  ];
  const picked = chooseAllShown({}, shown, false);
  assert.deepEqual(Object.keys(picked).sort(), ['a', 'c']);
  assert.equal(picked.b, undefined, 'a guest who is already here was picked again');
});

test('choosing everyone shown leaves picks that are not shown alone', () => {
  // The host picks two people, then searches for their samahan. The two must
  // survive the search — losing them is a silent subtraction they only notice
  // after the invitations go out.
  const before = { tita: true, tito: true };
  const after = chooseAllShown(before, [{ key: 'ana', alreadyHere: false }], false);
  assert.deepEqual(Object.keys(after).sort(), ['ana', 'tita', 'tito']);
});

test('letting go of everyone shown is the same control, in reverse', () => {
  const before = { ana: true, ben: true, tita: true };
  const after = chooseAllShown(
    before,
    [
      { key: 'ana', alreadyHere: false },
      { key: 'ben', alreadyHere: false },
    ],
    true,
  );
  assert.deepEqual(Object.keys(after), ['tita']);
});

test('neither helper mutates what it was given', () => {
  const picked = { ana: true };
  chooseAllShown(picked, [{ key: 'ben', alreadyHere: false }], false);
  assert.deepEqual(Object.keys(picked), ['ana']);
});

// ── THE CHIP IS A MEMBERSHIP TEST (2026-08-25, after an audit of the first cut)

test('a chip matches a samahan exactly — never a substring of one', () => {
  const anaSquad = { groups: ['Ana'] };
  assert.equal(isInSamahan(anaSquad, 'Ana'), true);
  assert.equal(isInSamahan({}, 'Ana'), false, 'a row with no groups belongs to none');
  assert.equal(
    isInSamahan({ groups: ['Barkada ng Bayan'] }, 'Ana'),
    false,
    'a group called Ana swept up an unrelated barkada',
  );

  // 🪤 THE CASE THAT ACTUALLY SEPARATES EXACT FROM SUBSTRING, and the first
  // version of this test did not have it: mutating `includes(group)` into
  // `some((g) => g.includes(group))` left the suite GREEN, because none of the
  // fixtures had one group name inside another. Two real barkadas can easily be
  // "Ana" and "Ana Barkada"; pressing the first must not sweep in the second.
  assert.equal(
    isInSamahan({ groups: ['Ana Barkada'] }, 'Ana'),
    false,
    'pressing one samahan selected the members of a differently-named one',
  );
  assert.equal(
    isInSamahan({ groups: ['Ana'] }, 'Ana Barkada'),
    false,
    'the substring test in the other direction',
  );
});

test('the chips are every samahan named across the rows, deduped and sorted', () => {
  const rows = [
    { groups: ['Barkada', 'Team Lakad'] },
    { groups: ['Barkada'] },
    { groups: [] },
    {},
  ];
  assert.deepEqual(samahanGroupsIn(rows), ['Barkada', 'Team Lakad']);
});

test('a person in TWO samahans belongs to both chips, not just the first', () => {
  // The `from` line carries only the alphabetically first, which is why the
  // filter cannot be built on it.
  const row = { groups: ['Barkada ng Bayan', 'Team Lakad'] };
  assert.equal(isInSamahan(row, 'Team Lakad'), true);
});

test('a dropped duplicate donates its samahan to the row that survives', () => {
  // 🚨 THE DEFECT THIS CLOSES. The cousin who is in your barkada AND was a guest
  // at your engagement party survives as the richer `event` row, labelled with
  // that party. Before this, her samahan went with the row that was dropped, so
  // "the whole barkada" quietly left her out.
  const candidates: InvitableCandidate[] = [
    {
      key: 'event:1',
      firstName: 'Maria',
      lastName: 'Cruz',
      name: 'Maria Cruz',
      source: 'event',
      from: 'Engagement party',
      email: null,
    },
    {
      key: 'samahan:9',
      firstName: 'Maria',
      lastName: 'Cruz',
      name: 'Maria Cruz',
      source: 'samahan',
      from: 'Barkada ng Bayan',
      email: null,
      groups: ['Barkada ng Bayan'],
    },
  ];
  const out = assembleInvitable(candidates, new Set());
  assert.equal(out.length, 1, 'one person, one row');
  assert.equal(out[0]?.source, 'event', 'the richer row still wins');
  assert.equal(
    isInSamahan(out[0] ?? {}, 'Barkada ng Bayan'),
    true,
    'her barkada was lost with the row that was dropped',
  );
});

test('two different people who share a name keep their own groups', () => {
  // The compatibility rule emits both; neither may inherit the other's samahan.
  const candidates: InvitableCandidate[] = [
    {
      key: 'event:1',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      source: 'event',
      from: 'Graduation',
      email: 'one@example.com',
    },
    {
      key: 'event:2',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      source: 'event',
      from: 'Reunion',
      email: 'two@example.com',
    },
  ];
  const out = assembleInvitable(candidates, new Set());
  assert.equal(out.length, 2, 'two known-and-different addresses are two people');
  for (const row of out) assert.deepEqual(row.groups ?? [], []);
});

test('every samahan a person is in reaches the filter, not just the first', () => {
  // The server builder is the only place `via` becomes `groups`, and there is
  // no pure function to exercise — so this asserts the one line. Mutating it to
  // `m.via.slice(0, 1)` left every behavioural test green, which is precisely
  // the defect this whole change exists to remove, one level upstream.
  const src = stripComments(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'people-you-can-invite.ts'), 'utf8'),
  );
  assert.match(
    src,
    /groups: m\.via,/,
    'the samahan candidate no longer carries every samahan the person is in',
  );
});
