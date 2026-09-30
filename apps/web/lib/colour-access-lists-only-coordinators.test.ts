/**
 * COLOUR ACCESS lists coordinators — never the couple.
 *
 * Owner 2026-09-30, on a screenshot of the Hosts page's card: "Claire Buanhog
 * is not a coordinator" — she is the Bride. Since 20271251336140 a full co-host
 * seat (bride, groom, partner, co-host, celebrant) is a `couple` member, and
 * `set_coordinator_colour_access` only grants to `coordinator` members, so
 * listing her offered four switches the gate would refuse.
 *
 * ⚖ The Hosts fold (2026-09-30) moved the card: the planner's copy is on their
 * supplier workspace, a helper's goes on their guest card. The rule moved to
 * ONE pure function (`seatsThatTakeColourGrants`), which the one server
 * assembly (`lib/colour-access.server.ts`) calls — so it is EXECUTED here, not
 * just found in a file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { seatIsFullCohost, seatsThatTakeColourGrants } from '@/lib/guest-access';
import { stripComments } from '@/lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(
  join(here, '../../../supabase/migrations/20271251336140_cohosts_come_from_the_guest_list.sql'),
  'utf8',
);
const SERVER = stripComments(readFileSync(join(here, 'colour-access.server.ts'), 'utf8'));
const CARD = stripComments(
  readFileSync(
    join(here, '../app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/promote-coordinator-card.tsx'),
    'utf8',
  ),
);

test('seatIsFullCohost matches the SQL seat_is_full_cohost list exactly', () => {
  const body = MIGRATION.match(/SELECT p_role_subtype IN \(([^)]*)\)/)?.[1];
  assert.ok(body, 'seat_is_full_cohost body not found');
  const sqlKinds = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1] ?? '');
  assert.ok(sqlKinds.length > 0);
  for (const k of sqlKinds) assert.equal(seatIsFullCohost(k), true, k);
  for (const k of ['viewer', 'wedding_planner_external', 'maid_of_honor', 'family_helper']) {
    assert.equal(seatIsFullCohost(k), false, k);
  }
});

test('only live, non-viewer, non-co-host seats take colour grants', () => {
  const seats = [
    { user_id: 'me', role_subtype: 'wedding_planner_external' }, // the viewer — never listed
    { user_id: 'bride', role_subtype: 'bride' }, // a full co-host — never listed
    { user_id: 'cohost', role_subtype: 'co_host' },
    { user_id: null, role_subtype: 'viewer' }, // waiting — no account to grant to
    { user_id: 'helper', role_subtype: 'viewer' },
    { user_id: 'planner', role_subtype: 'wedding_planner_external' },
  ];
  assert.deepEqual(
    seatsThatTakeColourGrants(seats, 'me').map((s) => s.user_id),
    ['helper', 'planner'],
  );
});

test('the one server assembly asks the pure rule, and the planner card asks the assembly', () => {
  assert.match(SERVER, /const eligible = seatsThatTakeColourGrants\(seats, viewerUserId\);/);
  assert.doesNotMatch(SERVER, /\.filter\(\(s\) => !seatIsFullCohost/, 'a second copy of the rule grew inline');
  assert.match(CARD, /await loadCoordinatorColourGrantees\(/, 'the planner card assembles its own grantees');
  assert.match(CARD, /<CoordinatorColourDomains\b/, 'the planner card lost the colour domains');
});
