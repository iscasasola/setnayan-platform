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

// Snapshot of tier-2 `service_categories` valid for the generic (non-wedding)
// flow: the UNIVERSAL ids (applicable_event_types = null) plus the type-scoped
// extras. Mirrors the live taxonomy (verified 2026-06-28). Guards every option's
// `adds` against typos / a removed category / a wedding-only id leaking in — the
// "no dangling ids" contract (a non-applicable id is silently dropped at runtime,
// so a typo would just vanish from the plan unnoticed without this test).
const UNIVERSAL_CATEGORIES = new Set([
  'arcade_games', 'cake', 'caricature_calligraphy_painting', 'catering', 'ceremony_venue',
  'choir', 'choreographer', 'coffee_espresso', 'coordinator', 'dance_floor', 'date_specialist',
  'dessert', 'digital_services', 'dj', 'editorial', 'engraving_embroidery', 'escort',
  'filipiniana_barongs', 'fireworks', 'florist', 'food_cart', 'food_truck', 'grooming',
  'guest_shuttle', 'henna_tattoo', 'hmua', 'host_mc', 'jewelleries_accessories', 'led_wall',
  'lights_sound', 'live_band', 'livestream', 'massage_chair', 'mens_attire', 'mini_nail_bar',
  'mobile_bar', 'mocktail', 'orchestra', 'outdoor', 'performers', 'perfume_bar', 'photo_booth',
  'photo_video', 'printing', 'reception', 'souvenir_giveaways', 'stations', 'stylist_decorator',
  'tarot_astrology_palmistry', 'wellness_fitness', 'womens_attire',
]);
const TYPE_SCOPED_CATEGORIES: Record<string, string[]> = {
  tournament: ['trophies_awards'],
  corporate: ['trophies_awards'],
};

test('every adds id is a real taxonomy category applicable to its type', () => {
  for (const [type, qs] of Object.entries(PER_TYPE_QUESTIONS)) {
    const allowed = new Set([...UNIVERSAL_CATEGORIES, ...(TYPE_SCOPED_CATEGORIES[type] ?? [])]);
    for (const q of qs) {
      for (const o of q.options) {
        for (const id of o.adds) {
          assert.ok(allowed.has(id), `${type}/${q.id}/${o.key}: "${id}" is not an applicable category`);
        }
      }
    }
  }
});

test('each type now has 3–4 signature questions (Standard depth)', () => {
  for (const [type, qs] of Object.entries(PER_TYPE_QUESTIONS)) {
    assert.ok(qs.length >= 3 && qs.length <= 4, `${type} has ${qs.length} questions (want 3–4)`);
  }
});
