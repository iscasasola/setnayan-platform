/**
 * ALL REVEAL IS PAID (owner 2026-09-24) — the decision table, executed.
 *
 * Measured the day this was written: prod's Reveal Studio master toggle was ON
 * with `veil-sheer` as the house default, so every free couple's guests were
 * shown the paid veil. These tests pin the table in lib/reveal-access.ts.
 *
 * Run: `pnpm test:unit` (from apps/web)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  REVEAL_NONE,
  revealAllowedFor,
  revealEffectsWriteAllowed,
  revealTemplateWriteAllowed,
} from './reveal-access';
import { REVEAL_TEMPLATE_IDS, type RevealTemplateId } from './reveal-config-pure';
import { resolveRevealEffects } from './std-reveal-effects';

const base = {
  ownsPro: false,
  chosenTemplate: null,
  adminDefault: 'veil-sheer' as RevealTemplateId,
  isStaffPreview: false,
};

test('a free couple gets NO_REVEAL whatever the admin default or their stored choice', () => {
  for (const chosen of [null, ...REVEAL_TEMPLATE_IDS, REVEAL_NONE] as const) {
    for (const adminDefault of [null, ...REVEAL_TEMPLATE_IDS] as const) {
      assert.equal(
        revealAllowedFor({ ...base, chosenTemplate: chosen, adminDefault }),
        REVEAL_NONE,
        `free · chosen=${chosen} · default=${adminDefault}`,
      );
    }
  }
});

test('a public guest cannot bring a reveal in with ?reveal= (no staff preview)', () => {
  for (const id of REVEAL_TEMPLATE_IDS) {
    assert.equal(revealAllowedFor({ ...base, previewOverride: id }), REVEAL_NONE);
  }
  // …and the override does not replace a Pro couple's choice for a guest either.
  assert.equal(
    revealAllowedFor({
      ...base,
      ownsPro: true,
      chosenTemplate: 'church-doors',
      previewOverride: 'four-flap',
    }),
    'church-doors',
  );
});

test('a Pro couple gets their choice', () => {
  for (const id of REVEAL_TEMPLATE_IDS) {
    assert.equal(revealAllowedFor({ ...base, ownsPro: true, chosenTemplate: id }), id);
  }
});

test('a Pro couple who has not chosen gets the admin default, then four-flap', () => {
  assert.equal(revealAllowedFor({ ...base, ownsPro: true }), 'veil-sheer');
  assert.equal(
    revealAllowedFor({ ...base, ownsPro: true, adminDefault: null }),
    'four-flap',
  );
});

test("a Pro couple's explicit No Reveal stands", () => {
  assert.equal(
    revealAllowedFor({ ...base, ownsPro: true, chosenTemplate: REVEAL_NONE }),
    REVEAL_NONE,
  );
});

test('the admin allowed-openings map swaps a deactivated opening for the default', () => {
  const allowed = {
    'four-flap': false,
    'two-flap-vertical': false,
    'two-flap-horizontal': false,
    'church-doors': false,
    'veil-sheer': true,
  };
  assert.equal(
    revealAllowedFor({ ...base, ownsPro: true, chosenTemplate: 'four-flap', allowed }),
    'veil-sheer',
  );
  assert.equal(
    revealAllowedFor({
      ...base,
      ownsPro: true,
      chosenTemplate: 'four-flap',
      adminDefault: 'church-doors',
      allowed,
    }),
    'veil-sheer',
    'default itself deactivated → first still-enabled opening',
  );
});

test('a staff preview may demo any opening, override first', () => {
  assert.equal(
    revealAllowedFor({ ...base, isStaffPreview: true, previewOverride: 'church-doors' }),
    'church-doors',
  );
  assert.equal(revealAllowedFor({ ...base, isStaffPreview: true }), 'veil-sheer');
});

test("write side: 'none' and clearing are always writable; an opening needs Pro", () => {
  assert.equal(revealTemplateWriteAllowed(REVEAL_NONE, false), true);
  assert.equal(revealTemplateWriteAllowed(null, false), true);
  for (const id of REVEAL_TEMPLATE_IDS) {
    assert.equal(revealTemplateWriteAllowed(id, false), false, `free may not write ${id}`);
    assert.equal(revealTemplateWriteAllowed(id, true), true, `Pro may write ${id}`);
  }
});

test('write side: a free couple may re-save effects and flip music, not change a reveal effect', () => {
  const stored = resolveRevealEffects(null);
  assert.equal(revealEffectsWriteAllowed(stored, resolveRevealEffects(null), false), true);
  assert.equal(
    revealEffectsWriteAllowed(stored, { ...stored, music: !stored.music }, false),
    true,
    'music is the free film toggle',
  );
  for (const change of [
    { butterflies: !stored.butterflies },
    { petals: !stored.petals },
    { veilColor: '#123456' },
    { petalColor: '#654321' },
    { gold: { ...stored.gold, accent: 'engrave' as const } },
  ]) {
    const incoming = resolveRevealEffects({ ...stored, ...change });
    assert.equal(
      revealEffectsWriteAllowed(stored, incoming, false),
      false,
      `free may not change ${Object.keys(change)[0]}`,
    );
    assert.equal(revealEffectsWriteAllowed(stored, incoming, true), true);
  }
});
