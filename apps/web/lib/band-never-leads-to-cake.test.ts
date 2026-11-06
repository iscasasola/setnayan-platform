/**
 * GUARD — "band" must never lead to Cake (controller, A5, 7 Nov 2026).
 *
 * A table of what a supplier types → what must come FIRST, and → what must NEVER appear (ranked or "close"). Runs the
 * one shipped ranker (`rankTaxonomyOptionsWithClose`, the sign-up service search, Explore and Admin › Categories all
 * call it) against the REAL taxonomy, plus a few hostile labels that each broke an older rule:
 *   • "Cakes and Pastries" — "band" was one dropped letter from "and", so it came back as a "close match" for band;
 *   • "Ice Cream Cart" — "mc" matched the letter run across "icecream";
 *   • "Urban Dance Crew" — "band" would match "urBAN Dance" squashed.
 *
 * 🎵 Taxonomy v2 (#7355) renames `live_band`'s row to "Music" and keeps the key. The search must find it either way —
 * through the KEY's words, never through a synonym written into the code (last test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { rankTaxonomyOptionsWithClose, type RankableOption } from './taxonomy-search-rank';
import { TAXONOMY_MAP } from './taxonomy';

const labelFor = (key: string): string =>
  key
    .split('_')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

const REAL: RankableOption[] = Object.keys(TAXONOMY_MAP).map((key) => ({ key, label: labelFor(key) }));
const HOSTILE: RankableOption[] = [
  { key: 'zz_cakes_and_pastries', label: 'Cakes and Pastries' },
  { key: 'zz_ice_cream_cart', label: 'Ice Cream Cart' },
  { key: 'zz_urban_dance_crew', label: 'Urban Dance Crew' },
];
const WITH_HOSTILE = [...REAL, ...HOSTILE];
/** The same taxonomy after #7355: `live_band` is labelled "Music". */
const V2 = REAL.map((o) => (o.key === 'live_band' ? { ...o, label: 'Music' } : o));

const search = (opts: RankableOption[], q: string) => rankTaxonomyOptionsWithClose(opts, q, 30);
const everything = (opts: RankableOption[], q: string) => {
  const r = search(opts, q);
  return [...r.matches, ...r.close];
};

test('ANCHOR — the trades this table is about exist in the real taxonomy', () => {
  for (const key of ['live_band', 'wedding_cake', 'dj', 'host_emcee', 'videography', 'catering', 'photo_booth']) {
    assert.ok(REAL.some((o) => o.key === key), `missing ${key}`);
  }
});

/** query → the key (or one of the keys) that must come FIRST among the ranked matches. */
const TOP: Array<[string, string[]]> = [
  ['band', ['live_band', 'band_live_music']],
  ['live band', ['live_band']],
  ['dj', ['dj']],
  ['cake', ['wedding_cake']],
  ['photo', ['photo_booth', 'photography']],
  ['video', ['videography']],
  ['host', ['host_emcee']],
  ['mc', ['host_emcee']],
  ['emcee', ['host_emcee']],
  ['lechon', ['lechonero', 'mini_lechon_station']],
];

test('the top result is the trade they typed — a word or a prefix beats any letter run', () => {
  // The real taxonomy only: a hostile "Cakes and Pastries" genuinely starts with "cake" and may lead that query.
  for (const [q, want] of TOP) {
    const top = search(REAL, q).matches[0]?.key;
    assert.ok(top && want.includes(top), `"${q}" → top ${top}, want one of ${want.join(' / ')}`);
  }
});

test('"florist" leads with a florist', () => {
  const top = search(WITH_HOSTILE, 'florist').matches[0];
  assert.match(top?.label ?? '', /florist/i);
});

test('a typo is a CLOSE match, kept apart from the ranked list', () => {
  const typos: Array<[string, RegExp]> = [
    ['catring', /^catering$/],
    ['bnad', /^(live_band|band_live_music)$/],
    ['fotographer', /photographer/],
  ];
  for (const [q, want] of typos) {
    const r = search(WITH_HOSTILE, q);
    assert.equal(r.matches.length, 0, `"${q}" should have no ranked match`);
    assert.match(r.close[0]?.key ?? '', want, `"${q}" → close ${r.close.map((c) => c.key).join(', ')}`);
  }
});

/** query → what must NEVER appear, ranked OR close. */
const NEVER: Array<[string, RegExp]> = [
  ['band', /cake|pastr|ice cream|urban|dance/i],
  ['live band', /cake|pastr|ice cream|urban|dance/i],
  ['bnad', /cake|pastr|dance/i],
  ['cake', /band|music|dj/i],
  ['mc', /ice cream/i],
  ['dj', /cake|band/i],
  ['catring', /string|quartet/i],
  ['host', /ghost|post/i],
  ['lechon', /cake|band/i],
];

test('what must never appear for a query never does — not even as a "close match"', () => {
  for (const [q, never] of NEVER) {
    const bad = everything(WITH_HOSTILE, q).filter((o) => never.test(o.label));
    assert.deepEqual(
      bad.map((o) => o.label),
      [],
      `"${q}" surfaced ${bad.map((o) => o.label).join(', ')}`,
    );
  }
});

test('#7355: with `live_band` labelled "Music", band / live band / music still find it', () => {
  assert.ok(search(V2, 'band').matches.some((m) => m.key === 'live_band'), 'band');
  assert.equal(search(V2, 'live band').matches[0]?.key, 'live_band', 'live band');
  assert.equal(search(V2, 'music').matches[0]?.key, 'live_band', 'music');
  assert.ok(!everything(V2, 'band').some((o) => /cake/i.test(o.label)), 'band → cake');
});

test('a reviewed alias (Admin › Categories search words) is matched exactly like a label', () => {
  const opts: RankableOption[] = [
    { key: 'live_band', label: 'Music', aliases: ['banda'] },
    { key: 'wedding_cake', label: 'Wedding Cake' },
  ];
  assert.equal(search(opts, 'banda').matches[0]?.key, 'live_band');
  assert.deepEqual(everything(opts, 'banda').map((o) => o.key), ['live_band']);
});

test('the ranker carries no hard-coded trade words — aliases come from the one source', () => {
  const src = readFileSync(join(__dirname, 'taxonomy-search-rank.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const literals = src.match(/'[a-z][a-z ]*'/g) ?? [];
  const trades = literals.filter((l) => /band|music|cake|photo|video|dj|emcee|lechon|florist|cater/.test(l));
  assert.deepEqual(trades, [], `trade words in code: ${trades.join(', ')}`);
});
