/**
 * 🖨 The badges' print file is the pill, outlined, with today's badges — and nothing the shop has not earned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgePrintSvg } from './shop-badge-print';
import { badgesForPrint, type ShopBadgeFacts } from './shop-badges';

const facts: ShopBadgeFacts = {
  verified: true,
  completedEvents: 50,
  trusted: { trusted_avg_rating: 4.8, trusted_review_count: 31 },
  inBusinessSinceYear: 2014,
  awards: [],
  nowYear: 2026,
};

test('one pill per badge, in print order, every word outlined (no <text> a print shop could lack the font for)', () => {
  const svg = badgePrintSvg(badgesForPrint(facts));
  const keys = [...svg.matchAll(/data-badge="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys, ['verified', 'milestone:50', 'rating', 'years']);
  assert.doesNotMatch(svg, /<text\b/);
  assert.match(svg, /data-qr-centre="setnayan"/, 'the official mark sits in the Verified circle');
  assert.match(svg, /<linearGradient id="foil0"/, 'the gold-foil edge');
  assert.match(svg, /^<\?xml/);
});

test('a medal un-earned since the design was made is not printed', () => {
  const svg = badgePrintSvg(badgesForPrint({ ...facts, completedEvents: 49 }));
  assert.doesNotMatch(svg, /milestone:50/);
  assert.match(svg, /milestone:25/);
});

test('grounds: dark and colour put SETNAYAN in foil; a bad colour falls back to the prototype green', () => {
  const dark = badgePrintSvg(badgesForPrint(facts).slice(0, 1), { ground: 'dark' });
  assert.match(dark, /fill="#151312"/);
  assert.match(dark, /fill="url\(#foil0\)"/);
  const colour = badgePrintSvg(badgesForPrint(facts).slice(0, 1), { ground: 'colour', colour: 'red;x' });
  assert.match(colour, /fill="#1F3A2C"/);
});
