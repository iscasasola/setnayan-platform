import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildEntourage,
  entourageGroupOfRole,
  entourageLines,
  peopleOf,
  type EntourageGuestRow,
} from './entourage';

/**
 * ⚖ OWNER 2026-09-20 — the pairing + walking-order ruling.
 *
 *  · A paired couple does NOT collapse on the roster, and no column is removed.
 *    RSVP, meal, seat and contact are facts about a PERSON: a ninang can decline
 *    while her ninong attends.
 *  · The pair collapses to ONE line only where the pair is the unit — the
 *    walking-order panel and the printed processional.
 *  · The order belongs to the LINE. Both halves carry the same
 *    `entourage_order`, which is why this needed no schema change.
 *  · Walking order and seating stay two orderings. Moving a pair never moves a
 *    chair.
 *
 * The first three are executed here, not grepped. The roster one is necessarily
 * a source assertion — but it asserts a COUNT, so a column quietly disappearing
 * fails rather than passing on prose that still mentions it.
 */

const row = (over: Partial<EntourageGuestRow>): EntourageGuestRow => ({
  display_name: null,
  first_name: 'A',
  last_name: 'B',
  role: 'guest',
  extra_roles: null,
  ...over,
});

/** Two people, mutually paired, in the same printed group. */
function pairedFixture(): EntourageGuestRow[] {
  return [
    row({ guest_id: 'ninong', first_name: 'Ramon', last_name: 'Zamora', role: 'principal_sponsor_ninong', pair_with_guest_id: 'ninang' }),
    row({ guest_id: 'ninang', first_name: 'Rosa', last_name: 'Zamora', role: 'principal_sponsor_ninang', pair_with_guest_id: 'ninong' }),
    row({ guest_id: 'solo', first_name: 'Ana', last_name: 'Abad', role: 'principal_sponsor_ninang', pair_with_guest_id: null }),
  ];
}

// ── the decision, executed ─────────────────────────────────────────────────

test('a pair is ONE line; a single is its own line', () => {
  const lines = entourageLines(pairedFixture(), 'principal_sponsors');
  assert.equal(lines.length, 2, 'three people must print as two lines');
  const paired = lines.find((ln) => ln[0] && ln[1]);
  assert.ok(paired, 'the mutual pair did not share a line');
  assert.deepEqual(
    [paired[0]?.id, paired[1]?.id].sort(),
    ['ninang', 'ninong'],
    'the pair shares a line with the wrong people',
  );
});

test('🔑 the LINE is ordered, not the role — a pair moves as one', () => {
  /*
    This is the defect the build exists for. Ninong and ninang are two different
    ROLES, so ordering each role separately could not express a pair at all:
    "move her up" moved her past other ninangs while he stayed where he was.
    Both halves carrying the same number is what makes the column able to say
    this — it always could; nothing was writing it that way.
  */
  const rows = pairedFixture().map((r) =>
    r.guest_id === 'solo' ? { ...r, entourage_order: 0 } : { ...r, entourage_order: 1 },
  );
  const lines = entourageLines(rows, 'principal_sponsors');
  assert.equal(lines[0]?.[0]?.id ?? lines[0]?.[1]?.id, 'solo', 'the hand-placed single is not first');
  const second = lines[1]!;
  assert.ok(second[0] && second[1], 'the pair came apart when it was ordered');
});

test('an unplaced line sorts after every placed one, and never as position zero', () => {
  // `entourage_order ?? 0` would rank everyone untouched ABOVE the line the
  // couple deliberately put first.
  const rows = pairedFixture().map((r) =>
    r.guest_id === 'solo' ? { ...r, entourage_order: 5 } : r,
  );
  const lines = entourageLines(rows, 'principal_sponsors');
  assert.equal(lines[0]?.[0]?.id ?? lines[0]?.[1]?.id, 'solo');
});

