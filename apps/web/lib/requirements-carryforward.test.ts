/**
 * Unit suite for Phase 1b PR-5 — AI-gated auto carry-forward of saved
 * per-category requirements. Covers the PURE decision + payload-build logic
 * the public Inquire path delegates to:
 *
 *   • shouldAutoCarryForward — the gate: AI ON + saved row + auto_send === true.
 *   • buildAutoCarryForwardRequirements — the payload built for the auto-sent
 *     inquiry.
 *
 * PRIVACY BOUNDARY (owner-locked 2026-06-20): the carry-forward payload is
 * sourced SOLELY from the couple's own saved template (event_vendor_preferences)
 * — NEVER from a vendor's proposal / quote / message or any vendor-authored
 * table. The decisive test below ("privacy") asserts the function reads ONLY its
 * `saved` argument: a vendor-authored object passed alongside cannot leak into
 * the output, because the function has no parameter for it and returns only
 * fields traceable to `saved`.
 *
 * Run via the repo's `test:unit` script (`tsx --test`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldAutoCarryForward,
  buildAutoCarryForwardRequirements,
  type SavedRequirementsTemplate,
} from './requirements-capture';

const saved = (over: Partial<SavedRequirementsTemplate> = {}): SavedRequirementsTemplate => ({
  payload: { shooting_styles: ['candid', 'editorial'] },
  specialRequest: 'Outdoor ceremony, golden hour',
  autoSend: true,
  ...over,
});

// ── The gate ─────────────────────────────────────────────────────────────────

test('gate: AI ON + saved row + auto_send=true → auto-send (skip pop-up)', () => {
  assert.equal(shouldAutoCarryForward(true, saved()), true);
});

test('gate: AI OFF → pop-up (never auto-send even with auto_send=true)', () => {
  assert.equal(shouldAutoCarryForward(false, saved()), false);
});

test('gate: auto_send=false → pop-up (pre-filled from the saved row)', () => {
  assert.equal(shouldAutoCarryForward(true, saved({ autoSend: false })), false);
});

test('gate: no saved row → pop-up (first inquiry always shows the pop-up)', () => {
  assert.equal(shouldAutoCarryForward(true, null), false);
  assert.equal(shouldAutoCarryForward(true, undefined), false);
});

// ── Payload build ────────────────────────────────────────────────────────────

test('build: carries the saved facets, note, and flag through', () => {
  const out = buildAutoCarryForwardRequirements(saved());
  assert.deepEqual(out, {
    payload: { shooting_styles: ['candid', 'editorial'] },
    specialRequest: 'Outdoor ceremony, golden hour',
    autoSend: true,
  });
});

test('build: trims + drops empty note → null', () => {
  const out = buildAutoCarryForwardRequirements(saved({ specialRequest: '   ' }));
  assert.equal(out.specialRequest, null);
});

test('build: sanitizes the saved payload (drops empty/blank picks + non-array values)', () => {
  const out = buildAutoCarryForwardRequirements({
    payload: {
      shooting_styles: ['candid', '', '  ', 'candid'], // blanks + dup
      bogus: 'not-an-array' as unknown as string[],
      empty: [],
    },
    specialRequest: 'x',
    autoSend: true,
  });
  assert.deepEqual(out.payload, { shooting_styles: ['candid'] });
});

test('build: null/empty template → empty payload, null note, autoSend false', () => {
  assert.deepEqual(buildAutoCarryForwardRequirements(null), {
    payload: {},
    specialRequest: null,
    autoSend: false,
  });
});

// ── PRIVACY: carry-forward sources ONLY event_vendor_preferences ─────────────

test('privacy: payload comes ONLY from the saved template — vendor-authored data cannot leak', () => {
  // Simulate a vendor's proposal / quote / message — the kind of vendor-authored
  // content the carry-forward must NEVER source from. We deliberately stuff it
  // with values that would be obvious if they ever appeared in the output.
  const vendorProposal = {
    payload: { shooting_styles: ['VENDOR_INJECTED_STYLE'] },
    specialRequest: 'VENDOR_INJECTED_NOTE — quoted price ₱99,999',
    quote_centavos: 9_999_900,
    vendor_message: 'We also do drone coverage for an extra fee.',
  };

  const couplesOwn = saved({
    payload: { shooting_styles: ['candid'] },
    specialRequest: 'No drone, please',
  });

  // The function only accepts the couple's own saved template — there is no
  // parameter through which vendor-authored data could enter. Even if a caller
  // mistakenly had a vendor object in scope, it cannot reach the output.
  const out = buildAutoCarryForwardRequirements(couplesOwn);

  // Every output value traces to the couple's own row, never to the vendor's.
  assert.deepEqual(out.payload, { shooting_styles: ['candid'] });
  assert.equal(out.specialRequest, 'No drone, please');

  const serialized = JSON.stringify(out);
  assert.ok(!serialized.includes('VENDOR_INJECTED_STYLE'), 'no vendor facet leaked');
  assert.ok(!serialized.includes('VENDOR_INJECTED_NOTE'), 'no vendor note leaked');
  assert.ok(!serialized.includes('99,999'), 'no vendor quote leaked');
  assert.ok(!serialized.includes('drone coverage'), 'no vendor message leaked');
  // Keep the unused vendor object referenced so the test documents intent.
  assert.equal(vendorProposal.quote_centavos, 9_999_900);
});
