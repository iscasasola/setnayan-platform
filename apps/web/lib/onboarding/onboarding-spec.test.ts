/**
 * Unit suite for the per-type onboarding content resolver (0053 · 2026-06-28).
 *
 * Invariants:
 *  - PARITY: with NO override row, the resolved spec equals the TS defaults for
 *    that type (so the DB-driven path is byte-identical to the pre-DB flow);
 *  - an unknown packKey resolves to empty questions + null pack + the generic
 *    reveal/axes (never throws);
 *  - a valid override REPLACES the field; a MALFORMED override falls back to the
 *    default (a bad admin edit can't break the flow);
 *  - reveal overrides MERGE per-persona and ignore unknown persona keys;
 *  - axis overrides change COPY only — axis ids + option keys stay locked
 *    (resolvePersona depends on them).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOnboardingSpec } from './onboarding-spec';
import { PER_TYPE_QUESTIONS } from './type-questions';
import { PERSONA_PACKS } from './persona-packs';
import { GENERIC_EXP_AXES, GENERIC_PERSONA_REVEAL } from './generic-content';

const SEEDED_TYPES = Object.keys(PER_TYPE_QUESTIONS);

test('no override row → resolves to the TS defaults (parity)', () => {
  for (const type of SEEDED_TYPES) {
    const spec = resolveOnboardingSpec(type, type, null);
    assert.equal(spec.eventType, type);
    assert.equal(spec.packKey, type);
    assert.equal(spec.intro, null);
    assert.deepEqual(spec.questions, PER_TYPE_QUESTIONS[type]);
    assert.equal(spec.personaPack, PERSONA_PACKS[type] ?? null);
    assert.deepEqual(spec.revealByPersona, GENERIC_PERSONA_REVEAL);
    assert.deepEqual(spec.axes, GENERIC_EXP_AXES);
  }
});

test('unknown packKey → empty questions, null pack, generic reveal/axes', () => {
  const spec = resolveOnboardingSpec('made_up', 'made_up', null);
  assert.deepEqual(spec.questions, []);
  assert.equal(spec.personaPack, null);
  assert.deepEqual(spec.revealByPersona, GENERIC_PERSONA_REVEAL);
  assert.deepEqual(spec.axes, GENERIC_EXP_AXES);
});

test('valid questions override replaces the default', () => {
  const questions = [
    {
      id: 'q1',
      eyebrow: 'Eye',
      question: 'Q?',
      options: [{ key: 'a', title: 'A', desc: 'd', adds: ['cake'] }],
    },
  ];
  const spec = resolveOnboardingSpec('birthday', 'birthday', {
    intro: null,
    questions,
    persona_pack: null,
    reveal_overrides: null,
    axis_overrides: null,
  });
  assert.deepEqual(spec.questions, questions);
});

test('malformed questions override falls back to the default', () => {
  for (const bad of [42, 'nope', {}, [{ id: 'x' }], [{ id: 'x', eyebrow: 'e', question: 'q', options: [{ key: 'k' }] }]]) {
    const spec = resolveOnboardingSpec('birthday', 'birthday', {
      intro: null,
      questions: bad,
      persona_pack: null,
      reveal_overrides: null,
      axis_overrides: null,
    });
    assert.deepEqual(spec.questions, PER_TYPE_QUESTIONS.birthday, `bad=${JSON.stringify(bad)}`);
  }
});

test('valid persona_pack override replaces; malformed falls back', () => {
  const pack = {
    essentials: ['cake'],
    byPersona: { keepsake: ['photo_video'] },
    servicesByPersona: { keepsake: ['papic_seats'] },
  };
  const good = resolveOnboardingSpec('birthday', 'birthday', {
    intro: null,
    questions: null,
    persona_pack: pack,
    reveal_overrides: null,
    axis_overrides: null,
  });
  assert.deepEqual(good.personaPack, pack);

  const bad = resolveOnboardingSpec('birthday', 'birthday', {
    intro: null,
    questions: null,
    persona_pack: { essentials: 'not-an-array' },
    reveal_overrides: null,
    axis_overrides: null,
  });
  assert.equal(bad.personaPack, PERSONA_PACKS.birthday);
});

test('reveal override merges per-persona and ignores unknown keys', () => {
  const spec = resolveOnboardingSpec('birthday', 'birthday', {
    intro: null,
    questions: null,
    persona_pack: null,
    reveal_overrides: {
      keepsake: { tagline: 'A birthday to relive forever.' },
      not_a_persona: { name: 'Ghost' },
    },
    axis_overrides: null,
  });
  assert.equal(spec.revealByPersona.keepsake!.tagline, 'A birthday to relive forever.');
  // name/feel untouched (partial merge); unknown key not added
  assert.equal(spec.revealByPersona.keepsake!.name, GENERIC_PERSONA_REVEAL.keepsake!.name);
  assert.equal(spec.revealByPersona.not_a_persona, undefined);
});

test('axis override changes copy only — ids + option keys stay locked', () => {
  const spec = resolveOnboardingSpec('birthday', 'birthday', {
    intro: null,
    questions: null,
    persona_pack: null,
    reveal_overrides: null,
    axis_overrides: {
      for_whom: { question: 'Who is this birthday for?', options: { couple: { title: 'For me' } } },
    },
  });
  const forWhom = spec.axes.find((a) => a.id === 'for_whom')!;
  assert.equal(forWhom.question, 'Who is this birthday for?');
  const couple = forWhom.options.find((o) => o.key === 'couple')!;
  assert.equal(couple.title, 'For me');
  // KEYS unchanged across all axes (resolvePersona depends on them)
  assert.deepEqual(
    spec.axes.map((a) => a.id),
    GENERIC_EXP_AXES.map((a) => a.id),
  );
  for (const axis of spec.axes) {
    const def = GENERIC_EXP_AXES.find((a) => a.id === axis.id)!;
    assert.deepEqual(
      axis.options.map((o) => o.key),
      def.options.map((o) => o.key),
    );
  }
});

test('valid intro returned; malformed intro → null', () => {
  const intro = { eyebrow: 'E', headline: 'H', subcopy: 'S' };
  const good = resolveOnboardingSpec('birthday', 'birthday', {
    intro,
    questions: null,
    persona_pack: null,
    reveal_overrides: null,
    axis_overrides: null,
  });
  assert.deepEqual(good.intro, intro);

  const bad = resolveOnboardingSpec('birthday', 'birthday', {
    intro: { eyebrow: 'E' },
    questions: null,
    persona_pack: null,
    reveal_overrides: null,
    axis_overrides: null,
  });
  assert.equal(bad.intro, null);
});
