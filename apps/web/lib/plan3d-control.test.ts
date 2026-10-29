/**
 * plan3d-control.test.ts — the 3D Plan's facts are honest (restored 2026-10-29 with the facts, behind ⓘ in Guests › Seats).
 * Unread is not empty: a refused read is "—", never a zero, and a delegate who was not shared the list is told so.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { resolvePlan3dStanding, resolvePlan3dFacts, type Plan3dEventRead, type Plan3dPlanRead, type Plan3dGuestRead } from './plan3d-control';

const NOW = new Date('2026-09-05T04:00:00Z').getTime(); // noon in Manila
const ev = (o: Partial<Plan3dEventRead> = {}): Plan3dEventRead => ({ measured: true, slug: 'maria-and-jose', eventDate: '2026-12-12', timezone: 'Asia/Manila', ...o });
const plan = (o: Partial<Plan3dPlanRead> = {}): Plan3dPlanRead => ({ measured: true, published: false, publishedAt: null, tables: 22, seated: 174, ...o });
const guests = (o: Partial<Plan3dGuestRead> = {}): Plan3dGuestRead => ({ shared: true, measured: true, total: 178, withAvatar: 12, ...o });

test('standing: draft / live / after — and null when the gate was not read', () => {
  assert.deepEqual(resolvePlan3dStanding(ev(), plan(), NOW), { state: 'draft', measured: true });
  assert.deepEqual(resolvePlan3dStanding(ev(), plan({ published: true, publishedAt: '2026-09-01T00:00:00Z' }), NOW), { state: 'live', measured: true });
  assert.deepEqual(resolvePlan3dStanding(ev({ eventDate: '2026-08-01' }), plan({ published: true }), NOW), { state: 'after', measured: true });
  assert.deepEqual(resolvePlan3dStanding(ev(), plan({ measured: false, published: false }), NOW), { state: null, measured: false });
});

test('facts: every unread fact is known:false with a null value — never a zero', () => {
  const f = resolvePlan3dFacts(ev({ measured: false }), plan({ measured: false }), guests({ measured: false }), NOW);
  assert.equal(f.length, 4);
  for (const x of f) {
    assert.equal(x.known, false, x.label);
    assert.equal(x.value, null, x.label);
  }
});

test('facts: the four cells, measured', () => {
  const f = resolvePlan3dFacts(ev(), plan({ published: true, publishedAt: '2026-09-01T00:00:00Z' }), guests(), NOW);
  assert.deepEqual(f.map((x) => x.label), ['Status', 'Seated', 'Made an avatar', 'Days to go']);
  assert.equal(f[0]!.value, 'Live · since 1 Sep');
  assert.equal(f[1]!.value, '174 of 178 · 22 tables');
  assert.equal(f[2]!.value, '12 guests · at setnayan.com/maria-and-jose/avatar');
  assert.match(f[3]!.value!, /^98 · 12 Dec$/);
  assert.equal(resolvePlan3dFacts(ev(), plan(), guests(), NOW)[0]!.value, 'Opens on the day');
  assert.equal(resolvePlan3dFacts(ev({ eventDate: '2026-09-05' }), plan(), guests(), NOW)[3]!.value, 'Today');
  assert.equal(resolvePlan3dFacts(ev({ eventDate: '2026-09-02' }), plan(), guests(), NOW)[3]!.value, 'Was 3 days ago');
  assert.equal(resolvePlan3dFacts(ev({ eventDate: null }), plan(), guests(), NOW)[3]!.value, 'No date yet');
});

test('an unread avatar count is "—" on its own — the seated count still counts', () => {
  const f = resolvePlan3dFacts(ev(), plan(), guests({ withAvatar: null }), NOW);
  assert.deepEqual(f[2], { label: 'Made an avatar', known: false, value: null });
  assert.equal(f[1]!.value, '174 of 178 · 22 tables');
});

test('a delegate without the guest list is told so — a third state, not a zero and not a dash', () => {
  const f = resolvePlan3dFacts(ev(), plan(), guests({ shared: false, measured: false }), NOW);
  assert.deepEqual(f[1], { label: 'Seated', known: true, value: 'Not shared with you' });
  assert.deepEqual(f[2], { label: 'Made an avatar', known: true, value: 'Not shared with you' });
});

test('the facts are drawn behind ⓘ in the Seats ⋯ menu, and an unread avatar count reaches the render as unread', () => {
  const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));
  const editor = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  const more = editor.slice(editor.indexOf('const phoneMore = ('), editor.indexOf('const phoneTrailing = ('));
  assert.match(more, /\{doorStrip\}\s*\{plan3dFactsRow\}/, 'the facts left the Seats ⋯ menu, beside the switch');
  assert.match(editor, /withAvatar: plan3d\?\.withAvatar \?\? null/, 'an unread avatar count is no longer "unread"');
  const facts = read('app/dashboard/[eventId]/seating/_components/seat-plan-facts.tsx');
  assert.match(facts, /<InfoTip[^>]*label="3D Plan"/, 'the facts are not behind an ⓘ');
  assert.match(facts, /f\.known && f\.value != null \? f\.value : '—'/, 'an unread fact no longer says —');
  const page = read('app/dashboard/[eventId]/seating/page.tsx');
  assert.match(page, /withAvatar: avatarCount\.error \? null : avatarCount\.count \?\? 0/, 'a refused avatar count would print 0');
});
