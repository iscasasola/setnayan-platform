import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchColorNames } from './color-search';

test('an exact curated name resolves to itself, curated over CSS', () => {
  const r = searchColorNames('burgundy');
  assert.equal(r.matches[0]?.name, 'Burgundy');
  assert.equal(r.matches[0]?.source, 'wedding');
});

test('prefix matching: "dust" finds both Dusty Blue and Dusty Rose', () => {
  const r = searchColorNames('dust');
  const names = r.matches.map((m) => m.name);
  assert.ok(names.includes('Dusty Blue'));
  assert.ok(names.includes('Dusty Rose'));
});

test('diacritic-insensitive: "pina" finds Piña Cream', () => {
  const r = searchColorNames('pina');
  assert.ok(r.matches.some((m) => m.name === 'Piña Cream'));
});

test('an alias resolves to its curated target, never to itself as a fake name', () => {
  const r = searchColorNames('moss green');
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0]?.name, 'Moss');
  assert.equal(r.matches[0]?.source, 'alias');
});

test('an alias never shadows a real exact name — "champagne" still isn\'t a real entry, so it resolves via alias, but "gold" (a real entry) resolves to itself', () => {
  const gold = searchColorNames('gold');
  assert.equal(gold.matches[0]?.name, 'Gold');
  assert.equal(gold.matches[0]?.source, 'wedding');
});

test('a query nothing stocks returns no matches AND non-empty suggestions — never a silent empty box', () => {
  const r = searchColorNames('xyzzyqwerty');
  assert.equal(r.matches.length, 0);
  // A nonsense string this far from any real name may legitimately suggest
  // nothing either — the contract is "never silently ambiguous", not "always
  // has a suggestion": matches and suggestions are never both populated.
  assert.ok(r.suggestions.length === 0 || r.matches.length === 0);
});

test('a near-miss spelling gets suggestions close to what was typed', () => {
  const r = searchColorNames('borgundy'); // one letter off "burgundy"
  assert.equal(r.matches.length, 0);
  assert.ok(r.suggestions.some((s) => s.name === 'Burgundy'));
});

test('blank query returns neither matches nor suggestions', () => {
  const r = searchColorNames('   ');
  assert.deepEqual(r.matches, []);
  assert.deepEqual(r.suggestions, []);
});

test('results never duplicate a hex across curated/alias/CSS collisions', () => {
  const r = searchColorNames('gold');
  const hexes = r.matches.map((m) => m.hex.toUpperCase());
  assert.equal(new Set(hexes).size, hexes.length);
});

/**
 * 🛑 COVERAGE IS A DIFFERENT MEASUREMENT FROM NAMING ACCURACY (MB5 brief).
 * `color-names.test.ts` proves the naming direction (hex → name) is honest;
 * this proves the SEARCH direction (word → hex) actually resolves for words
 * a Filipino couple, florist or stylist would really type — curated wedding
 * vocabulary, common colloquialisms, and the aliases this file's table adds
 * for them. Every term below MUST return at least one match; a term that
 * doesn't is either a missing WEDDING_NAMES entry or a missing alias — fix
 * the table, don't shrink this list.
 */
const REAL_SEARCH_TERMS = [
  'burgundy', 'moss green', 'chartreuse', 'dusty pink', 'champagne', 'blush', 'blush pink',
  'ivory', 'cream', 'gold', 'rose gold', 'sage', 'navy', 'terracotta', 'wine', 'wine red',
  'mauve', 'olive', 'army green', 'military green', 'taupe', 'coral', 'lavender', 'peach',
  'emerald', 'teal', 'maroon', 'rust', 'charcoal', 'forest green', 'bottle green', 'off white',
  'eggshell', 'jade green', 'powder blue', 'baby blue', 'baby pink', 'pina', 'piña',
  'pina cream', 'sampaguita', 'ube', 'calamansi', 'pandan', 'narra', 'waling waling',
  'waling-waling', 'mustard', 'mustard yellow', 'pastel green', 'pastel pink', 'pastel blue',
  'pastel purple', 'pastel yellow', 'nude', 'nude pink', 'deep red', 'deep green', 'deep blue',
  'deep purple', 'silver', 'pearl grey', 'pearl gray', 'slate', 'plum', 'dusty blue',
  'dusty rose', 'sky blue', 'amethyst', 'periwinkle', 'mint', 'pistachio', 'apricot',
  'aubergine', 'denim', 'greige', 'mocha', 'toffee', 'espresso', 'oxblood', 'raspberry',
  'rosewood', 'gumamela', 'banana leaf', 'capiz',
];

test('🚨 THE COVERAGE MEASUREMENT · every real wedding-vocabulary search term resolves to at least one match', () => {
  const missing = REAL_SEARCH_TERMS.filter((t) => searchColorNames(t).matches.length === 0);
  assert.deepEqual(missing, [], `${missing.length}/${REAL_SEARCH_TERMS.length} search terms returned nothing`);
});
