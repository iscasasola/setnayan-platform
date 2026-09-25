import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEventMenuSections, eventMenuRowClaims, eventMenuRows } from './customer-menu';

/**
 * ONE ROW, "EVENT HUB MAKER", WITH THREE DOORS INSIDE (owner 2026-09-25; plan
 * Phase 1 "Menu"). The Logo Maker and Editorial leave the tree; their pages
 * light the Maker row, so a couple standing in either still sees where they
 * are. Love Story never had a row and gets none.
 */

const EVENT_ID = 'S89E-TESTEVENT';
const BASE = `/dashboard/${EVENT_ID}`;
const STUDIO = [
  { key: 'mood-board', href: `${BASE}/studio/mood-board`, name: 'Mood Board' },
  { key: 'palogo', href: `${BASE}/monogram`, name: 'Logo Maker' },
  { key: 'pakanta', href: `${BASE}/studio/pakanta`, name: 'Pakanta' },
];

for (const phase of ['plan', 'dayof', 'after'] as const) {
  test(`${phase}: one Event Hub Maker row holds the Logo Maker and Editorial`, () => {
    const rows = eventMenuRows(
      buildEventMenuSections(EVENT_ID, { phase, websiteEnabled: true, studioRows: STUDIO }),
    );
    const makers = rows.filter((r) => r.href === `${BASE}/launch`);
    assert.equal(makers.length, 1, 'one row');
    assert.equal(makers[0]!.label, 'Event Hub Maker');
    assert.equal(makers[0]!.key, 'launch', 'the key is frozen — label change only');
    assert.ok(!rows.some((r) => r.key === 'palogo'), 'the Logo Maker is a door in the Maker, not a row');
    assert.ok(!rows.some((r) => r.key === 'editorial'), 'Editorial is a door in the Maker, not a row');
    const claims = eventMenuRowClaims(makers[0]!);
    for (const p of ['/monogram', '/story', '/website']) {
      assert.ok(claims.some((c) => c.startsWith(`${BASE}${p}`)), `${p} must light the Maker row`);
    }
  });
}

test('with no Event Hub for this kind, the Logo Maker and Editorial keep their own rows', () => {
  const rows = eventMenuRows(
    buildEventMenuSections(EVENT_ID, { phase: 'after', websiteEnabled: false, studioRows: STUDIO }),
  );
  assert.ok(!rows.some((r) => r.key === 'launch'));
  assert.ok(rows.some((r) => r.key === 'palogo'), 'never absorbed into a row that is not there');
  assert.ok(rows.some((r) => r.key === 'editorial'));
});
