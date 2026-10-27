/**
 * 🧍‍♀️➡️🧍 A ROLE HOLDER CAN SEND A PROXY — the pure rules (owner 2026-10-27, DECISION_LOG row of that name;
 * `lib/guest-proxy.ts`). The cale-ice pair is the fixture: Mrs. Ma. Theresa Sacdalan-Tria (a principal sponsor, Ninang)
 * is proxied by Maria Catherine Sacdalan. Nothing is read — every row is built here.
 *
 *   · only a ROLE holder may send a proxy ("this only works if they have role and not guest");
 *   · the proxy dresses and arrives as the ROLE — `effectiveRoleOf` feeds the SAME dress-code and call-time readers the
 *     guest page and the ticket use (`guestOutfitOf`, `guestArriveBy`), so the words agree everywhere;
 *   · THE PAIR COUNTS ONCE ("not having 2 guests but 1"): `countsTowardEvent` leaves the represented holder out, the
 *     proxy in; `withStandIns` draws BOTH rows, linked (owner "B", 2026-10-27), and `computeGuestStats` over them counts the pair once;
 *   · the host is asked — never acted for — when the holder says they can come after all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  withStandIns,
  cameAfterAll,
  effectiveRoleOf,
  entourageWithProxies,
  holdsARole,
  namedAProxy,
  proxyPairs,
  representedOnPrint,
  roleOfRecord,
  standingInWords,
} from './guest-proxy';
import { computeGuestStats, countsTowardEvent, guestHasTicket, type GuestRow } from './guests';
import { guestArriveBy } from './role-group-dress-code';
import { guestOutfitOf } from './guest-outfit';
import type { EntourageGroup } from './entourage';

const row = (p: Partial<GuestRow>): GuestRow =>
  ({
    guest_id: 'x',
    first_name: 'A',
    last_name: 'B',
    display_name: null,
    role: 'guest',
    extra_roles: [],
    rsvp_status: 'pending',
    invitation_sent_at: null,
    qr_token: 'tok',
    entry_source: 'host_seeded',
    passed_away: false,
    plus_one_count: 0,
    plus_one_allowed: false,
    plus_one_of_guest_id: null,
    ...p,
  }) as GuestRow;

const theresa = row({ guest_id: 'g-theresa', first_name: 'Ma. Theresa', last_name: 'Sacdalan-Tria', role: 'principal_sponsor_ninang', rsvp_status: 'declined', invitation_sent_at: '2026-09-20T00:00:00Z' });
const catherine = row({ guest_id: 'g-catherine', first_name: 'Maria Catherine', last_name: 'Sacdalan', role: 'guest', rsvp_status: 'attending', invitation_sent_at: '2026-10-27T00:00:00Z' });
const linked = { ...theresa, represented_by_guest_id: catherine.guest_id, represented_since: '2026-10-27T01:00:00Z' };
const ben = row({ guest_id: 'g-ben', first_name: 'Ben', last_name: 'Cruz', rsvp_status: 'pending' });

test('only a guest who HOLDS A ROLE may send a proxy — never a plain guest, never the couple or the celebrant', () => {
  assert.equal(holdsARole(theresa), true);
  assert.equal(holdsARole(ben), false, 'a plain guest was offered a proxy');
  assert.equal(holdsARole({ role: 'bride' }), false);
  assert.equal(holdsARole({ role: 'groom', extra_roles: ['candle_sponsor'] }), false, 'the couple can send a proxy to their own wedding');
  assert.equal(holdsARole({ role: 'celebrant' }), false);
  // A plain-guest main role with a real extra role holds that role.
  assert.equal(holdsARole({ role: 'guest', extra_roles: ['candle_sponsor'] }), true);
  assert.equal(roleOfRecord({ role: 'guest', extra_roles: ['candle_sponsor'] }), 'candle_sponsor');
});

test('the proxy DRESSES and ARRIVES as the role they stand in for — through the same readers the guest page uses', () => {
  const dressRole = effectiveRoleOf(catherine, { role: theresa.role, extra_roles: [] });
  assert.equal(dressRole, 'principal_sponsor_ninang');
  assert.equal(effectiveRoleOf(ben, null), 'guest', 'a guest who stands in for nobody wears their own role');
  const config = {
    groups: { principal_sponsors: { style: 'suit', callTime: '13:30' } },
    women: { groups: { principal_sponsors: { style: 'filipiniana' } } },
    roles: { guest: { style: 'suit' } },
  };
  // ⏰ Call time: the role's, never the doors'.
  assert.equal(guestArriveBy({ role: dressRole, config, general: '2:30 PM' }), '1:30 PM');
  assert.equal(guestArriveBy({ role: catherine.role, config, general: '2:30 PM' }), '2:30 PM', 'control: as herself she would arrive with the guests');
  // 👗 Dress code: the role's row, read by the ONE reading (`guestOutfitOf`) — not the Guests row.
  const asRole = guestOutfitOf({ role: dressRole, dressCodeConfig: config, palette: {}, roleNames: {}, person: { name_prefix: 'Mrs.', display_name: null, gender: 'woman', attire: 'neutral' } });
  const asSelf = guestOutfitOf({ role: 'guest', dressCodeConfig: config, palette: {}, roleNames: {}, person: { name_prefix: 'Mrs.', display_name: null, gender: 'woman', attire: 'neutral' } });
  assert.notDeepEqual(asRole, asSelf, 'the proxy wears the Guests row, not the role’s');
  assert.equal(standingInWords('Ma. Theresa Sacdalan-Tria', 'Principal Sponsor'), 'Standing in for Ma. Theresa Sacdalan-Tria · Principal Sponsor');
});

test('THE PAIR COUNTS ONCE — the represented holder is listed, the proxy is counted, with the proxy’s reply', () => {
  assert.equal(countsTowardEvent(linked), false, 'a represented role holder is counted beside their proxy');
  assert.equal(countsTowardEvent(catherine), true);
  assert.equal(countsTowardEvent(theresa), true, 'control: with nobody standing in she counts');
  const raw = [linked, catherine, ben];
  const stats = computeGuestStats(raw);
  assert.equal(stats.total, 2, 'the pair counted as two people');
  assert.equal(stats.attending, 1);
  assert.equal(stats.declined, 0, 'the role holder counted as "Not coming" AND the proxy as attending');
  // 🎟 Their proxy checks in with their OWN ticket; the holder has none.
  assert.equal(guestHasTicket(linked), false);
  assert.equal(guestHasTicket(catherine), true);
});

test('the Guest List draws BOTH rows, linked — the proxy findable with their own reply — and counts the pair once', () => {
  // Owner 2026-10-27: "Cannot find her on the list anymore. Seems like she fused with the original guest" → "B".
  const { rows, pairs, standingIn } = withStandIns([linked, catherine, ben]);
  assert.deepEqual(rows.map((r) => r.guest_id), ['g-theresa', 'g-catherine', 'g-ben'], 'the proxy lost their own row again');
  const own = rows.find((r) => r.guest_id === 'g-catherine')!;
  assert.equal(own.rsvp_status, catherine.rsvp_status, 'the proxy row is not their own reply');
  assert.equal(guestHasTicket(own), true, 'the proxy row has no ticket — the host cannot invite or check her in');
  assert.equal(rows.find((r) => r.guest_id === 'g-theresa')!.represented_by_guest_id, 'g-catherine', 'the holder row is counted again');
  assert.equal(pairs.get('g-theresa')?.proxyName, 'Maria Catherine Sacdalan', 'the holder row does not say who represents them');
  assert.equal(standingIn.get('g-catherine')?.holderId, 'g-theresa', 'the proxy row does not say whom they stand in for');
  // Two rows, ONE count — the same numbers as the raw list (owner: "not having 2 guests but 1").
  assert.deepEqual(computeGuestStats(rows), computeGuestStats([linked, catherine, ben]));
  assert.equal(computeGuestStats(rows).total, 2);
  // A link whose proxy is not on the list (a refused read) adds nothing — the holder stays uncounted.
  const half = withStandIns([linked, ben]);
  assert.equal(half.pairs.size, 0);
  assert.equal(computeGuestStats(half.rows).total, 1);
});

test('who stands in for whom — both ways', () => {
  const { proxyOf, holderOf } = proxyPairs([linked, catherine, ben]);
  assert.equal(proxyOf.get('g-theresa')?.guest_id, 'g-catherine');
  assert.equal(holderOf.get('g-catherine')?.guest_id, 'g-theresa');
  assert.equal(proxyOf.size, 1);
});

test('the host is ASKED when the holder says they can come after all — never on an older reply', () => {
  const after = { ...linked, rsvp_status: 'attending' as const, rsvp_set_by: 'guest' as const, rsvp_responded_at: '2026-10-27T05:00:00Z' };
  assert.equal(cameAfterAll(after), true);
  assert.equal(cameAfterAll({ ...after, rsvp_responded_at: '2026-10-20T00:00:00Z' }), false, 'a yes from before the link reads as "came after all"');
  assert.equal(cameAfterAll({ ...after, rsvp_set_by: 'host' }), false, 'the host’s own pick is not the guest saying so');
  assert.equal(cameAfterAll(theresa), false);
  assert.equal(namedAProxy({ proxy_named_by_guest: '  Maria Catherine Sacdalan ' }), 'Maria Catherine Sacdalan');
  assert.equal(namedAProxy({ proxy_named_by_guest: 'X', represented_by_guest_id: 'g' }), null, 'a typed name outlives the link');
});

test('the prints name the role holder "(represented by …)" — everyone else as they were', () => {
  const groups = [
    {
      key: 'sponsors',
      label: 'Principal Sponsors',
      names: {},
      rows: [[{ id: 'g-theresa', name: 'Mrs. Ma. Theresa Sacdalan-Tria', role: 'principal_sponsor_ninang', walk: null, place: 0 }, { id: 'g-ramon', name: 'Mr. Ramon Tria', role: 'principal_sponsor_ninong', walk: null, place: 0 }]],
    },
  ] as unknown as EntourageGroup[];
  const out = entourageWithProxies(groups, new Map([['g-theresa', 'Maria Catherine Sacdalan']]));
  const [left, right] = out[0]!.rows[0]!;
  assert.equal(left?.name, representedOnPrint('Mrs. Ma. Theresa Sacdalan-Tria', 'Maria Catherine Sacdalan'));
  assert.equal(left?.name, 'Mrs. Ma. Theresa Sacdalan-Tria (represented by Maria Catherine Sacdalan)');
  assert.equal(right?.name, 'Mr. Ramon Tria');
  assert.equal(entourageWithProxies(groups, new Map()), groups);
});
