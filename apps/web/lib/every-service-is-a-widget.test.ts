/**
 * lib/every-service-is-a-widget.test.ts — HOME'S SERVICES, AS WIDGETS (owner 2026-10-23, approved
 * `prototypes/home_service_widgets_2026-10-23.html`, with his three answers: *"Event Hub Pro folded into Event Hub, no
 * visits line, order Papic → Event Hub → rest"*).
 *
 * Held on what `homeServices` returns (the list Home draws), never on a flag:
 *   1. the order is Papic, then the Event Hub, then the rest;
 *   2. the Event Hub is ONE entry — never a second "Event Hub Pro" row, never a slim "Add" line — and its Pro is the
 *      card's ◆ line (`hubProLine`), in every state the Pro row can be in;
 *   3. no line anywhere says "visits" (nothing counts them).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_PAID_KEYS, homeServices, hubProLine, type HomePaidFact, type HomeSkuKey, type PaidRow } from './home-first-screen';

const E = 'S89E-TEST000001';
const owned = (href: string): HomePaidFact => ({ card: { state: 'added', stateText: '', href } });
const priced = (href: string): HomePaidFact => ({ card: { state: 'price', stateText: '', href }, price: '₱1,500' });

function list(hub: HomePaidFact, rest: Partial<Record<HomeSkuKey, HomePaidFact>> = {}) {
  return homeServices({
    next: 'plan',
    storeShell: false,
    eventId: E,
    papic: 'On',
    ai: 'Try it',
    paid: { ai: priced('/a'), live: owned('/l'), music: priced('/m'), booth: owned('/b'), ...rest, hub },
  });
}

test('1 · the order is Papic → Event Hub → the rest', () => {
  assert.deepEqual(HOME_PAID_KEYS.slice(0, 2), ['papic', 'hub']);
  const keys = list(owned('/h')).map((s) => s.key);
  assert.equal(keys[0], 'papic');
  assert.equal(keys[1], 'hub', `the Event Hub is not right after Papic: ${keys.join(' · ')}`);
});

test('2 · the Event Hub is one card — Pro is its ◆ line, never a row or an "Add" of its own', () => {
  for (const [state, fact] of [
    ['owned', owned('/h')],
    ['not added', priced('/h')],
    ['pending', { card: { state: 'pending', stateText: '', href: '/h' } }],
    ['unread', { card: { state: 'added', stateText: '', href: '/h' }, unread: true }],
  ] as const) {
    const all = list(fact as HomePaidFact);
    const hubs = all.filter((s) => s.key === 'hub');
    assert.equal(hubs.length, 1, `${state}: ${hubs.length} Event Hub entries`);
    const hub = hubs[0]!;
    assert.equal(hub.name, 'Event Hub', `${state}: the card is named ${hub.name}`);
    assert.ok(hub.hub, `${state}: the Event Hub entry carries no card facts`);
    assert.equal(hub.paid, undefined, `${state}: the Event Hub is drawn as a paid row again`);
    assert.match(hub.status, /^◆ /, `${state}: the status is not the ◆ line — "${hub.status}"`);
    assert.ok(!all.some((s) => /Event Hub Pro/.test(s.name)), `${state}: an "Event Hub Pro" row came back`);
  }
  // In the store shell there is no paid list at all (the app's own rows stand there).
  assert.equal(homeServices({ next: 'plan', storeShell: true, eventId: E, papic: 'On', ai: '—', paid: null }).some((s) => s.key === 'hub'), false);
});

test('2b · the ◆ line, state by state — never a price', () => {
  const row = (state: PaidRow['state']): PaidRow => ({ state, href: '/h', line: {} });
  assert.equal(hubProLine(null), '◆ Free');
  assert.equal(hubProLine(row('owned')), '◆ Pro on · themes, photo and video backgrounds');
  assert.equal(hubProLine(row('pending')), '◆ Pro · payment sent · switches on once approved');
  assert.equal(hubProLine(row('unread')), '◆ —');
  assert.equal(hubProLine(null, { full: false, count: 2 }), '◆ Pro · 2 parts on');
  assert.equal(hubProLine(null, { full: true, count: 9 }), '◆ Pro on · themes, photo and video backgrounds');
  for (const line of [hubProLine(null), hubProLine(row('pending')), hubProLine(null, { full: false, count: 1 })]) {
    assert.doesNotMatch(line, /₱|\d+\.\d\d/, `a price reached the ◆ line: ${line}`);
  }
});

test('3 · no visits line (nothing counts visits)', () => {
  for (const s of list(owned('/h'))) assert.doesNotMatch(s.status, /visit/i, `${s.key}: "${s.status}"`);
});
