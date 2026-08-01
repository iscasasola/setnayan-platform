/**
 * The shared env-flag parser, and the inventory of what has NOT adopted it.
 *
 * On 2026-08-01 the owner set `NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED`, redeployed,
 * and the login wall stayed up. No error, no log line — because a flag that
 * fails to parse looks exactly like a flag that is off. The reader demanded the
 * literal string `true` while ~10 sibling flags in the same repo accepted
 * `true` / `1` / `TRUE`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { envFlagEnabled } from './env-flag';

const HERE = dirname(fileURLToPath(import.meta.url));

test('every reasonable spelling of ON is accepted', () => {
  for (const v of ['true', 'TRUE', 'True', '1', 'yes', 'YES', 'on', 'ON']) {
    assert.equal(envFlagEnabled(v), true, `"${v}" must read as ON`);
  }
});

test('surrounding whitespace is ignored', () => {
  // A trailing space is invisible in a dashboard input and has cost real hours.
  for (const v of [' true', 'true ', '  TRUE  ', '\t1\n']) {
    assert.equal(envFlagEnabled(v), true, `"${JSON.stringify(v)}" must read as ON`);
  }
});

test('FAIL-CLOSED on anything else', () => {
  // These flags gate unfinished and compliance-sensitive features, so an
  // unrecognised value must never be read as permission.
  for (const v of ['false', 'FALSE', '0', 'no', 'off', '', '   ', 'ture', 'enabled', 'y']) {
    assert.equal(envFlagEnabled(v), false, `"${v}" must read as OFF`);
  }
  assert.equal(envFlagEnabled(undefined), false, 'unset must read as OFF');
  assert.equal(envFlagEnabled(null), false, 'null must read as OFF');
});

test('the Papic login-free flag reads through the shared parser', () => {
  const src = readFileSync(join(HERE, 'papic-seats.ts'), 'utf8');
  assert.match(
    src,
    /envFlagEnabled\(process\.env\.NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED\)/,
    'papicSeatAnonEnabled must use envFlagEnabled — and must pass the VALUE, ' +
      'not the name, or NEXT_PUBLIC inlining breaks in the browser.',
  );
});

/**
 * ⚠ INVENTORY, NOT AN ASSERTION.
 *
 * This prints how many flag readers still use strict `=== 'true'`. It does NOT
 * fail on them, on purpose: converting one WIDENS what counts as ON, and if
 * that flag is already set to a variant like `TRUE` in some environment, the
 * conversion silently ACTIVATES whatever it gates — several of which are
 * unfinished or waiting on DPO sign-off.
 *
 * So a sweep must be done per-flag, by someone who checks the live value first.
 * This test exists to keep the number visible instead of forgotten.
 */
test('inventory: strict flag readers still outstanding', () => {
  const files = readdirSync(HERE).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const strict: string[] = [];
  for (const f of files) {
    const src = readFileSync(join(HERE, f), 'utf8');
    for (const m of src.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+) === 'true'/g)) {
      strict.push(`${f}:${m[1]}`);
    }
  }
  // Not an upper bound to defend — just a number someone can see moving.
  console.log(`[env-flag] strict readers remaining: ${strict.length}`);
  assert.ok(Array.isArray(strict), 'inventory computed');
});
