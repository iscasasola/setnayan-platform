/**
 * Unit suite for the non-wedding Run-of-Show seed. Guards: weddings are never
 * seeded here, core beats always show, signal-gated beats only appear when the
 * brief backs them, notes are enriched from captured signals, and timing is
 * monotonic + anchored to the event date.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRunOfShowSeed, type RunOfShowSeedBlock } from './schedule-run-of-show';

const DATE = '2026-11-14';
const labels = (b: RunOfShowSeedBlock[]) => b.map((x) => x.label);

test('weddings are never seeded here (they own a separate spine)', () => {
  assert.deepEqual(buildRunOfShowSeed('wedding', { cotillion: [{ name: 'x' }] }, DATE), []);
  assert.deepEqual(buildRunOfShowSeed(null, {}, DATE), []);
  assert.deepEqual(buildRunOfShowSeed(undefined, {}, DATE), []);
});

test('an unknown non-wedding type falls back to the generic spine', () => {
  const b = buildRunOfShowSeed('tournament', {}, DATE);
  assert.ok(b.length >= 4);
  assert.ok(labels(b).includes('Guest arrival'));
  assert.ok(labels(b).includes('Socials'));
});

test('debut: core 18s always show; cotillion appears only when captured', () => {
  const bare = buildRunOfShowSeed('debut', {}, DATE);
  assert.ok(labels(bare).includes('18 Roses'));
  assert.ok(labels(bare).includes('18 Candles'));
  assert.ok(labels(bare).includes('18 Treasures'));
  assert.ok(!labels(bare).includes('Cotillion de honor')); // no signal → no beat

  const withCourt = buildRunOfShowSeed('debut', { cotillion: [{ name: 'A' }, { name: 'B' }] }, DATE);
  assert.ok(labels(withCourt).includes('Cotillion de honor'));
  const cotillion = withCourt.find((x) => x.label === 'Cotillion de honor')!;
  assert.match(cotillion.notes ?? '', /Court of 2/);
});

test('debut: 18 Candles note names the captured guests', () => {
  const b = buildRunOfShowSeed('debut', { eighteen_candles: [{ name: 'Tita' }, { name: 'Lola' }] }, DATE);
  const candles = b.find((x) => x.label === '18 Candles')!;
  assert.match(candles.notes ?? '', /Tita, Lola/);
});

test('anniversary: renewal + tribute beats are signal-gated', () => {
  const bare = buildRunOfShowSeed('anniversary', {}, DATE);
  assert.ok(!labels(bare).includes('Renewal of vows / Thanksgiving'));

  const rich = buildRunOfShowSeed('anniversary', { renewal_of_vows: true, tribute_program: 'yes' }, DATE);
  assert.ok(labels(rich).includes('Renewal of vows / Thanksgiving'));
  assert.ok(rich.some((x) => x.label.startsWith('Tribute program')));
});

test('gender reveal: method enriches the reveal note; guessing game gated', () => {
  const b = buildRunOfShowSeed('gender_reveal', { reveal_method: 'smoke cannon', guessing_game: true }, DATE);
  assert.ok(labels(b).includes('Guessing game & team assignments'));
  const reveal = b.find((x) => x.label === 'The reveal')!;
  assert.match(reveal.notes ?? '', /smoke cannon/);

  const noGame = buildRunOfShowSeed('gender_reveal', { reveal_method: 'balloon box' }, DATE);
  assert.ok(!labels(noGame).includes('Guessing game & team assignments'));
});

test('christening godparent count enriches the message beat', () => {
  const b = buildRunOfShowSeed(
    'christening',
    { godparents_principal: [{ name: 'a' }], godparents_secondary: [{ name: 'b' }, { name: 'c' }] },
    DATE,
  );
  const msg = b.find((x) => x.label.startsWith('Message from parents'))!;
  assert.match(msg.notes ?? '', /3 godparents/);
});

test('blocks are anchored to the event date and time-ordered', () => {
  const b = buildRunOfShowSeed('debut', { cotillion: [{ name: 'x' }] }, DATE);
  for (const blk of b) {
    assert.ok(blk.start_at.startsWith('2026-11-14'), `${blk.label} not on event date: ${blk.start_at}`);
    assert.ok(new Date(blk.end_at) > new Date(blk.start_at), `${blk.label}: end before start`);
  }
  // sort_order strictly increases; start times are non-decreasing.
  for (let i = 1; i < b.length; i++) {
    const cur = b[i]!;
    const prev = b[i - 1]!;
    assert.ok(cur.sort_order > prev.sort_order, 'sort_order not increasing');
    assert.ok(new Date(cur.start_at) >= new Date(prev.start_at), 'start times out of order');
  }
});

test('every block is well-formed and pure (no input mutation)', () => {
  const sig = { cotillion: [{ name: 'x' }], eighteen_candles: [{ name: 'y' }] };
  const a = buildRunOfShowSeed('debut', sig, DATE);
  const b = buildRunOfShowSeed('debut', sig, DATE);
  assert.deepEqual(a, b); // deterministic
  assert.deepEqual(sig, { cotillion: [{ name: 'x' }], eighteen_candles: [{ name: 'y' }] }); // not mutated
  for (const blk of a) {
    assert.ok(blk.label && blk.block_type, 'missing label/type');
    assert.equal(typeof blk.is_public, 'boolean');
    assert.ok(blk.notes === null || typeof blk.notes === 'string');
  }
});

test('no-date seed still produces valid ISO placeholders', () => {
  const b = buildRunOfShowSeed('birthday', {}, null);
  assert.ok(b.length > 0);
  for (const blk of b) assert.ok(!Number.isNaN(new Date(blk.start_at).getTime()));
});
