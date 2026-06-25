/**
 * Unit suite for the per-type "signature moment" questions (0053 Phase 3 follow-up).
 * Each enabled non-wedding type has at least one question; a chosen option adds its
 * `adds` categories to the plan, deduped; unanswered / 'none' choices add nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PER_TYPE_QUESTIONS, getTypeQuestions, extraPicksFromAnswers } from './type-questions';

const ENABLED_TYPES = [
  'birthday',
  'debut',
  'gender_reveal',
  'christening',
  'corporate',
  'tournament',
  'travel',
  'celebration',
] as const;

test('every enabled type has at least one well-formed question', () => {
  for (const type of ENABLED_TYPES) {
    const qs = getTypeQuestions(type);
    assert.ok(qs.length >= 1, `${type} has no question`);
    for (const q of qs) {
      assert.ok(q.id && q.question && q.eyebrow, `${type} question missing fields`);
      assert.ok(q.options.length >= 2, `${type}/${q.id} needs >=2 options`);
      const keys = new Set(q.options.map((o) => o.key));
      assert.equal(keys.size, q.options.length, `${type}/${q.id} has duplicate option keys`);
      for (const o of q.options) {
        assert.ok(o.title && Array.isArray(o.adds), `${type}/${q.id}/${o.key} malformed`);
      }
    }
    // Question ids are unique within a type.
    const ids = new Set(qs.map((q) => q.id));
    assert.equal(ids.size, qs.length, `${type} has duplicate question ids`);
  }
});

test('only the 8 enabled types are keyed (no stray packs)', () => {
  for (const key of Object.keys(PER_TYPE_QUESTIONS)) {
    assert.ok(ENABLED_TYPES.includes(key as (typeof ENABLED_TYPES)[number]), `unexpected key ${key}`);
  }
});

test('getTypeQuestions returns [] for unknown / null / wedding', () => {
  assert.deepEqual(getTypeQuestions('anniversary'), []);
  assert.deepEqual(getTypeQuestions('wedding'), []);
  assert.deepEqual(getTypeQuestions(null), []);
  assert.deepEqual(getTypeQuestions(undefined), []);
  assert.deepEqual(getTypeQuestions(''), []);
});

test('a chosen option contributes its adds to the plan', () => {
  // gender_reveal: smoke → fireworks
  assert.deepEqual(extraPicksFromAnswers('gender_reveal', { reveal_method: 'smoke' }), ['fireworks']);
  // corporate: awards → trophies_awards + host_mc (order preserved)
  assert.deepEqual(extraPicksFromAnswers('corporate', { format: 'awards' }), ['trophies_awards', 'host_mc']);
});

test('"none" / unanswered / unknown option contribute nothing', () => {
  assert.deepEqual(extraPicksFromAnswers('birthday', { highlight: 'none' }), []);
  assert.deepEqual(extraPicksFromAnswers('birthday', {}), []);
  assert.deepEqual(extraPicksFromAnswers('birthday', { highlight: 'not_an_option' }), []);
  assert.deepEqual(extraPicksFromAnswers(null, { highlight: 'booth' }), []);
});

test('adds are deduped across options/questions, order-stable', () => {
  // christening garden → stylist_decorator, catering (both kept, in order).
  assert.deepEqual(extraPicksFromAnswers('christening', { after: 'garden' }), [
    'stylist_decorator',
    'catering',
  ]);
});

test('every adds slug is a non-empty lowercase taxonomy-style id', () => {
  for (const qs of Object.values(PER_TYPE_QUESTIONS)) {
    for (const q of qs) {
      for (const o of q.options) {
        for (const id of o.adds) {
          assert.match(id, /^[a-z][a-z0-9_]*$/, `bad slug ${id}`);
        }
      }
    }
  }
});
