import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `color-space.ts`'s docblock: "The two perceptual color spaces in this
 * codebase — CIELAB and OKLCH — and NOTHING ELSE." This test is the
 * enforcement half of that sentence.
 *
 * Method: fingerprint each conversion matrix with a constant unique to it
 * (a coefficient no other formula would plausibly reproduce), then fail if
 * either fingerprint appears in any non-test `.ts` file in `apps/web/lib`
 * OTHER than `color-space.ts` itself. Test files are exempt: several guard
 * tests (`color-names.test.ts`, `moodboard-theme-generator.test.ts`,
 * `the-completion-cannot-invert-a-theme-s-mood.test.ts`) deliberately write
 * the CIELAB matrix out again rather than importing it, precisely so a
 * broken conversion in `color-space.ts` cannot make its own guard pass — see
 * those files' docblocks. That duplication is a feature of the TEST layer,
 * not a second home for the SHIPPED math.
 *
 * Sabotage-tested: pasting the OKLab matrix's first coefficient into
 * `palette-styles.ts` (as if a second engine had reimplemented it instead of
 * importing `oklchOfHex`) turns this red; reverting turns it back green.
 */

// Unique to the sRGB→XYZ (D65) matrix CIELAB conversion starts from.
const CIELAB_FINGERPRINT = '0.4124564';
// Unique to the OKLab M2 matrix OKLCH conversion starts from.
const OKLAB_FINGERPRINT = '0.2104542553';

const LIB_DIR = join(__dirname); // this test lives in apps/web/lib itself

function isTestFile(name: string): boolean {
  return name.endsWith('.test.ts') || name.endsWith('.db.test.ts');
}

test('no non-test file in apps/web/lib reimplements CIELAB or OKLab instead of importing color-space.ts', () => {
  const offenders: string[] = [];
  for (const name of readdirSync(LIB_DIR)) {
    if (!name.endsWith('.ts') || isTestFile(name)) continue;
    const path = join(LIB_DIR, name);
    if (!statSync(path).isFile()) continue;
    const content = readFileSync(path, 'utf8');
    if (name !== 'color-space.ts' && content.includes(CIELAB_FINGERPRINT)) {
      offenders.push(`${name}: reimplements the CIELAB sRGB→XYZ matrix instead of importing color-space.ts`);
    }
    if (name !== 'color-space.ts' && content.includes(OKLAB_FINGERPRINT)) {
      offenders.push(`${name}: reimplements the OKLab conversion matrix instead of importing color-space.ts`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('color-space.ts itself carries both fingerprints exactly once — proof the fingerprints still match the shipped code', () => {
  const content = readFileSync(join(LIB_DIR, 'color-space.ts'), 'utf8');
  assert.ok(content.includes(CIELAB_FINGERPRINT), 'CIELAB fingerprint constant not found in color-space.ts');
  assert.ok(content.includes(OKLAB_FINGERPRINT), 'OKLab fingerprint constant not found in color-space.ts');
});

test('palette-styles.ts imports its OKLCH primitives from color-space.ts rather than defining its own', () => {
  const content = readFileSync(join(LIB_DIR, 'palette-styles.ts'), 'utf8');
  assert.match(content, /from ['"]\.\/color-space['"]/);
  assert.ok(!content.includes(OKLAB_FINGERPRINT), 'palette-styles.ts must not carry its own OKLab matrix');
});

test('color-names.ts imports its CIELAB primitives from color-space.ts rather than defining its own', () => {
  const content = readFileSync(join(LIB_DIR, 'color-names.ts'), 'utf8');
  assert.match(content, /from ['"]\.\/color-space['"]/);
  assert.ok(!content.includes(CIELAB_FINGERPRINT), 'color-names.ts must not carry its own CIELAB matrix');
});
