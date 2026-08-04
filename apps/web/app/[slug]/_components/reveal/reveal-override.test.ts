/**
 * SEC-3 · `?reveal=` must not be an entitlement.
 *
 * The bug: RevealOverlay read `?reveal=` off window.location.search for ANY
 * visitor and OR'd it into the activation test —
 *
 *     (configEnabled || FLAG_ON || override !== null || premiumUnlocked)
 *
 * so `override !== null` short-circuited the paid `premiumUnlocked` check.
 * Appending `?reveal=veil-sheer` to a public couple page handed an anonymous
 * guest the ₱999 premium cinematic opening on an event that never bought it,
 * AND resurrected openings the admin had deactivated, AND overrode the
 * couple's explicit "No Reveal" choice — because every one of those decisions
 * keys off the same `override` value.
 *
 * The fix scopes the param to the env-only preview flag. These tests pin both
 * directions: inert in production, unchanged on a preview build.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REVEAL_ALIASES, resolveRevealOverride } from './reveal-templates';

const PRODUCTION = false; // NEXT_PUBLIC_STD_REVEAL unset
const PREVIEW = true; // NEXT_PUBLIC_STD_REVEAL=1

test('an unentitled visitor gets nothing from ?reveal= in production', () => {
  // Every alias, including the flagship paid veil.
  for (const alias of Object.keys(REVEAL_ALIASES)) {
    assert.equal(
      resolveRevealOverride(alias, PRODUCTION),
      null,
      `?reveal=${alias} must be inert without preview authority`,
    );
  }
});

test('the paid veil specifically cannot be summoned by URL', () => {
  assert.equal(resolveRevealOverride('veil-sheer', PRODUCTION), null);
  assert.equal(resolveRevealOverride('veil', PRODUCTION), null);
});

test('preview builds keep every alias working exactly as before', () => {
  assert.equal(resolveRevealOverride('veil-sheer', PREVIEW), 'veil-sheer');
  assert.equal(resolveRevealOverride('veil', PREVIEW), 'veil-sheer');
  assert.equal(resolveRevealOverride('envelope', PREVIEW), 'four-flap');
  assert.equal(resolveRevealOverride('church-doors', PREVIEW), 'church-doors');
  assert.equal(resolveRevealOverride('doors', PREVIEW), 'church-doors');
  assert.equal(resolveRevealOverride('two-flap-v', PREVIEW), 'two-flap-vertical');
  assert.equal(resolveRevealOverride('two-flap-h', PREVIEW), 'two-flap-horizontal');
});

test('unknown / empty / hostile values resolve null on either side', () => {
  for (const authority of [PRODUCTION, PREVIEW]) {
    assert.equal(resolveRevealOverride('', authority), null);
    assert.equal(resolveRevealOverride(null, authority), null);
    assert.equal(resolveRevealOverride(undefined, authority), null);
    assert.equal(resolveRevealOverride('not-a-template', authority), null);
    // Prototype-chain keys must not resolve to a template.
    assert.equal(resolveRevealOverride('constructor', authority), null);
    assert.equal(resolveRevealOverride('__proto__', authority), null);
    assert.equal(resolveRevealOverride('toString', authority), null);
  }
});
