/**
 * GUARD — a shop the couple inquired with must actually reach their list.
 *
 * 🔴 WHAT THIS PINS SHUT, measured in production 2026-09-09. The two live
 * service cards are filed under `live_band` and `host_mc`. `event_vendors.category`
 * is the enum `vendor_category`, whose 58 labels include NEITHER — the twins are
 * `band_dj` and `host_emcee`. Writing the raw kind made PostgREST answer
 * `22P02`, and a rejected query here is SILENT: the shop never appeared on the
 * couple's list, so the booking step later had nothing to book.
 *
 * The two production values are named literally below, on purpose. A test that
 * only exercised invented keys would have gone green through the whole defect.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  eventVendorCategoryForCardKind,
  eventVendorCategoryKeyForCardKind,
} from './event-vendor-category';
import { VENDOR_CATEGORIES } from './vendors';

const LEGAL = new Set<string>(VENDOR_CATEGORIES);

test('the two kinds live in production today resolve to real categories', () => {
  // `live_band` IS a canonical leaf; the live taxonomy gives it the tile of the
  // same name. `host_mc` is a tier-2 TILE and not a leaf at all, so the taxonomy
  // map has no entry for it and the caller hands in null.
  assert.equal(eventVendorCategoryForCardKind('live_band', 'live_band'), 'band_dj');
  assert.equal(eventVendorCategoryForCardKind('host_mc', null), 'host_emcee');
});

test('a card already filed under a coarse key keeps it', () => {
  assert.equal(eventVendorCategoryForCardKind('photographer', null), 'photographer');
  assert.equal(eventVendorCategoryForCardKind('venue', 'reception'), 'venue');
  // Whitespace is not a different kind.
  assert.equal(eventVendorCategoryForCardKind('  catering  ', null), 'catering');
});

test('a leaf resolves through its branch when the leaf map does not know it', () => {
  // `band_live_music` is a live leaf under the `live_band` tile; nothing maps it
  // by leaf, so the branch has to answer.
  assert.equal(eventVendorCategoryForCardKind('band_live_music', 'live_band'), 'band_dj');
  assert.equal(eventVendorCategoryForCardKind('host_emcee', 'host_mc'), 'host_emcee');
});

test('the floor is misc — a real label — never an invalid one', () => {
  assert.equal(eventVendorCategoryForCardKind('a_trade_nobody_has_invented', null), 'misc');
  assert.equal(eventVendorCategoryForCardKind('unknown', 'unknown_branch'), 'misc');
  assert.equal(eventVendorCategoryForCardKind('', 'live_band'), 'misc');
  assert.equal(eventVendorCategoryForCardKind(null, null), 'misc');
  assert.equal(eventVendorCategoryForCardKind(undefined, undefined), 'misc');
});

test('EVERY answer it can give is a label the column accepts', () => {
  const kinds = [
    'live_band',
    'host_mc',
    'band_live_music',
    'host_emcee',
    'photographer',
    'pabati',
    '',
    'garbage_key',
    '   ',
  ];
  const tiles = [null, 'live_band', 'host_mc', 'photo_video', 'not_a_tile'];
  let checked = 0;
  for (const k of kinds) {
    for (const t of tiles) {
      const got = eventVendorCategoryForCardKind(k, t);
      assert.ok(
        LEGAL.has(got),
        `resolve(${JSON.stringify(k)}, ${JSON.stringify(t)}) = ${got}, which the enum does not have`,
      );
      checked += 1;
    }
  }
  // Anti-vacuity: 0 combinations checked reads exactly like 0 failures.
  assert.equal(checked, kinds.length * tiles.length);
  assert.ok(checked > 40, `only ${checked} combinations were checked`);
});

test('the dual-written tile follows the same three rungs', () => {
  assert.equal(eventVendorCategoryKeyForCardKind('live_band', 'live_band'), 'live_band');
  // The kind IS a tile — this is the case that used to write null.
  assert.equal(eventVendorCategoryKeyForCardKind('host_mc', null), 'host_mc');
  assert.equal(eventVendorCategoryKeyForCardKind('photographer', null), null);
  assert.equal(eventVendorCategoryKeyForCardKind(null, null), null);
});

/* ── WIRING ──────────────────────────────────────────────────────────────────
 * The resolver being correct proves nothing about whether the write sites use
 * it. Both are read from source, and the assertion is on the OBJECT LITERAL
 * actually handed to `.insert(` — a file-level substring match would be
 * satisfied by the import line alone.
 * ──────────────────────────────────────────────────────────────────────────── */

const WRITE_SITES: ReadonlyArray<{ file: string; why: string }> = [
  {
    file: 'app/v/[slug]/inquiry-actions.ts',
    why: 'inquiring straight from a shop page',
  },
  {
    file: 'app/dashboard/[eventId]/vendors/_actions/unlock-category.ts',
    why: 'the couple adding a whole category',
  },
];

/** The `.insert({ … })` object literal that carries `marketplace_vendor_id`. */
function marketplaceInsertLiteral(source: string): string | null {
  const at = source.indexOf(".from('event_vendors').insert({");
  if (at < 0) return null;
  const open = source.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const c = source[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

test('both write sites resolve the category instead of writing the raw card kind', () => {
  let asserted = 0;
  for (const site of WRITE_SITES) {
    const src = readFileSync(join(process.cwd(), site.file), 'utf8');
    const literal = marketplaceInsertLiteral(src);
    assert.ok(literal, `no event_vendors insert found in ${site.file}`);
    assert.match(
      literal!,
      /category:\s*eventVendorCategoryForCardKind\(/,
      `${site.file} (${site.why}) writes event_vendors.category without resolving it — ` +
        'a raw vendor_services kind is refused by the enum, silently',
    );
    assert.match(
      literal!,
      /category_key:\s*eventVendorCategoryKeyForCardKind\(/,
      `${site.file} (${site.why}) writes category_key without the shared resolver`,
    );
    asserted += 1;
  }
  assert.equal(asserted, WRITE_SITES.length, 'a write site was skipped');
});

test('neither write site swallows the failure in silence any more', () => {
  let asserted = 0;
  for (const site of WRITE_SITES) {
    const src = readFileSync(join(process.cwd(), site.file), 'utf8');
    assert.match(
      src,
      /console\.error\(/,
      `${site.file} reports an event_vendors write fault to nowhere a person is looking`,
    );
    asserted += 1;
  }
  assert.equal(asserted, WRITE_SITES.length);
});
