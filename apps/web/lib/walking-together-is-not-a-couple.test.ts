/**
 * WALKING TOGETHER IS NOT BEING A COUPLE.
 *
 * ⚖ OWNER 2026-09-30 (DECISION_LOG row of that name), verbatim: *"my issue with
 * your pairing with the wedding march is sometimes the principal sponsor are
 * not couples. Or the entourage are also not couples. Sometime they have their
 * own +1"*. The Oct 1 release shortened ANY walking pair with a shared surname
 * into the couple form ("Hon. Ricardo & Mrs. Jessica Villahermosa").
 *
 * ⚖ TIGHTENED 2026-10-01 (DECISION_LOG "A WALK AND A COUPLE ARE INDEPENDENT"),
 * verbatim: *"the pair in the wedding march does not mean they are a couple. so
 * it should be independent from each other."* — and "THE WEDDING MARCH IS ITS
 * OWN ENTITY" (`march_walks`).
 *
 * What this holds:
 *   1. every march line prints BOTH FULL NAMES — a shared surname, a +1 and a
 *      partner link alike; there is no couple short form in the march;
 *   2. a couple (`isCouple`) is a fact about the PEOPLE — one is the other's +1,
 *      or both partner links point at EACH OTHER — and the march never sets it;
 *   3. a +1 is a guest, never entourage — not listed, not offered to walk;
 *   4. the page and the printed card say the same words (one `lineNames`);
 *   5. every reader that prints the march asks for the walks;
 *   6. the Maker's Wedding March has no "They're a couple" control and no
 *      action that writes one;
 *   7. "walks with" is set and shown ONLY in the Maker's Wedding March — the
 *      Guest list rows and the guest card neither show nor edit it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEntourage, isCouple, lineNames, type EntourageGuestRow } from './entourage';
import { printedEntourageLines } from './print-layout';
import { joinersFor } from './march-moves';
import { stripComments } from './strip-comments';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

function g(
  id: string,
  role: string,
  prefix: string | null,
  first: string,
  last: string,
  more: Partial<EntourageGuestRow> = {},
): EntourageGuestRow {
  return {
    guest_id: id,
    march: null,
    display_name: null,
    name_prefix: prefix,
    first_name: first,
    middle_name: null,
    last_name: last,
    name_suffix: null,
    role,
    extra_roles: null,
    ...more,
  };
}

/** Ninong `a` walks with Ninang `b` (one walk); `extraA` / `extraB` say how (or whether) they are a couple. */
function sponsors(extraA: Partial<EntourageGuestRow> = {}, extraB: Partial<EntourageGuestRow> = {}) {
  return [
    g('a', 'principal_sponsor_ninong', 'Hon.', 'Ricardo', 'Villahermosa', { march: { walk_no: 0, place_in_walk: 0 }, ...extraA }),
    g('b', 'principal_sponsor_ninang', 'Mrs.', 'Jessica', 'Villahermosa', { march: { walk_no: 0, place_in_walk: 1 }, ...extraB }),
  ];
}

function linesOf(rows: EntourageGuestRow[], key = 'principal_sponsors'): string[] {
  const group = buildEntourage(rows).find((x) => x.key === key);
  return (group?.rows ?? []).map(lineNames);
}

test('a walking pair with a SHARED SURNAME but no couple prints both full names', () => {
  assert.deepEqual(linesOf(sponsors()), ['Hon. Ricardo Villahermosa & Mrs. Jessica Villahermosa']);
});

test('different surnames walking together: both full names (the owner’s own example)', () => {
  const rows = [
    g('e', 'principal_sponsor_ninong', 'Dr.', 'Eduardo', 'Bautista', { march: { walk_no: 0, place_in_walk: 0 } }),
    g('c', 'principal_sponsor_ninang', 'Ms.', 'Carmen', 'Reyes', { march: { walk_no: 0, place_in_walk: 1 } }),
  ];
  assert.deepEqual(linesOf(rows), ['Dr. Eduardo Bautista & Ms. Carmen Reyes']);
});

test('⚖ 2026-10-01 · a REAL couple walking together still prints both full names — the march never shortens', () => {
  const both = ['Hon. Ricardo Villahermosa & Mrs. Jessica Villahermosa'];
  // A +1, whichever half is the +1.
  assert.deepEqual(linesOf(sponsors({}, { plus_one_of_guest_id: 'a' })), both);
  assert.deepEqual(linesOf(sponsors({ plus_one_of_guest_id: 'b' }, {})), both);
  // A mutual partner link.
  assert.deepEqual(linesOf(sponsors({ couple_with_guest_id: 'b' }, { couple_with_guest_id: 'a' })), both);
});

test('isCouple reads the people, never the walk: +1 or a MUTUAL partner link', () => {
  assert.equal(isCouple({ id: 'a', plusOneOf: 'b' }, { id: 'b' }), true);
  assert.equal(isCouple({ id: 'a', coupleWith: 'b' }, { id: 'b', coupleWith: 'a' }), true);
  // One-sided is not a couple — the safe reading.
  assert.equal(isCouple({ id: 'a', coupleWith: 'b' }, { id: 'b' }), false);
  // Walking together (the same walk) says nothing.
  const [line] = buildEntourage(sponsors()).find((x) => x.key === 'principal_sponsors')!.rows;
  assert.equal(isCouple(line![0], line![1]), false, 'a shared walk made two people a couple');
});

