/**
 * category-hints.test.ts — every folder and every reachable tile explains
 * itself, and the one line that must NOT sell stays that way.
 *
 * Why a guard and not just the copy: this gap was invisible. `categoryHintForTile`
 * returning null makes the bench HIDE the ⓘ — the correct refusal, and also a
 * silent one. 20 of 45 tiles and 16 of 16 folders were mute for months and
 * nothing failed. A new tile or folder must not be able to rejoin them quietly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { tileForCategory } from '@/lib/shortlist-taxonomy';
import { WEDDING_FOLDER_ORDER } from '@/lib/taxonomy';
import { categoryHintForTile } from '@/lib/explore-info-copy';
import { FOLDER_HINTS, TILE_HINTS, folderHintFor } from '@/lib/category-hints';

test('EVERY folder explains itself — no folder may be silent', () => {
  const missing = (WEDDING_FOLDER_ORDER as readonly string[]).filter(
    (f) => !(FOLDER_HINTS as Record<string, string>)[f]?.trim(),
  );
  assert.deepEqual(
    missing,
    [],
    `folders with no ⓘ: ${missing.join(', ')} — add a line to FOLDER_HINTS`,
  );
});

test('EVERY tile a considered vendor can land on explains itself', () => {
  const tiles = [...new Set(VENDOR_CATEGORIES.map(tileForCategory).filter(Boolean))] as string[];
  const missing = tiles.filter((t) => !categoryHintForTile(t));
  assert.deepEqual(
    missing,
    [],
    `tiles with no ⓘ: ${missing.join(', ')} — add to TILE_HINTS, or give the ` +
      'plan group that claims them a hint',
  );
  assert.ok(tiles.length >= 40, 'the tile set collapsed — the bridge changed shape');
});

test('a tile-level hint WINS over the plan group’s', () => {
  // brides_attire rolls up to the `attire` plan group, whose hint is about the
  // gown, suit AND rings together. The tile is narrower and says so.
  assert.equal(categoryHintForTile('brides_attire'), TILE_HINTS.brides_attire);
  assert.notEqual(categoryHintForTile('brides_attire'), categoryHintForTile('grooms_attire'));
});

test('🕊 farewell carries NO booking cue and no urgency — it is funeral services', () => {
  const line = folderHintFor('farewell');
  assert.match(line, /Funeral homes/);
  assert.ok(
    !/book|months out|early|fills up|reserve|don't miss|hurry/i.test(line),
    'farewell must not be sold or hurried — someone reading it may have just ' +
      `lost a person. Got: "${line}"`,
  );
  assert.ok(line.split('.').filter((p) => p.trim()).length <= 2, 'farewell stays one plain line');
});

test('no hint shouts, and none of them is a placeholder', () => {
  const all = [...Object.values(TILE_HINTS), ...Object.values(FOLDER_HINTS)];
  for (const h of all) {
    assert.ok(!h.includes('!'), `no exclamation marks: "${h}"`);
    assert.ok(!/TODO|TBD|Lorem|\bXXX\b/i.test(h), `placeholder copy shipped: "${h}"`);
    assert.ok(h.trim().length > 20, `too short to explain anything: "${h}"`);
    assert.ok(h.length < 200, `too long for an ⓘ: "${h}"`);
  }
});

test('the house bans clichés — none crept in with 36 new lines', () => {
  const all = [...Object.values(TILE_HINTS), ...Object.values(FOLDER_HINTS)];
  for (const h of all) {
    assert.ok(
      !/big day|magical|dream (wedding|day)|journey|fairy ?tale/i.test(h),
      `wedding cliché: "${h}"`,
    );
  }
});

// ── the source half ─────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = stripComments(
  readFileSync(
    resolve(HERE, '../app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'),
    'utf8',
  ),
);

test('source · the folder ⓘ renders, and its panel with it', () => {
  assert.match(BENCH, /folderHintButtonLabel\(folder\.label\)/, 'the folder ⓘ lost its label');
  assert.match(BENCH, /folderHintFor\(folder\.folder\)/, 'the folder hint panel is gone');
  assert.match(BENCH, /hintFolder === folder\.folder/, 'the disclosure state is gone');
});

test('source · the folder ⓘ is a SIBLING of the head button, never nested inside it', () => {
  const head = BENCH.indexOf('className="fold-head"');
  const close = BENCH.indexOf('</button>', head);
  const info = BENCH.indexOf('folderHintButtonLabel', head);
  assert.ok(head > -1 && close > -1 && info > -1, 'the folder head changed shape');
  assert.ok(
    info > close,
    'the ⓘ sits INSIDE the fold-head button — nested buttons are invalid HTML ' +
      'and the inner one is unreachable by keyboard',
  );
  assert.match(BENCH, /className="fold-head-row"/, 'the flex wrapper is gone');
});

test('source · pressing the folder ⓘ does not also toggle the folder', () => {
  // Anchor on the CALL SITE, not the bare symbol: the first occurrence of
  // `folderHintButtonLabel` is the import at the top of the file, and a window
  // sliced from there faces 2,000 lines of the wrong component.
  const i = BENCH.indexOf('folderHintButtonLabel(folder.label)');
  assert.ok(i > -1, 'the folder ⓘ no longer renders its label');
  const seg = BENCH.slice(i, i + 500);
  assert.match(seg, /e\.stopPropagation\(\)/, 'the press would collapse the folder underneath it');
});
