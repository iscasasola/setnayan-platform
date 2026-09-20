import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  honoreeRank,
  isHonoreeRole,
  ROLE_IMPORTANCE,
  roleGroupOf,
} from './role-groups';
import type { GuestRole } from './guests';

/**
 * ⚖ Owner 2026-06-05: *"Bride will always be #1 then groom."*
 * ⚖ Owner 2026-09-20: *"on list, the first one will always be the celebrant.
 *   for wedding that is the bride and groom."*
 *
 * The wedding half has been true since June; the other half could not be,
 * because no non-wedding role said who the celebration was FOR. This pins
 * both, and pins them against the ARRANGEMENT rather than against one sort:
 * a host may now group by Side and order by RSVP, and the honoree still leads.
 */

type Row = { role: GuestRole; last: string };
const row = (role: GuestRole, last = 'Zzz'): Row => ({ role, last });

// Comparators chosen to be HOSTILE to the pin: each one, alone, puts an
// honoree last. If the pin is applied after them, or not at all, they win.
const HOSTILE: [string, (a: Row, b: Row) => number][] = [
  ['reverse alphabetical', (a, b) => b.last.localeCompare(a.last)],
  ['alphabetical', (a, b) => a.last.localeCompare(b.last)],
  ['every pair equal', () => 0],
  ['exactly backwards', (a, b) => (a.last === b.last ? 0 : a.last > b.last ? -1 : 1)],
];

test('the honoree leads under EVERY sort, not only under importance', () => {
  for (const [name, cmp] of HOSTILE) {
    for (const honoree of ['bride', 'celebrant'] as GuestRole[]) {
      const rows: Row[] = [
        row('guest', 'Aaa'),
        row('helper', 'Bbb'),
        row(honoree, 'Zzz'), // last name puts them dead last under either order
        row('vip', 'Mmm'),
      ];
      const sorted = [...rows].sort(
        (a, b) => honoreeRank(a.role) - honoreeRank(b.role) || cmp(a, b),
      );
      assert.equal(
        sorted[0]!.role,
        honoree,
        `${honoree} was not first under "${name}" — the pin did not outrank the sort`,
      );
    }
  }
});

test('bride then groom, and the celebrant leads a list they are not on', () => {
  assert.ok(honoreeRank('bride') < honoreeRank('groom'), 'bride is #1, groom is #2');
  assert.ok(honoreeRank('celebrant') < honoreeRank('bride'));
  for (const r of ['guest', 'host', 'vip', 'family', 'helper', 'officiant'] as GuestRole[]) {
    assert.ok(honoreeRank(r) > honoreeRank('groom'), `${r} outranked the couple`);
  }
});

test('being part of the HOST pins nobody', () => {
  // ⛔ The distinction this whole change exists for (owner 2026-08-27: "there
  // can be multiple hosts for every event, but the one celebratiing is the
  // celebrant"). At Lola's 80th the host is her daughter; pinning the host
  // would put the wrong name at the top of the list.
  assert.equal(isHonoreeRole('host'), false);
  assert.equal(honoreeRank('host'), honoreeRank('guest'));
});

test('the honoree also leads the IMPORTANCE order it is bucketed by', () => {
  // Two mechanisms decide "first": the pin (above) and ROLE_IMPORTANCE, which
  // orders the sections. If they disagree the honoree leads the list but their
  // section is somewhere in the middle.
  assert.equal(ROLE_IMPORTANCE[0], 'celebrant');
  assert.equal(ROLE_IMPORTANCE[1], 'bride');
  assert.equal(ROLE_IMPORTANCE[2], 'groom');
});

test('a celebrant is NOT sectioned under a heading that says Bride & Groom', () => {
  // Reusing 'couple' would have been the cheap mapping, and it labels the
  // section "Bride & Groom" — on a birthday, worse than no heading at all.
  assert.equal(roleGroupOf('celebrant'), 'honoree');
  assert.equal(roleGroupOf('bride'), 'couple');
});

test('the page still DELEGATES the pin instead of re-deriving it', () => {
  // 🪤 The pin lived as three literals inside a server component, where a
  // guard could only grep it. It is executable above — but only for as long as
  // the page keeps calling it, so this is the one assertion that has to read
  // source. Anchored on the call, not on a line number.
  const src = readFileSync(
    join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'page.tsx'),
    'utf8',
  );
  assert.match(
    src,
    /function coupleRank\([^)]*\)\s*:\s*number\s*\{\s*return honoreeRank\(/,
    'page.tsx re-implements the pin instead of calling honoreeRank — the tests above now prove nothing about the live roster',
  );
});
