/**
 * plan3d-control.test.ts — the control centre's decisions are honest.
 * Unread is not empty; the ladder of next steps has one rung per state; the
 * finalize date is shown, never enforced.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePlan3dStanding,
  resolvePlan3dFacts,
  resolvePlan3dNextStep,
  resolvePlan3dSources,
  resolveGuestListFinalize,
  type Plan3dEventRead,
  type Plan3dPlanRead,
  type Plan3dGuestRead,
} from './plan3d-control';

const NOW = new Date('2026-09-05T04:00:00Z').getTime(); // noon in Manila
const ev = (o: Partial<Plan3dEventRead> = {}): Plan3dEventRead => ({
  measured: true, slug: 'maria-and-jose', eventDate: '2026-12-12', timezone: 'Asia/Manila',
  guestListEditDeadline: null, guestListLockedAt: null, ...o,
});
const plan = (o: Partial<Plan3dPlanRead> = {}): Plan3dPlanRead => ({
  measured: true, published: false, publishedAt: null, tables: 22, seated: 174, boothCount: 3, brandedBooths: 1, photoVisibility: 'table', autoplace: true, ...o,
});
const guests = (o: Partial<Plan3dGuestRead> = {}): Plan3dGuestRead => ({ shared: true, measured: true, total: 178, withAvatar: 12, ...o });
const BASE = '/dashboard/E';

test('standing: draft / live / after — and null when the gate was not read', () => {
  assert.deepEqual(resolvePlan3dStanding(ev(), plan(), NOW), { state: 'draft', measured: true });
  assert.deepEqual(resolvePlan3dStanding(ev(), plan({ published: true, publishedAt: '2026-09-01T00:00:00Z' }), NOW), { state: 'live', measured: true });
  assert.deepEqual(resolvePlan3dStanding(ev({ eventDate: '2026-08-01' }), plan({ published: true }), NOW), { state: 'after', measured: true });
  // 🔑 a refused gate read is NOT a draft
  assert.deepEqual(resolvePlan3dStanding(ev(), plan({ measured: false, published: false }), NOW), { state: null, measured: false });
});

test('facts: every unread fact is known:false with a null value — never a zero', () => {
  const f = resolvePlan3dFacts(ev({ measured: false }), plan({ measured: false }), guests({ measured: false }), NOW);
  assert.equal(f.length, 4);
  for (const x of f) { assert.equal(x.known, false, x.label); assert.equal(x.value, null, x.label); }
});

test('facts: the four cells, measured', () => {
  const f = resolvePlan3dFacts(ev(), plan({ published: true, publishedAt: '2026-09-01T00:00:00Z' }), guests(), NOW);
  assert.deepEqual(f.map((x) => x.label), ['Status', 'Seated', 'Made an avatar', 'Days to go']);
  assert.equal(f[0]!.value, 'Live · since 1 Sep');
  assert.equal(f[1]!.value, '174 of 178 · 22 tables');
  assert.equal(f[2]!.value, '12 guests · at setnayan.com/maria-and-jose/avatar');
  assert.match(f[3]!.value!, /^98 · 12 Dec$/);
  assert.equal(resolvePlan3dFacts(ev({ eventDate: '2026-09-05' }), plan(), guests(), NOW)[3]!.value, 'Today');
  assert.equal(resolvePlan3dFacts(ev({ eventDate: '2026-09-02' }), plan(), guests(), NOW)[3]!.value, 'Was 3 days ago');
  assert.equal(resolvePlan3dFacts(ev({ eventDate: null }), plan(), guests(), NOW)[3]!.value, 'No date yet');
});

test('next step: one rung per state, in order', () => {
  const step = (e = ev(), p = plan(), g = guests()) => resolvePlan3dNextStep(e, p, g, BASE, NOW);
  assert.equal(step(ev(), plan({ measured: false })).tone, 'failed');
  assert.equal(step(ev(), plan({ tables: 0 })).headline, 'Place your first table');
  // auto-seating ON (the default): a guest with no seat means not enough
  // tables — the act is ADD A TABLE, never "seat them by hand"
  const short = step(ev(), plan({ seated: 174 }), guests({ total: 178 }));
  assert.equal(short.headline, '4 guests have no seat yet');
  assert.equal(short.cta, 'Add a table');
  assert.match(short.blurb, /seats fill themselves/);
  assert.equal(step(ev(), plan({ seated: 177 }), guests({ total: 178 })).headline, '1 guest has no seat yet');
  // auto-seating OFF: they really are the couple's to place
  const manual = step(ev(), plan({ seated: 174, autoplace: false }), guests({ total: 178 }));
  assert.equal(manual.headline, '4 guests have no seat');
  assert.equal(manual.cta, 'Seat them');
  // fully seated, draft, list still open (deadline = event − 14d) → WAIT, not a gate
  const wait = step(ev(), plan({ seated: 178 }), guests({ total: 178 }));
  assert.equal(wait.tone, 'wait');
  assert.match(wait.headline, /finalizes 28 Nov/);
  assert.equal(wait.href, null, 'the act is the switch on the page — not a door');
  // list finalized → publish
  const pub = step(ev({ guestListLockedAt: '2026-09-01T00:00:00Z' }), plan({ seated: 178 }), guests({ total: 178 }));
  assert.equal(pub.headline, 'Publish — your guests can walk the room');
  // live → print
  assert.equal(step(ev(), plan({ published: true, seated: 178 }), guests({ total: 178 })).headline, 'Print your table signs');
  // after → nothing to do, quietly
  assert.equal(step(ev({ eventDate: '2026-08-01' }), plan({ published: true, seated: 178 }), guests({ total: 178 })).tone, 'quiet');
});

test('a delegate without the guest list is told so — a third state, not a zero and not a dash', () => {
  const f = resolvePlan3dFacts(ev(), plan(), guests({ shared: false, measured: false }), NOW);
  assert.deepEqual(f[1], { label: 'Seated', known: true, value: 'Not shared with you' });
  assert.deepEqual(f[2], { label: 'Made an avatar', known: true, value: 'Not shared with you' });
  const s = resolvePlan3dSources(ev(), plan(), guests({ shared: false, measured: false }), BASE, NOW);
  assert.equal(s[0]!.value, 'Not shared with you');
  assert.match(s[1]!.value!, /174 seated/, 'the seat plan row must not print "with no seat" from a list it cannot read');
  // and the next step never sends them to seat guests they cannot see
  const step = resolvePlan3dNextStep(ev(), plan(), guests({ shared: false, measured: false }), BASE, NOW);
  assert.notEqual(step.href, `${BASE}/seating`);
});

test('guest-list finalize: closed / dated / undated / unread', () => {
  assert.equal(resolveGuestListFinalize(ev({ guestListLockedAt: '2026-09-01T00:00:00Z' }), NOW).label, 'finalized');
  assert.match(resolveGuestListFinalize(ev(), NOW).label, /^finalizes 28 Nov$/);
  assert.equal(resolveGuestListFinalize(ev({ eventDate: null }), NOW).label, 'no finalize date');
  assert.equal(resolveGuestListFinalize(ev({ measured: false }), NOW).label, 'Couldn’t read it just now');
});

test('sources: three doors, each carrying its state, unread rows say so', () => {
  const s = resolvePlan3dSources(ev(), plan(), guests(), BASE, NOW);
  assert.deepEqual(s.map((r) => r.key), ['guests', 'seatplan', 'moodboard']);
  assert.equal(s[0]!.value, '178 guests · finalizes 28 Nov');
  assert.equal(s[1]!.value, '22 tables · 4 with no seat · 3 supplier booths (1 branded) · auto-seating on');
  assert.match(resolvePlan3dSources(ev(), plan({ autoplace: false }), guests(), BASE, NOW)[1]!.value!, /auto-seating off$/);
  assert.deepEqual(s.map((r) => r.href), [`${BASE}/guests`, `${BASE}/seating`, `${BASE}/studio/mood-board`]);
  const unread = resolvePlan3dSources(ev(), plan({ measured: false }), guests({ measured: false }), BASE, NOW);
  assert.equal(unread[0]!.known, false); assert.equal(unread[1]!.known, false);
});