test('isCouple: a person is never their own couple; a missing half is not a couple', () => {
  assert.equal(isCouple({ id: 'a', coupleWith: 'a' }, { id: 'a', coupleWith: 'a' }), false);
  assert.equal(isCouple({ id: 'a', plusOneOf: 'b' }, null), false);
  assert.equal(isCouple({ id: null, plusOneOf: 'b' }, { id: 'b' }), false);
});

test('the crews obey the same rule — a bridesmaid and groomsman who share a surname are not merged', () => {
  const rows = [
    g('m', 'bridesmaid', null, 'Carla', 'Lim', { march: { walk_no: 0, place_in_walk: 0 } }),
    g('n', 'groomsman', null, 'Dan', 'Lim', { march: { walk_no: 0, place_in_walk: 1 } }),
  ];
  const key = buildEntourage(rows)[0]!.key;
  assert.deepEqual(linesOf(rows, key), ['Carla Lim & Dan Lim']);
});

test('the printed card says exactly what the page says (one lineNames)', () => {
  for (const rows of [sponsors(), sponsors({}, { plus_one_of_guest_id: 'a' }), sponsors({ couple_with_guest_id: 'b' }, { couple_with_guest_id: 'a' })]) {
    const group = buildEntourage(rows).find((x) => x.key === 'principal_sponsors')!;
    const card = printedEntourageLines(group, false).filter((l) => l.pair).map((l) => l.c);
    assert.deepEqual(card, group.rows.map(lineNames));
  }
});

test('⛔ a +1 is a guest, never entourage: not listed, and not offered as someone to walk with', () => {
  const rows = [
    g('a', 'principal_sponsor_ninong', 'Dr.', 'Eduardo', 'Bautista', { plus_one_name: 'Liza Bautista' } as Partial<EntourageGuestRow>),
    // His +1 — a guest row of her own, as the RSVP and the Guest list mint it.
    g('p', 'guest', 'Mrs.', 'Liza', 'Bautista', { plus_one_of_guest_id: 'a' }),
    g('c', 'principal_sponsor_ninang', 'Ms.', 'Carmen', 'Reyes'),
  ];
  const groups = buildEntourage(rows);
  const everyName = groups.flatMap((x) => x.rows.flatMap((r) => r.map((p) => p?.name ?? ''))).join(' | ');
  assert.doesNotMatch(everyName, /Liza/, `a +1 reached the entourage: ${everyName}`);
  const ps = groups.find((x) => x.key === 'principal_sponsors')!;
  const offered = joinersFor(ps.rows, ps.key, 'a').map((o) => o.name).join(' | ');
  assert.doesNotMatch(offered, /Liza/, 'the march offers a +1 as someone to walk with');
  assert.match(offered, /Carmen Reyes/, 'anti-vacuity: the march still offers a real sponsor');
});

test('every reader that PRINTS the march asks for the walks (ENTOURAGE_COLUMNS)', () => {
  const readers: Record<string, string> = {
    'the invitation + the Maker (loadEntourage)': 'app/[slug]/_lib/loaders.ts',
    'the /everyone page': 'app/[slug]/everyone/page.tsx',
    'the printed Entourage card': 'lib/print-set.server.ts',
  };
  for (const [who, file] of Object.entries(readers)) {
    const code = stripComments(read(file));
    assert.match(code, /\.select\(`\$\{ENTOURAGE_COLUMNS\}[^`]*`\)/, `${who} (${file}) does not read the walks — every pair would split`);
  }
  assert.match(read('lib/entourage.ts'), /march:march_walks\(walk_no, place_in_walk\)'/);
});

test('⛔ the Maker’s Wedding March sets NO couple — no tick, no writer (owner 2026-10-01)', () => {
  const march = stripComments(read('app/dashboard/[eventId]/launch/_components/details-march.tsx'));
  assert.doesNotMatch(march, /They(?:&rsquo;|’|')re a couple|data-march-couple|CoupleTick/, 'the march shows a couple control again');
  assert.doesNotMatch(march, /\bsetWalkingPairCouple\b|couple_with_guest_id/, 'the march writes a couple again');
  const load = stripComments(read('app/dashboard/[eventId]/launch/_components/details-your-event-load.tsx'));
  assert.doesNotMatch(load, /\bisCouple\b|couple:/, 'the march loader computes a couple again');
  const action = stripComments(read('app/dashboard/[eventId]/guests/pair-actions.ts'));
  assert.doesNotMatch(action, /setWalkingPairCouple|couple_with_guest_id/, 'the retired couple writer is back');
  // Anti-vacuity: the march's own controls are still there.
  assert.match(march, /Walks with…/);
  assert.match(march, /Trade places with…/);
});

test('"walks with" is not on a Guest list row or the guest card — neither shown nor edited', () => {
  const surfaces = [
    'app/dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx',
    'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx',
    'app/dashboard/[eventId]/guests/_components/guest-card-data.ts',
  ];
  for (const file of surfaces) {
    const code = stripComments(read(file));
    assert.doesNotMatch(code, /walks with|Walks with|Unpair/, `${file} shows "walks with"`);
    assert.doesNotMatch(
      code,
      /\b(?:pairSelectedGuests|unpairGuestAction|setWalkingPairCouple|pair_guests|unpair_guest)\b/,
      `${file} edits a pairing`,
    );
  }
});
