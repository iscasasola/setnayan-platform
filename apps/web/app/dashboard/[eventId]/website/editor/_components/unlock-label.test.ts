/**
 * unlock-label.test.ts — THE EDITOR'S UNLOCK BUTTON SAYS THE CATALOGUE'S PRICE.
 *
 * The website editor painted a hard-coded figure on three "Unlock Event Hub PRO"
 * buttons (the locked-row panel, the editorial panel and the rail's umbrella
 * CTA). The owner repriced `COUPLE_WEBSITE_PRO` in `platform_retail_catalog_v2`
 * on 2026-09-23 — the only price a customer is charged — and the editor kept
 * advertising the old one, because nothing joined the two.
 *
 * Two halves, deliberately:
 *   1. BEHAVIOUR — `unlockLabel` / `proPriceLabelFrom` are EXECUTED: the live
 *      price appears; a failed read yields the price-less label, never ₱0.
 *   2. PROVENANCE — a source scan, because "₱X painted by the catalogue" and "₱X
 *      typed into a template" are the same pixels and no render can tell them
 *      apart. It asserts the PROPERTY (no peso figure in editor code, and the
 *      unlock words live in one helper), not the spelling of the old number.
 *      Comments are stripped first, so prose about a figure is not the figure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { formatPhp } from '@/lib/php';
import { proPriceLabelFrom, unlockLabel, UNLOCK_EVENT_HUB_PRO } from './unlock-label';

const HERE = dirname(fileURLToPath(import.meta.url));
const EDITOR = resolve(HERE, '..');

test('the catalogue price appears on the unlock button', () => {
  const label = unlockLabel(proPriceLabelFrom(2000, formatPhp));
  assert.equal(label, `${UNLOCK_EVENT_HUB_PRO} · ${formatPhp(2000)}`);
  assert.match(label, /2,000/);
  // Whatever the admin sets tomorrow is what the button says — nothing cached.
  assert.match(unlockLabel(proPriceLabelFrom(4321, formatPhp)), /4,321/);
});

test('a failed catalogue read yields the price-less label — never a guessed figure, never ₱0', () => {
  assert.equal(unlockLabel(null), 'Unlock Event Hub PRO');
  assert.equal(unlockLabel(''), 'Unlock Event Hub PRO');
  assert.equal(unlockLabel('   '), 'Unlock Event Hub PRO');
  for (const bad of [null, undefined, 0, -5, Number.NaN, 'abc']) {
    const priced = proPriceLabelFrom(bad, formatPhp);
    assert.equal(priced, null, `${String(bad)} must not become a price`);
    assert.doesNotMatch(unlockLabel(priced), /₱|\d/, `${String(bad)} painted a figure`);
  }
});

/** Every non-test source file under `website/editor`, recursively. */
function editorSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...editorSources(p));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

test('⛔ no file under website/editor types a peso figure', () => {
  const files = editorSources(EDITOR);
  // Non-vacuity: the scan must be looking at the editor, including the three
  // components that used to carry the figure.
  const names = files.map((f) => relative(EDITOR, f));
  for (const must of [
    'page.tsx',
    '_components/pro-panels.tsx',
    '_components/authoring-panels.tsx',
    '_components/editor-shell.tsx',
  ]) {
    assert.ok(names.includes(must), `the scan did not reach ${must} — it was looking at nothing`);
  }
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    assert.ok(src.length > 100, `${relative(EDITOR, f)} read as ${src.length} chars`);
    assert.doesNotMatch(
      src,
      /₱\s*\d|PHP\s*\d/,
      `${relative(EDITOR, f)} types a peso figure; the catalogue is the only price`,
    );
  }
});

test('⛔ the unlock words live in one helper, so no button can re-type a price beside them', () => {
  let callers = 0;
  for (const f of editorSources(EDITOR)) {
    const name = relative(EDITOR, f);
    const src = stripComments(readFileSync(f, 'utf8'));
    if (name === '_components/unlock-label.ts') continue;
    assert.doesNotMatch(
      src,
      /Unlock Event Hub PRO/i,
      `${name} spells the unlock CTA itself — render unlockLabel(priceLabel) instead`,
    );
    if (/\bunlockLabel\(/.test(src)) callers += 1;
  }
  // The three surfaces that show the CTA: pro-panels, authoring-panels, editor-shell.
  assert.equal(callers, 3, `expected 3 files rendering unlockLabel(), found ${callers}`);
});

test('the editor page reads the price from the catalogue row', () => {
  const page = stripComments(readFileSync(join(EDITOR, 'page.tsx'), 'utf8'));
  assert.match(page, /formatV2Sku\(\s*'COUPLE_WEBSITE_PRO'\s*\)/);
  assert.match(page, /proPriceLabelFrom\(/);
});
