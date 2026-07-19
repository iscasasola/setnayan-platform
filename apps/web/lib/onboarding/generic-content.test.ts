/**
 * Unit suite for the generic experience-quiz content pack (0053 Phase 3). The
 * load-bearing invariant: GENERIC_EXP_AXES carries the SAME axis ids + the SAME
 * option keys as the wedding EXP_AXES, so the deterministic resolvePersona (which
 * scores on keys) works unchanged on generic answers. Also: every persona the
 * resolver can return has generic reveal copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXP_AXES,
  EXP_PERSONAS,
  resolvePersona,
} from '@/app/onboarding/wedding/_data/experience-personas';
import { GENERIC_EXP_AXES, GENERIC_PERSONA_REVEAL, GENERIC_AXIS_IDS } from './generic-content';

test('generic axes mirror the wedding axis ids + option keys exactly', () => {
  assert.equal(GENERIC_EXP_AXES.length, EXP_AXES.length);
  for (let i = 0; i < EXP_AXES.length; i++) {
    const w = EXP_AXES[i]!;
    const g = GENERIC_EXP_AXES[i]!;
    assert.equal(g.id, w.id, `axis ${i} id`);
    assert.deepEqual(
      g.options.map((o) => o.key),
      w.options.map((o) => o.key),
      `axis ${w.id} option keys`,
    );
  }
});

test('every resolvable persona has generic reveal copy (name + tagline + feel)', () => {
  for (const p of EXP_PERSONAS) {
    const reveal = GENERIC_PERSONA_REVEAL[p.key];
    assert.ok(reveal, `missing generic reveal for ${p.key}`);
    assert.ok(reveal.name.length > 0 && reveal.tagline.length > 0 && reveal.feel.length > 0);
    // feel mirrors the wedding persona so the palette stays consistent.
    assert.equal(reveal.feel, p.feel, `feel mismatch for ${p.key}`);
  }
});

test('resolvePersona works on generic answers (keys are compatible)', () => {
  // Pick the first option of each generic axis → a valid answer set.
  const answers = Object.fromEntries(
    GENERIC_EXP_AXES.map((a) => [a.id, a.options[0]!.key]),
  );
  const key = resolvePersona(answers);
  assert.ok(GENERIC_PERSONA_REVEAL[key], `resolved persona ${key} has reveal copy`);
});

test('GENERIC_AXIS_IDS lists the 5 axes in order', () => {
  assert.deepEqual(GENERIC_AXIS_IDS, ['for_whom', 'feel', 'energy', 'roots', 'effort']);
});

test('generic copy carries no "wedding"/"bride"/"groom" wording', () => {
  const blob = JSON.stringify(GENERIC_EXP_AXES) + JSON.stringify(GENERIC_PERSONA_REVEAL);
  assert.ok(!/wedding|bride|groom/i.test(blob), 'generic content must be event-neutral');
});
