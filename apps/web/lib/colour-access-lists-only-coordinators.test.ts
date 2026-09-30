/**
 * The Hosts page's COLOUR ACCESS card lists coordinators — never the couple.
 *
 * Owner 2026-09-30, on a screenshot of the card: "Claire Buanhog is not a
 * coordinator" — she is the Bride. Since 20271251336140 a full co-host seat
 * (bride, groom, partner, co-host, celebrant) is a `couple` member, and
 * `set_coordinator_colour_access` only grants to `coordinator` members, so
 * listing her offered four switches the gate would refuse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { seatIsFullCohost } from '@/lib/guest-access';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(
  join(here, '../../../supabase/migrations/20271251336140_cohosts_come_from_the_guest_list.sql'),
  'utf8',
);
const HOSTS_PAGE = readFileSync(join(here, '../app/dashboard/[eventId]/hosts/page.tsx'), 'utf8');

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

test('the hosts page drops full co-hosts before building colour grantees', () => {
  const start = HOSTS_PAGE.indexOf('colourGrantees = accepted');
  assert.ok(start > -1, 'colourGrantees chain not found');
  const chain = HOSTS_PAGE.slice(start, HOSTS_PAGE.indexOf('.map(', start));
  assert.match(chain, /\.filter\(\(r\) => !seatIsFullCohost\(r\.role_subtype\)\)/);
});
