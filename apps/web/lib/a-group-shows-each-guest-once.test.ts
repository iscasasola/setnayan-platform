/**
 * A GROUP SHOWS EACH GUEST ONCE — 7b's roster finally reaches a screen (S37).
 *
 * `public.cluster_guest_roster()` shipped 2026-09-02 as "the read shape" of
 * item 7b and nothing ever called it: the resolver made Liza-at-the-shower and
 * Liza-at-the-wedding ONE person in the database, and no page ever said so.
 * S26's both-ends guard ranked it `rpc-no-caller`; this is the missing end.
 *
 * Two halves, because they fail differently:
 *   1. `orderRoster()` is pure, so it is EXECUTED: the people on more than one
 *      list come first, a nameless guest is kept (sorted last, never dropped),
 *      and `shared` counts people, not guest rows.
 *   2. The page is a server component with live reads, so the rule that can
 *      regress — the roster is mounted, and a refused read is never rendered as
 *      "no guests" — is pinned at the source, comments stripped, anchors
 *      asserted before anything else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderRoster, type ClusterRosterPerson } from './clusters';

function person(name: string | null, events: string[]): ClusterRosterPerson {
  return {
    identity_key: `${name ?? 'anon'}-${events.join('+')}`,
    person_id: events.length > 1 ? `p-${name}` : null,
    display_name: name,
    celebrations: events.map((e, i) => ({
      event_id: e,
      guest_id: `${name ?? 'anon'}-${e}-${i}`,
      rsvp_status: 'pending',
    })),
  };
}

test('people on more than one guest list come first, then by name', () => {
  const { people } = orderRoster([
    person('Carlo', ['wedding']),
    person('Ana', ['wedding']),
    person('Liza', ['wedding', 'shower']),
  ]);
  assert.deepEqual(
    people.map((p) => p.display_name),
    ['Liza', 'Ana', 'Carlo'],
    'the guest invited twice is the reason a group has a roster — she must lead it',
  );
});

test('a guest with no usable name is kept, and sorted after the named ones', () => {
  const { people } = orderRoster([person(null, ['wedding']), person('  ', ['wedding']), person('Ana', ['wedding'])]);
  assert.equal(people.length, 3, 'a nameless guest was dropped from the roster');
  assert.equal(people[0]!.display_name, 'Ana');
});

test('`shared` counts PEOPLE on two or more lists, not guest rows', () => {
  const { shared } = orderRoster([
    person('Liza', ['wedding', 'shower', 'christening']),
    person('Marco', ['wedding', 'shower']),
    person('Ana', ['wedding']),
  ]);
  assert.equal(shared, 2, 'three celebrations for one person is still ONE shared person');
});

test('ordering does not mutate the rows it was given', () => {
  const rows = [person('B', ['w']), person('A', ['w', 's'])];
  const before = rows.map((r) => r.display_name);
  orderRoster(rows);
  assert.deepEqual(rows.map((r) => r.display_name), before);
});

// The cluster PAGE (`/dashboard/clusters/[clusterId]`) is retired — final check R3, 25 Nov; the roster's order stays held above.
