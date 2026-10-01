/**
 * WALKING TOGETHER IS NOT BEING A COUPLE.
 *
 * ⚖ OWNER 2026-09-30 (DECISION_LOG row of that name), verbatim: *"my issue with
 * your pairing with the wedding march is sometimes the principal sponsor are
 * not couples. Or the entourage are also not couples. Sometime they have their
 * own +1"*. The Oct 1 release shortened ANY walking pair with a shared surname
 * into the couple form ("Hon. Ricardo & Mrs. Jessica Villahermosa").
 *
 * What this holds:
 *   1. a walking pair prints BOTH FULL NAMES unless they are a real couple —
 *      a shared surname alone never shortens;
 *   2. a couple = one is the other's +1, OR both halves carry the Wedding
 *      March's "They're a couple" tick pointing at EACH OTHER (a one-sided or
 *      stale tick is not a couple);
 *   3. a +1 is a guest, never entourage — not listed, not offered to walk;
 *   4. the page and the printed card say the same words (one `lineNames`);
 *   5. every reader that prints a pair line asks for what `isCouple` reads;
 *   6. "walks with" is set and shown ONLY in the Maker's Wedding March — the
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
    pair_with_guest_id: null,
    display_name: null,
    name_prefix: prefix,
    first_name: first,
    middle_name: null,
    last_name: last,
    name_suffix: null,
    role,
    extra_roles: null,
    entourage_order: null,
    ...more,
  };
}

/** Ninong `a` walks with Ninang `b`; `extraA` / `extraB` say how (or whether) they are a couple. */
function sponsors(extraA: Partial<EntourageGuestRow> = {}, extraB: Partial<EntourageGuestRow> = {}) {
  return [
    g('a', 'principal_sponsor_ninong', 'Hon.', 'Ricardo', 'Villahermosa', { pair_with_guest_id: 'b', ...extraA }),
    g('b', 'principal_sponsor_ninang', 'Mrs.', 'Jessica', 'Villahermosa', { pair_with_guest_id: 'a', ...extraB }),
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
    g('e', 'principal_sponsor_ninong', 'Dr.', 'Eduardo', 'Bautista', { pair_with_guest_id: 'c' }),
    g('c', 'principal_sponsor_ninang', 'Ms.', 'Carmen', 'Reyes', { pair_with_guest_id: 'e' }),
  ];
  assert.deepEqual(linesOf(rows), ['Dr. Eduardo Bautista & Ms. Carmen Reyes']);
});

test('a +1 couple shortens — whichever half is the +1', () => {
  assert.deepEqual(linesOf(sponsors({}, { plus_one_of_guest_id: 'a' })), ['Hon. Ricardo & Mrs. Jessica Villahermosa']);
  assert.deepEqual(linesOf(sponsors({ plus_one_of_guest_id: 'b' }, {})), ['Hon. Ricardo & Mrs. Jessica Villahermosa']);
});

test('a ticked couple ("They’re a couple") shortens — only when BOTH halves point at each other', () => {
  assert.deepEqual(
    linesOf(sponsors({ couple_with_guest_id: 'b' }, { couple_with_guest_id: 'a' })),
    ['Hon. Ricardo & Mrs. Jessica Villahermosa'],
  );
  // One-sided (a half-written tick) is not a couple — the safe reading.
  assert.deepEqual(linesOf(sponsors({ couple_with_guest_id: 'b' }, {})), ['Hon. Ricardo Villahermosa & Mrs. Jessica Villahermosa']);
  // A tick left over from an earlier partner never adopts the new one.
  assert.deepEqual(
    linesOf(sponsors({ couple_with_guest_id: 'x' }, { couple_with_guest_id: 'y' })),
    ['Hon. Ricardo Villahermosa & Mrs. Jessica Villahermosa'],
  );
});

test('isCouple: a person is never their own couple; a missing half is not a couple', () => {
  assert.equal(isCouple({ id: 'a', coupleWith: 'a' }, { id: 'a', coupleWith: 'a' }), false);
  assert.equal(isCouple({ id: 'a', plusOneOf: 'b' }, null), false);
  assert.equal(isCouple({ id: null, plusOneOf: 'b' }, { id: 'b' }), false);
});

test('the crews obey the same rule — a bridesmaid and groomsman who share a surname are not merged', () => {
  const rows = [
    g('m', 'bridesmaid', null, 'Carla', 'Lim', { pair_with_guest_id: 'n' }),
    g('n', 'groomsman', null, 'Dan', 'Lim', { pair_with_guest_id: 'm' }),
  ];
  const key = buildEntourage(rows)[0]!.key;
  assert.deepEqual(linesOf(rows, key), ['Carla Lim & Dan Lim']);
});

test('the printed card says exactly what the page says (one lineNames)', () => {
  for (const rows of [sponsors(), sponsors({}, { plus_one_of_guest_id: 'a' })]) {
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

test('every reader that PRINTS a pair line asks for what isCouple reads', () => {
  const readers: Record<string, string> = {
    'the invitation + the Maker (loadEntourage)': 'app/[slug]/_lib/loaders.ts',
    'the /everyone page': 'app/[slug]/everyone/page.tsx',
    'the printed Entourage card': 'lib/print-set.server.ts',
  };
  for (const [who, file] of Object.entries(readers)) {
    const code = stripComments(read(file));
    assert.match(code, /\.select\(`\$\{ENTOURAGE_COLUMNS\}, [^`]*\$\{ENTOURAGE_COUPLE_FIELDS\}[^`]*`\)/, `${who} (${file}) cannot tell a couple from a walking pair`);
  }
  const entourage = read('lib/entourage.ts');
  assert.match(entourage, /ENTOURAGE_COUPLE_FIELDS = 'plus_one_of_guest_id, couple_with_guest_id'/);
});

test('the Maker’s Wedding March carries the "They’re a couple" tick, and it writes the couple field', () => {
  const march = stripComments(read('app/dashboard/[eventId]/launch/_components/details-march.tsx'));
  assert.match(march, /They&rsquo;re a couple/);
  assert.match(march, /data-march-couple=""/);
  assert.match(march, /setWalkingPairCouple\(eventId, ids\[0\], ids\[1\], next\)/);
  const load = stripComments(read('app/dashboard/[eventId]/launch/_components/details-your-event-load.tsx'));
  assert.match(load, /on: isCouple\(row\[0\], row\[1\]\)/);
  const action = stripComments(read('app/dashboard/[eventId]/guests/pair-actions.ts'));
  assert.match(action, /export async function setWalkingPairCouple\(/);
  assert.match(action, /couple_with_guest_id: other/);
  // A walking pair must still be a pair when the tick lands.
  assert.match(action, /a\.pair_with_guest_id !== bId \|\| b\.pair_with_guest_id !== aId/);
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
