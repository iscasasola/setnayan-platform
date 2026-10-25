/**
 * pricing-elsewhere.test.ts — every figure /pricing quotes about ANOTHER site has a source and a read date.
 *
 * They are facts about other sites (owner 2026-10-25, prototype `pricing_free_plus_addons_2026-10-25` revision 4), so
 * the only honest way to keep them is with the page each was read from and the day. A figure without a source is an
 * invented claim about a competitor.
 *
 * SABOTAGE (run red, then restored — see the PR): `sources: []` on siteFull → RED; readOn '' → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ELSEWHERE, ELSEWHERE_CHECKIN_PAID_PLAN, ELSEWHERE_READ_ON, aboutPhp, elsewhereOneEventPhp } from './pricing-elsewhere';

test('every other-site figure has an https source and the day it was read', () => {
  const facts = [...Object.entries(ELSEWHERE), ['checkin', ELSEWHERE_CHECKIN_PAID_PLAN] as const];
  assert.ok(facts.length >= 8);
  for (const [k, f] of facts) {
    assert.ok(f.sources.length >= 1, `${k} has no source`);
    for (const u of f.sources) assert.equal(new URL(u).protocol, 'https:', `${k}: ${u} is not an https page`);
    assert.match(f.readOn, /^\d{4}-\d{2}-\d{2}$/, `${k} has no read date`);
    assert.equal(f.readOn, ELSEWHERE_READ_ON);
    assert.ok(f.what.trim().length > 8, `${k} does not say what it is`);
    if ('value' in f) assert.ok(Number.isFinite(f.value) && f.value > 0, `${k} has no figure`);
  }
});

test('the page\'s "about" and "at least" figures are arithmetic on those facts, not new claims', () => {
  assert.equal(aboutPhp(ELSEWHERE.siteFull.value), 2500);
  assert.equal(aboutPhp(ELSEWHERE.livestreamBusiness.value), 2700);
  assert.equal(aboutPhp(ELSEWHERE.livestreamPersonal.value), 3000);
  assert.equal(elsewhereOneEventPhp(), ELSEWHERE.siteFull.value + ELSEWHERE.livestreamPersonal.value);
});
