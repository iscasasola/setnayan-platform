/**
 * Invariants pinning lib/faith-registry (the single faith source) to the
 * load-bearing maps it must stay in lockstep with. These are the guards that
 * make "add a faith = one DB row + one registry entry" actually true.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FAITH_REGISTRY,
  FAITH_KEY_TUPLE,
  FAITH_KEYS,
  FAITH_LABELS,
  ALLOWED_CEREMONY_VALUES,
} from './faith-registry';
import { CEREMONY_TYPE_TO_FAITH } from './taxonomy-filters';

test('registry covers the key tuple exactly, in order, no duplicates', () => {
  assert.deepEqual(FAITH_KEYS, [...FAITH_KEY_TUPLE]);
  assert.equal(new Set(FAITH_KEYS).size, FAITH_KEYS.length);
});

test('every entry carries complete couple-facing copy', () => {
  for (const e of FAITH_REGISTRY) {
    assert.ok(e.label.trim(), `${e.key}: empty label`);
    assert.ok(e.desc.trim(), `${e.key}: empty desc`);
    assert.ok(e.react.trim(), `${e.key}: empty react`);
    assert.ok(e.photoImg.trim(), `${e.key}: empty photoImg`);
    assert.ok(e.photoCap.trim(), `${e.key}: empty photoCap`);
  }
});

test('faithCol is Title-Case and NEVER lowercase (marketplace === filter)', () => {
  for (const e of FAITH_REGISTRY) {
    assert.notEqual(
      e.faithCol,
      e.faithCol.toLowerCase(),
      `${e.key}: faithCol "${e.faithCol}" must not be lowercase — the marketplace [Faith:] filter is case-sensitive`,
    );
  }
});

test('registry stays in lockstep with CEREMONY_TYPE_TO_FAITH (the tested matching map)', () => {
  for (const e of FAITH_REGISTRY) {
    assert.equal(
      CEREMONY_TYPE_TO_FAITH[e.key],
      e.faithCol,
      `${e.key}: registry faithCol "${e.faithCol}" diverges from CEREMONY_TYPE_TO_FAITH ("${CEREMONY_TYPE_TO_FAITH[e.key]}")`,
    );
  }
  // And the reverse: every faith the matching map knows (minus the non-faith
  // 'civil' ceremony form) has a registry entry — so no faith can be matchable
  // but invisible to onboarding.
  for (const key of Object.keys(CEREMONY_TYPE_TO_FAITH)) {
    if (key === 'civil') continue;
    assert.ok(
      FAITH_KEYS.includes(key as (typeof FAITH_KEYS)[number]),
      `matching map knows "${key}" but the registry has no entry — it would be matchable yet unpickable`,
    );
  }
});

test('ALLOWED_CEREMONY_VALUES = every faith + civil + mixed', () => {
  for (const key of FAITH_KEYS) assert.ok(ALLOWED_CEREMONY_VALUES.includes(key));
  assert.ok(ALLOWED_CEREMONY_VALUES.includes('civil'));
  assert.ok(ALLOWED_CEREMONY_VALUES.includes('mixed'));
  assert.equal(ALLOWED_CEREMONY_VALUES.length, FAITH_KEYS.length + 2);
});

test('labels map covers every key', () => {
  for (const key of FAITH_KEYS) {
    assert.ok(FAITH_LABELS[key]?.trim(), `${key}: missing from FAITH_LABELS`);
  }
});
