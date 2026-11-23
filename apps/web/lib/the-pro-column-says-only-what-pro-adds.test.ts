/**
 * 🎟 THE EVENT PRO COLUMN SAYS ONLY WHAT PRO ADDS (owner's plan table, 21 Nov 2026, "Yes correct"; ship review of #8004).
 * Event Plus holds the whole Event Hub since 20 Nov, so every theme, reveal, scene, print and the owner's own media are
 * Plus's — listing them under Pro told buyers Plus lacks them. Tickets and the QR sheet are free (same message).
 * Pro adds: Setnayan AI · more Papic credits · full-size originals kept 6 months · 1 GB · no Setnayan mark.
 * 🛡 SABOTAGE: put 'Nine themes, every reveal and scene animation' back in the Pro column → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_PLANS } from '@/lib/features-page';
import { proMore } from '@/app/_components/frontdoor/front-door-landing-data';

const pro = EVENT_PLANS.find((c) => c.name === 'Event Pro');

test('Pro lists no Plus item and nothing free as paid', () => {
  assert.ok(pro, 'the Event Pro column is gone');
  for (const line of pro!.lines) {
    assert.doesNotMatch(line, /\btheme|reveal|scene|print|ticket|poster|invitation|your own photos/i, `Pro claims a Plus or free item: "${line}"`);
  }
});

test('Pro says what Pro adds, from the owner’s table', () => {
  const said = pro!.lines.join(' · ');
  assert.match(said, /Setnayan AI/);
  assert.match(said, /kept 6 months/);
  assert.match(said, /no Setnayan mark/);
  assert.ok(proMore({ proCredits: null } as never).some((l) => /kept 6 months/.test(l)), 'the front page’s Pro card leaves out the 6-month originals');
});
