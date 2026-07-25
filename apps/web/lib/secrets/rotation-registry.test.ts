/**
 * Secrets & Rotation registry integrity (node:test via tsx · `pnpm test:unit`).
 *
 * The registry is the ALLOWLIST every /admin/secrets server action resolves
 * against, and it is also the owner-facing runbook. Both roles have invariants
 * that are cheap to break in a hand-edit and expensive to notice in production:
 * a duplicated id silently collides two secrets onto one rotation row; a
 * vercel-api row with no env var renders a Save button that writes nowhere; a
 * db-paste row with no consoleHref is a dead end for the only secrets whose
 * rotation takes effect without a redeploy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SECRET_REGISTRY,
  CONSOLE_COLUMN_TO_SECRET_ID,
  GROUP_ORDER,
  getSecretDef,
  secretFields,
} from './rotation-registry';

test('ids are unique — a collision would merge two secrets onto one rotation row', () => {
  const ids = SECRET_REGISTRY.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('ids are stable slugs (lowercase snake_case) — they are a DB primary key', () => {
  for (const def of SECRET_REGISTRY) {
    assert.match(def.id, /^[a-z][a-z0-9_]*$/, `bad id: ${def.id}`);
  }
});

test('every vercel-api row has at least one env var to write to', () => {
  for (const def of SECRET_REGISTRY) {
    if (def.editable !== 'vercel-api') continue;
    assert.ok(def.envVars.length >= 1, `${def.id} has no envVars`);
    for (const envVar of def.envVars) {
      assert.match(envVar, /^[A-Z][A-Z0-9_]*$/, `${def.id}: bad env var ${envVar}`);
    }
  }
});

test('every vercel-api field targets an env var the row actually declares', () => {
  for (const def of SECRET_REGISTRY) {
    if (def.editable !== 'vercel-api') continue;
    for (const field of secretFields(def)) {
      assert.ok(
        def.envVars.includes(field.envVar),
        `${def.id}: field ${field.envVar} is not in envVars`,
      );
      assert.ok(field.label.trim().length > 0, `${def.id}: field label is empty`);
    }
  }
});

test('every db-paste row deep-links to the console card that owns it', () => {
  for (const def of SECRET_REGISTRY) {
    if (def.editable !== 'db-paste') continue;
    assert.ok(def.consoleHref, `${def.id} has no consoleHref`);
    assert.ok(
      def.consoleHref?.startsWith('/admin/integrations'),
      `${def.id}: consoleHref must point at the integrations console`,
    );
  }
});

test('policyDays is either null (manual) or a sane cadence of at least 30 days', () => {
  for (const def of SECRET_REGISTRY) {
    if (def.policyDays === null) continue;
    assert.ok(
      Number.isInteger(def.policyDays) && def.policyDays >= 30,
      `${def.id}: policyDays ${def.policyDays} is not an integer >= 30`,
    );
  }
});

test('every row carries instructions, an impact note, and a provider link', () => {
  for (const def of SECRET_REGISTRY) {
    assert.ok(def.steps.length > 0, `${def.id} has no steps`);
    for (const step of def.steps) {
      assert.ok(step.trim().length > 0, `${def.id} has an empty step`);
    }
    assert.ok(def.impact.trim().length > 0, `${def.id} has no impact note`);
    assert.match(def.providerUrl, /^https:\/\//, `${def.id}: providerUrl is not https`);
    assert.ok(def.label.trim().length > 0, `${def.id} has no label`);
  }
});

test('every group used by a row is in the render order — otherwise the row is invisible', () => {
  for (const def of SECRET_REGISTRY) {
    assert.ok(GROUP_ORDER.includes(def.group), `${def.id}: group ${def.group} not ordered`);
  }
});

test('the integrations-console column map only points at real registry ids', () => {
  for (const [column, id] of Object.entries(CONSOLE_COLUMN_TO_SECRET_ID)) {
    assert.ok(getSecretDef(id), `column ${column} maps to unknown secret id ${id}`);
    assert.match(column, /_enc$/, `column ${column} does not look like a ciphertext column`);
  }
});

test('getSecretDef is the allowlist gate — unknown ids resolve to undefined', () => {
  assert.ok(getSecretDef('cron_secret'));
  assert.equal(getSecretDef('not_a_real_secret'), undefined);
  assert.equal(getSecretDef(''), undefined);
  assert.equal(getSecretDef('__proto__'), undefined);
});

test('secretFields defaults to the first env var when no explicit pair is declared', () => {
  const cron = getSecretDef('cron_secret');
  assert.ok(cron);
  assert.deepEqual(secretFields(cron), [{ envVar: 'CRON_SECRET', label: 'New value' }]);

  const r2 = getSecretDef('r2_keys');
  assert.ok(r2);
  assert.equal(secretFields(r2).length, 2);
});

test('ENCRYPTION_KEY is never in-app editable — it needs the dual-key runbook', () => {
  const def = getSecretDef('encryption_key');
  assert.ok(def);
  assert.equal(def.editable, 'instructions-only');
  assert.equal(def.policyDays, null);
  assert.ok(def.envVars.includes('ENCRYPTION_KEY_PREVIOUS'));
});
