/**
 * Guard: a vendor's public page never shows the same Inquire button twice.
 *
 * The bug (owner spotted it, 2026-08-06): the cinematic hero — the top-plan
 * full-bleed cover with the shop's name across it — carries its own Inquire
 * button. The action row a few centimetres below carried a second, identical
 * one. The block between them already suppresses the name and tagline when that
 * hero renders, precisely because the hero shows them; the BUTTON was missed.
 *
 * So the shops paying the most were the only ones with a duplicated call to
 * action, and nothing failed: both buttons worked and scrolled to the same
 * place. A visual duplicate has no natural detector — CI cannot see a page —
 * so it gets a structural one here.
 *
 * 🔑 Share is deliberately NOT suppressed with it. The hero has no Share
 * button, so dropping the whole action row would leave a top-plan shop with no
 * way to be shared at all — trading a cosmetic duplicate for a lost feature.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, 'page.tsx'), 'utf8');

/** Source with comments removed, so assertions test CODE not the prose above. */
const code = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('the page has exactly the Inquire buttons we expect', () => {
  // Three, and only three: the cinematic hero's, the action row's, and the
  // desktop sticky rail's. A fourth means a new one was added without deciding
  // how it interacts with the hero — which is exactly how the duplicate arose.
  const count = (code.match(/^\s*Inquire\s*$/gm) ?? []).length;
  assert.equal(
    count,
    3,
    `expected 3 Inquire button labels (hero · action row · sticky rail), found ${count}. ` +
      'Adding one means deciding whether it can appear beside the hero button.',
  );
});

test('the action row Inquire is suppressed when the cinematic hero renders', () => {
  // The hero's own Inquire and the action row's must be mutually exclusive.
  const guarded = /\{cinematicHero \? null : \(\s*<a href="#get-in-touch"/.test(code);
  assert.ok(
    guarded,
    'the action-row Inquire is no longer gated on cinematicHero — a top-plan shop with a ' +
      'hero photo will show two identical Inquire buttons a few centimetres apart',
  );
});

test('Share survives when the hero suppresses that Inquire', () => {
  // Share must sit OUTSIDE the cinematicHero guard. If a future edit widens the
  // guard to wrap the whole row, a top-plan shop silently loses its only Share.
  const rowStart = code.indexOf('{cinematicHero ? null : (\n                  <a href="#get-in-touch"');
  assert.ok(rowStart > 0, 'could not locate the guarded action row — update this test with the markup');
  const after = code.slice(rowStart, rowStart + 900);
  const closeIdx = after.indexOf(')}');
  const shareIdx = after.indexOf('<ShareButton');
  assert.ok(shareIdx > 0, 'the Share button vanished from the action row');
  assert.ok(
    shareIdx > closeIdx && closeIdx > 0,
    'Share is inside the cinematicHero guard — a top-plan shop would have no way to be shared',
  );
});
