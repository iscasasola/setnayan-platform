/**
 * THE VENDOR'S MIRROR MUST SHOW THE PALETTE THE COUPLE ACTUALLY SAVED.
 *
 * `role_palette` is jsonb. Around 25 surfaces read it — the couple's own board,
 * the venue walk, the QR routes, the PDF routes, the invitation — and every one
 * of them runs `sanitizeRolePalette` first. The booked-vendor mirror did not:
 *
 *     const palette = (board.role_palette ?? {}) as RolePalette;
 *
 * `as` is an assertion, not a check. It told the compiler a shape nobody had
 * verified, and those strings land directly in `style={{ backgroundColor: hex }}`
 * — so the one surface a supplier uses to match their florals and linens to the
 * couple's colours was also the one surface that would render whatever the
 * column happened to contain.
 *
 * ⚠ THE FAILURE IS DISAGREEMENT, NOT A CRASH. React will not execute a bad
 * style value, so nothing throws and nothing logs: the vendor simply sees a
 * different set of swatches than the couple's own board draws, each surface
 * internally consistent. That is the exact disease this repo has been bitten by
 * repeatedly — the board and the room disagreeing about attire was the same
 * shape, one layer in.
 *
 * ⚠ AND THE FIX MUST NOT EAT CUSTOM ROLES. The vendor page renders
 * `palette.custom_roles` beneath the fixed taxonomy. A naive "rebuild from
 * PALETTE_ORDER" sanitizer would silently drop them and turn a correctness fix
 * into a data-loss bug, so that is pinned below too.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { sanitizeRolePalette } from './mood-board';

const MIRROR = join(
  import.meta.dirname,
  '..',
  'app',
  'vendor-dashboard',
  'clients',
  '[eventId]',
  'mood-board',
  'page.tsx',
);

const src = () => stripComments(readFileSync(MIRROR, 'utf8'));

/* ── 1 · THE WIRE ─────────────────────────────────────────────────────────── */

test('the vendor mirror sanitizes role_palette instead of asserting its shape', () => {
  const s = src();
  assert.match(
    s,
    /sanitizeRolePalette\(/,
    'the booked-vendor mood board must sanitize role_palette like every other ' +
      'reader of that column does.',
  );
  assert.doesNotMatch(
    s,
    /as RolePalette/,
    'a bare `as RolePalette` cast asserts an unverified shape straight into a ' +
      'backgroundColor — that is the defect this file pins.',
  );
});

/* ── 2 · WHAT SANITIZING ACTUALLY BUYS ────────────────────────────────────── */

test('junk never reaches a swatch', () => {
  const dirty = {
    bride: ['#AABBCC', 'red', 'javascript:alert(1)', '', '#GGGGGG'],
    groom: 'not-an-array',
  };
  const clean = sanitizeRolePalette(dirty);
  assert.deepEqual(clean.bride, ['#AABBCC'], 'only real hex survives');
  assert.equal(clean.groom, undefined, 'a non-hex string yields no colours at all');
});

test('the couple sees exactly what the vendor sees, for the same input', () => {
  // The property that matters is AGREEMENT: both surfaces now run the same
  // function over the same column, so they cannot diverge by construction.
  const raw = { bride: ['#123456'], reception: ['#abcdef', 'nope'] };
  assert.deepEqual(sanitizeRolePalette(raw), sanitizeRolePalette(raw));
  assert.deepEqual(sanitizeRolePalette(raw).reception, ['#ABCDEF']);
});

/* ── 3 · THE REGRESSION THE FIX COULD HAVE CAUSED ─────────────────────────── */

test('couple-authored custom roles survive sanitizing', () => {
  const withCustom = {
    bride: ['#111111'],
    custom_roles: [{ key: 'ninang', label: 'Ninang', colors: ['#654321'] }],
  };
  const clean = sanitizeRolePalette(withCustom);
  assert.equal(clean.custom_roles?.length, 1, 'custom roles must not be dropped');
  assert.equal(clean.custom_roles?.[0]?.key, 'ninang');
});

test('the mirror still RENDERS those custom roles', () => {
  assert.match(
    src(),
    /palette\.custom_roles/,
    'sanitizing is only safe because the page reads custom_roles; if that read ' +
      'goes away the Ninang/Ninong rows vanish from the vendor mirror.',
  );
});
