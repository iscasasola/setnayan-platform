/**
 * detectNegotiation() — the deterministic chat negotiation auto-reader. Locks
 * which messages raise a schedule / discount / inclusion / proposal topic (and
 * which stay plain chatter), plus the extracted excerpt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectNegotiation } from './chat-negotiation-detect';

const primary = (s: string) => detectNegotiation(s).primary;
const types = (s: string) => detectNegotiation(s).signals.map((x) => x.type);

test('a date + time is read as a schedule request', () => {
  const r = detectNegotiation("let's meet on 2026-09-17 14:30");
  assert.equal(r.primary, 'schedule');
  const ex = r.signals[0]?.excerpt;
  assert.ok(ex && /2026-09-17/.test(ex));
});

test('meeting intent + a loose date is a schedule request', () => {
  assert.equal(primary('can we do an ocular on Feb 14?'), 'schedule');
  assert.equal(primary('are you available Friday afternoon?'), 'schedule');
  assert.equal(primary('kita tayo bukas ng hapon'), 'schedule'); // Tagalog
});

test('discount asks are read as discount requests', () => {
  assert.equal(primary('can you lower the price a bit?'), 'discount');
  assert.equal(primary('do you have any promo? 10% off maybe'), 'discount');
  assert.equal(primary('pwede pa ba ng tawad'), 'discount'); // Tagalog
  const r = detectNegotiation('can you give 10% off');
  assert.ok(r.signals.find((s) => s.type === 'discount')?.excerpt?.includes('10'));
});

test('inclusion asks are read as inclusion requests', () => {
  assert.equal(primary('can you add a second photographer?'), 'inclusion');
  assert.equal(primary('does the package come with a drone?'), 'inclusion');
  assert.equal(primary('sana may prenup kasama'), 'inclusion'); // Tagalog
});

test('a price/quote ask is read as a quote request', () => {
  assert.equal(primary('how much is your full-day package?'), 'proposal');
  assert.equal(primary('magkano po ang rate ninyo?'), 'proposal'); // Tagalog
});

test('a message can raise more than one topic', () => {
  const t = types('can you add a drone and give a discount?');
  assert.ok(t.includes('inclusion'));
  assert.ok(t.includes('discount'));
});

test('plain chatter raises no negotiation topic', () => {
  assert.equal(detectNegotiation('thank you so much, excited to work with you!').hasSignal, false);
  assert.equal(detectNegotiation('the venue looks beautiful').hasSignal, false);
  assert.equal(detectNegotiation('').hasSignal, false);
});

test('a bare date with no time or intent is NOT a schedule request', () => {
  // A date mentioned in passing shouldn't hijack the message.
  assert.equal(detectNegotiation('our wedding is on Feb 14, 2027').primary, null);
});
