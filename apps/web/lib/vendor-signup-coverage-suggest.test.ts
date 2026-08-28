import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchDetectedServicesToTrades, type SuggestableTrade } from './vendor-signup-coverage-suggest';

const TRADES: SuggestableTrade[] = [
  { key: 'photo_booth', label: 'Photo Booth', branch: 'Booths', aliases: ['360 booth', 'selfie mirror'] },
  { key: 'sorbetes_cart', label: 'Sorbetes Cart', branch: 'Food Cart', aliases: ['sorbetero', 'ice cream cart'] },
  { key: 'lights_sound', label: 'Lights & Sound', branch: 'Production' },
  { key: 'florist', label: 'Florist', branch: 'Design' },
];

test('matches a short trade-shaped phrase against the trade label', () => {
  // The ranker requires the LABEL to start with / contain the typed query
  // (it was built for a person typing a few characters), so a phrase must be
  // at least as short as the label to ever match — see the module docblock.
  const out = matchDetectedServicesToTrades(['Photo Booth'], TRADES, new Set());
  assert.equal(out.length, 1);
  assert.equal(out[0]!.key, 'photo_booth');
  assert.equal(out[0]!.sourcePhrase, 'Photo Booth');
});

test('a long descriptive phrase that is not label-shaped produces no suggestion', () => {
  // This is the documented, accepted limitation of a first build: a phrase
  // longer than any label it should match cannot satisfy startsWith/contains
  // in either direction, so it fails toward silence rather than a guess.
  const out = matchDetectedServicesToTrades(
    ['Photo booth rental services for weddings and parties'],
    TRADES,
    new Set(),
  );
  assert.equal(out.length, 0);
});

test('matches through a reviewed alias, not only the label', () => {
  const out = matchDetectedServicesToTrades(['sorbetero'], TRADES, new Set());
  assert.equal(out.length, 1);
  assert.equal(out[0]!.key, 'sorbetes_cart');
});

test('a phrase that matches nothing produces no suggestion — fails toward silence', () => {
  const out = matchDetectedServicesToTrades(['bespoke calligraphy invitations'], TRADES, new Set());
  assert.equal(out.length, 0);
});

test('never suggests a trade the shop already covers', () => {
  const out = matchDetectedServicesToTrades(
    ['Photo Booth', 'Florist'],
    TRADES,
    new Set(['photo_booth']),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.key, 'florist');
});

test('two phrases matching the same trade produce one suggestion, first wins', () => {
  const out = matchDetectedServicesToTrades(
    ['Sorbetes Cart', 'sorbetero for hire'],
    TRADES,
    new Set(),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.sourcePhrase, 'Sorbetes Cart');
});

test('empty and whitespace-only phrases are skipped', () => {
  const out = matchDetectedServicesToTrades(['', '   ', 'Florist'], TRADES, new Set());
  assert.equal(out.length, 1);
  assert.equal(out[0]!.key, 'florist');
});

test('respects the suggestion cap', () => {
  const many: SuggestableTrade[] = Array.from({ length: 10 }, (_, i) => ({
    key: `trade_${i}`,
    label: `Trade ${i}`,
    branch: 'Branch',
  }));
  const phrases = many.map((t) => t.label);
  const out = matchDetectedServicesToTrades(phrases, many, new Set(), 3);
  assert.equal(out.length, 3);
});
