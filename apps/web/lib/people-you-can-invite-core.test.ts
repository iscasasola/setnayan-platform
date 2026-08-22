import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleInvitable,
  nameKey,
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
