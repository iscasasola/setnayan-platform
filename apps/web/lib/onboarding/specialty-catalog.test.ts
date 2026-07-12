/**
 * Unit suite for the per-type SPECIALTY CATALOG (the Track-B data layer).
 *
 * The catalog is the single typed source of truth the rich per-type onboarding
 * renderer + persistence build on, so these invariants guard its shape: field
 * types are in the vocabulary, keys are stable snake_case, repeatable controls
 * carry item_fields, and the culturally load-bearing rosters exist. Pure data →
 * fast, deterministic, no I/O.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIALTY_CATALOG,
  SPECIALTY_FIELD_TYPES,
  getSpecialtySpec,
  getSpecialtyFields,
  type SpecialtyField,
} from './specialty-catalog';

const EXPECTED_TYPES = [
  'wedding', 'debut', 'christening', 'birthday', 'gender_reveal', 'anniversary',
  'graduation', 'reunion', 'gala_night', 'corporate', 'tournament', 'travel',
  'celebration', 'simple_event',
] as const;

const FIELD_TYPES = new Set<string>(SPECIALTY_FIELD_TYPES);
const SNAKE = /^[a-z][a-z0-9_]*$/;

test('the catalog covers exactly the 14 known event types, keyed by type', () => {
  const keys = Object.keys(SPECIALTY_CATALOG).sort();
  assert.deepEqual(keys, [...EXPECTED_TYPES].sort());
  for (const [key, spec] of Object.entries(SPECIALTY_CATALOG)) {
    assert.equal(spec.type, key, `${key}: spec.type must equal its catalog key`);
  }
});

test('every spec carries the required copy fields (non-empty)', () => {
  for (const [key, spec] of Object.entries(SPECIALTY_CATALOG)) {
    assert.ok(spec.label && spec.terminology && spec.the_hook, `${key}: missing copy`);
    assert.ok(Array.isArray(spec.avoid), `${key}: avoid must be an array`);
    assert.ok(Array.isArray(spec.signature_fields), `${key}: signature_fields must be an array`);
  }
});

test('every field is well-formed: snake_case key, label, type in the vocabulary', () => {
  for (const [key, spec] of Object.entries(SPECIALTY_CATALOG)) {
    const seen = new Set<string>();
    for (const f of spec.signature_fields) {
      assert.ok(SNAKE.test(f.key), `${key}/${f.key}: key must be snake_case`);
      assert.ok(!seen.has(f.key), `${key}: duplicate field key ${f.key}`);
      seen.add(f.key);
      assert.ok(f.label && f.label.length > 0, `${key}/${f.key}: missing label`);
      assert.ok(FIELD_TYPES.has(f.type), `${key}/${f.key}: unknown field type ${f.type}`);
    }
  }
});

test('select/multiselect fields carry an options array (empty = open set)', () => {
  for (const [key, spec] of Object.entries(SPECIALTY_CATALOG)) {
    for (const f of spec.signature_fields) {
      if (f.type === 'select' || f.type === 'multiselect') {
        assert.ok(Array.isArray(f.options), `${key}/${f.key}: ${f.type} needs an options array`);
      }
    }
  }
});

test('person_roster / list fields carry non-empty, well-formed item_fields', () => {
  const rosterish = (f: SpecialtyField) => f.type === 'person_roster' || f.type === 'list';
  for (const [key, spec] of Object.entries(SPECIALTY_CATALOG)) {
    for (const f of spec.signature_fields) {
      if (!rosterish(f)) continue;
      assert.ok(Array.isArray(f.item_fields) && f.item_fields.length > 0, `${key}/${f.key}: needs item_fields`);
      const seen = new Set<string>();
      for (const it of f.item_fields!) {
        assert.ok(SNAKE.test(it.key), `${key}/${f.key}/${it.key}: item key must be snake_case`);
        assert.ok(!seen.has(it.key), `${key}/${f.key}: duplicate item key ${it.key}`);
        seen.add(it.key);
        assert.ok(FIELD_TYPES.has(it.type), `${key}/${f.key}/${it.key}: unknown item type ${it.type}`);
      }
    }
  }
});

test('the culturally load-bearing rosters exist (build-note #1: never hard-cap)', () => {
  // wedding principal sponsors, christening ninong/ninang, debut 18s + court —
  // each MUST expose at least one person_roster (the catalog's #1 cultural rule).
  for (const type of ['wedding', 'christening', 'debut'] as const) {
    const hasRoster = getSpecialtyFields(type).some((f) => f.type === 'person_roster');
    assert.ok(hasRoster, `${type} must have a person_roster (uncapped)`);
  }
});

test('loaders: known type resolves, unknown/null yields null / []', () => {
  assert.equal(getSpecialtySpec('debut')?.type, 'debut');
  assert.ok(getSpecialtyFields('debut').length > 0);
  assert.equal(getSpecialtySpec('not_a_type'), null);
  assert.equal(getSpecialtySpec(null), null);
  assert.equal(getSpecialtySpec(undefined), null);
  assert.deepEqual(getSpecialtyFields('not_a_type'), []);
  assert.deepEqual(getSpecialtyFields(null), []);
});