test('the invitation prints the pair as one row too', () => {
  const groups = buildEntourage(pairedFixture());
  const sponsors = groups.find((g) => g.key === 'principal_sponsors');
  assert.ok(sponsors, 'the sponsors group did not print');
  assert.equal(sponsors.rows.length, 2, 'the print did not collapse the pair to one line');
  // And nobody is printed twice by the collapse.
  const ids = peopleOf(sponsors).map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'somebody is printed twice');
});

test('a ceremony-only sponsor still walks, and says so', () => {
  const rows = pairedFixture().map((r) =>
    r.guest_id === 'solo' ? { ...r, invited_to_blocks: ['ceremony'] } : r,
  );
  const lines = entourageLines(rows, 'principal_sponsors');
  const solo = lines.flat().find((h) => h?.id === 'solo');
  assert.ok(solo, 'the ceremony-only sponsor was dropped from the processional');
  assert.equal(solo.ceremonyOnly, true, 'the ceremony-only fact did not reach the line');
});

test('a pair may not span two printed groups — the two never share a line', () => {
  const rows = [
    row({ guest_id: 'maid', first_name: 'Mia', last_name: 'Cruz', role: 'maid_of_honor', pair_with_guest_id: 'bearer' }),
    row({ guest_id: 'bearer', first_name: 'Bo', last_name: 'Cruz', role: 'ring_bearer', pair_with_guest_id: 'maid' }),
  ];
  assert.notEqual(
    entourageGroupOfRole('maid_of_honor'),
    entourageGroupOfRole('ring_bearer'),
    'the fixture no longer straddles two groups',
  );
  for (const key of ['honour', 'bearers']) {
    for (const line of entourageLines(rows, key)) {
      assert.ok(
        !(line[0] && line[1]),
        `${key} paired two people who print in different groups`,
      );
    }
  }
});

// ── the roster keeps both rows and every column ────────────────────────────

const ROSTER = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-list-multiselect.tsx'),
  'utf8',
);

test('⚖ the roster never collapses a pair, and removes no column', () => {
  /*
    RSVP, meal, seat and contact are facts about a PERSON — a ninang can decline
    while her ninong attends — so the roster shows two rows and every column.
    Collapsing there would be the one change this ruling forbids.
  */
  const head = ROSTER.slice(ROSTER.indexOf('<thead'), ROSTER.indexOf('</thead>'));
  const columns = (head.match(/<th[ >]/g) ?? []).length;
  assert.ok(columns >= 8, `the roster is down to ${columns} columns`);

  // Rows are emitted per GUEST, never per pair: no mount is conditioned on a
  // partner, and nothing skips a row because somebody else already showed it.
  assert.ok(
    !/pair_with_guest_id[^\n]*\?[^\n]*null\s*:\s*<DesktopRow/.test(ROSTER),
    'a roster row is now conditional on pairing',
  );
  /* The partner is SHOWN, as a line under the name, with a way to undo it.
     🪤 Matched with a tag boundary: a bare `includes('<PartnerLine')` also
     matches `<PartnerLineX`, so renaming the mount passed a first draft of
     this. A substring is not a mount. */
  assert.match(ROSTER, /<PartnerLine[\s/>]/, 'the roster stopped showing "walks with"');
  assert.match(ROSTER, /\bunpairGuestAction\b/, 'the roster lost its unpair control');
});

// ── the two orderings stay two orderings ───────────────────────────────────

test('⛔ reordering the processional cannot touch a chair', () => {
  const action = readFileSync(
    join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'entourage-order-actions.ts'),
    'utf8',
  );
  // Comments may name them; a WRITE may not.
  const code = action.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const seatThing of ['event_seat_assignments', 'seating_priority']) {
    assert.ok(
      !code.includes(seatThing),
      `the walking-order action touches ${seatThing} — moving a pair would move a chair`,
    );
  }
  assert.match(code, /entourage_order: index/, 'the action no longer writes the line position');
});
