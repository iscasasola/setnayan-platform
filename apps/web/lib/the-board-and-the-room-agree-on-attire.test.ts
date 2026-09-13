/**
 * THE BOARD AND THE ROOM MUST NAME THE SAME COLOUR.
 *
 * Taxonomy v2 (2026-07-08) split the wedding party into real per-role palette
 * keys — `bridesmaids`, `groomsmen`, `maid_of_honor`, `best_man` — and
 * `resolveAttirePaletteColor`, which is what actually dresses a figure in the
 * 3D room, resolves the SPECIFIC key first and only then falls back to the
 * shared `wedding_party`.
 *
 * The mood board's attire cards were never updated. They read `wedding_party`
 * and nothing else. So a couple who filled the Bridesmaids palette got:
 *
 *   · bridesmaids correctly dressed in that colour in the 3D room, and
 *   · a Bridesmaids card on the board showing the wedding-party swatches —
 *     or NO swatches at all, when `wedding_party` was empty
 *
 * Two surfaces disagreeing about one fact, each internally consistent. That is
 * the failure this repo has been bitten by repeatedly, and it is why the fix
 * MIRRORS the resolver rather than re-deciding the precedence.
 *
 * ⚠ THIS FILE PINS AGREEMENT, NOT A RULE. If `resolveAttirePaletteColor` ever
 * changes its order, the board must follow it — the resolver is the authority
 * and these assertions are derived from calling it, never from a hand-typed
 * expectation of what it does.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { resolveAttirePaletteColor, paletteKeyForRole } from './mood-board';
import type { RolePalette } from './mood-board';
import type { GuestRole } from './guests';

const HERE = dirname(fileURLToPath(import.meta.url));
const BOARD = join(
  HERE,
  '..',
  'app',
  'dashboard',
  '[eventId]',
  'studio',
  'mood-board',
  'page.tsx',
);

const SPLIT = '#8e3b5b'; // what they set on the Bridesmaids palette
const SHARED = '#3f7d57'; // what is (or is not) on wedding_party

/* ── The resolver is the authority. Establish what it does. ─────────────── */

test('the ROOM prefers the split key over the shared one', () => {
  const both = { bridesmaids: [SPLIT], wedding_party: [SHARED] } as RolePalette;
  assert.equal(resolveAttirePaletteColor('bridesmaid' as GuestRole, both, null), SPLIT);

  const onlySplit = { bridesmaids: [SPLIT] } as RolePalette;
  assert.equal(resolveAttirePaletteColor('bridesmaid' as GuestRole, onlySplit, null), SPLIT);

  const onlyShared = { wedding_party: [SHARED] } as RolePalette;
  assert.equal(resolveAttirePaletteColor('bridesmaid' as GuestRole, onlyShared, null), SHARED);
});

test('paletteKeyForRole really does return the split key for these roles', () => {
  // If this stops being true the board's `specific` entries are pointing at a
  // key nothing writes, and the two surfaces drift apart again silently.
  assert.equal(paletteKeyForRole('bridesmaid' as GuestRole), 'bridesmaids');
  assert.equal(paletteKeyForRole('groomsman' as GuestRole), 'groomsmen');
});

/* ── The board must follow it. ──────────────────────────────────────────── */

test('the board declares the split key for bridesmaids and groomsmen', () => {
  const src = stripComments(readFileSync(BOARD, 'utf8'));
  const defs = src.slice(src.indexOf('const ATTIRE_DEFS'), src.indexOf('];', src.indexOf('const ATTIRE_DEFS')));

  for (const [subtype, specific] of [
    ['bridesmaids', 'bridesmaids'],
    ['groomsmen', 'groomsmen'],
  ]) {
    const row = defs.split('\n').find((l) => l.includes(`subtype: '${subtype}'`));
    assert.ok(row, `no ATTIRE_DEFS row for ${subtype}`);
    assert.match(
      row,
      new RegExp(`specific:\\s*'${specific}'`),
      `the ${subtype} card does not declare its v2 split key, so it shows the ` +
        'shared wedding-party swatches while the room dresses them from the ' +
        'split palette — the board and the room disagree.',
    );
  }
});

test('the board reads the split key FIRST, then falls back — the resolver order', () => {
  const src = stripComments(readFileSync(BOARD, 'utf8'));
  assert.match(
    src,
    /d\.specific && palette\[d\.specific\]\?\.length \? palette\[d\.specific\] : palette\[d\.key\]/,
    'the attire card must prefer the specific palette and fall back to the shared ' +
      'one, mirroring resolveAttirePaletteColor. Reading only one of them is the bug.',
  );
});

test('a card stays visible on the split key alone', () => {
  // The case that showed an EMPTY card: bridesmaids present, wedding_party never
  // filled. Visibility keyed only on the shared palette would hide (or blank) a
  // card whose colour the couple had actually chosen.
  const src = stripComments(readFileSync(BOARD, 'utf8'));
  assert.match(
    src,
    /visibleKeys\.has\(d\.key\) \|\| \(d\.specific \? visibleKeys\.has\(d\.specific\) : false\)/,
    'attire-card visibility must accept EITHER key.',
  );
});
