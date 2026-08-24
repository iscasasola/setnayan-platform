/**
 * A GRANT IS NOT A WITHDRAWAL.
 *
 * 🚨 THE CLIFF THIS PINS, WHICH SHIPPED FOR A FEW HOURS ON 2026-08-25. Four
 * call sites edited one area of an existing grant by spreading
 * `{ ...(perms.areas ?? {}) }` and setting a single key. On a row with NO
 * `areas` map — which is what the couple's own host-invite door mints for every
 * role except the coordinator — that wrote a map naming exactly one area. The
 * narrowing that landed the same morning then made every area missing from a
 * map resolve to nothing.
 *
 * So: the couple press "Allow event photos" on their ninong's row, meaning to
 * give him one more thing, and take away the guest list, the seat plan, the
 * schedule, the suppliers, the invitations and the mood board. The button says
 * "Allow event photos". Nothing on the screen says anything else happened.
 *
 * ⚠ AND THE MIGRATION'S OWN HEADER SAID THIS COULD NOT HAPPEN — it claimed a
 * no-`areas` row is "the legacy shape, written before `areas` existed". The
 * invite door mints one today. **The write path was never re-read after the
 * resolver changed**, which is the whole lesson: when you narrow a rule, grep
 * the writers of the thing it reads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DELEGATE_AREAS,
  materializeAreas,
  resolveAreaLevel,
  withArea,
  type ModeratorPermissions,
} from './delegate-areas';

/** What the couple's invite door actually writes for a ninong today. */
const INVITED_HOST: ModeratorPermissions = {
  edit_all: true,
  checkout: true,
  invite_hosts: false,
  remove_hosts: false,
};

/** The narrowest invited role — no edit_all, still no `areas` map. */
const INVITED_VIEWER: ModeratorPermissions = {
  edit_all: false,
  checkout: false,
  invite_hosts: false,
  remove_hosts: false,
};

const COORDINATOR: ModeratorPermissions = {
  edit_all: false,
  checkout: false,
  invite_hosts: false,
  remove_hosts: false,
  areas: { seat_plan: 'view' },
};

/** Source with comments removed — see the guard below for why that matters. */
function stripComments(raw: string): string {
  let out = '';
  let i = 0;
  let inBlock = false;
  let inLine = false;
  while (i < raw.length) {
    const two = raw.slice(i, i + 2);
    if (!inBlock && !inLine && two === '/*') { inBlock = true; i += 2; continue; }
    if (inBlock && two === '*/') { inBlock = false; i += 2; continue; }
    if (!inBlock && !inLine && two === '//') { inLine = true; i += 2; continue; }
    if (inLine && raw[i] === '\n') { inLine = false; out += '\n'; i += 1; continue; }
    if (!inBlock && !inLine) out += raw[i];
    i += 1;
  }
  return out;
}

function levels(p: ModeratorPermissions): Record<string, string | null> {
  return Object.fromEntries(DELEGATE_AREAS.map((a) => [a, resolveAreaLevel(p, a)]));
}

test('granting one area changes exactly that area, on a row with no areas map', () => {
  const before = levels(INVITED_HOST);
  const after = levels(withArea(INVITED_HOST, 'photos', 'view'));

  assert.equal(before.photos, null, 'photos start closed — that is why there is a button');
  assert.equal(after.photos, 'view', 'the button did what it says');

  for (const area of DELEGATE_AREAS) {
    if (area === 'photos') continue;
    assert.equal(
      after[area],
      before[area],
      `granting photos moved ${area} from ${before[area]} to ${after[area]} — that is the cliff`,
    );
  }
});

test('withdrawing one area changes exactly that area', () => {
  const before = levels(INVITED_HOST);
  const after = levels(withArea(INVITED_HOST, 'budget', null));
  assert.equal(after.budget, null);
  for (const area of DELEGATE_AREAS) {
    if (area === 'budget') continue;
    assert.equal(after[area], before[area], `${area} moved while budget was withdrawn`);
  }
});

test('the narrowest invited role is not widened by being touched', () => {
  // The false-positive direction: materialising must not HAND OUT anything.
  const before = levels(INVITED_VIEWER);
  const after = levels(withArea(INVITED_VIEWER, 'photos', 'view'));
  for (const area of DELEGATE_AREAS) {
    if (area === 'photos') continue;
    assert.equal(after[area], before[area], `${area} was widened by an unrelated grant`);
  }
  assert.equal(before.guest_list, 'view', 'a viewer reads, and must go on reading');
});

test('a coordinator row — which already has a map — is untouched in every other line', () => {
  const before = levels(COORDINATOR);
  const after = levels(withArea(COORDINATOR, 'photos', 'view'));
  assert.equal(before.guest_list, null, 'the host granted her the seat plan and nothing else');
  assert.equal(after.guest_list, null, 'and that must not change because photos were shared');
  assert.equal(after.seat_plan, 'view', 'nor may she lose the one line she was given');
});

test('materialising writes every area down, and writes down what was already true', () => {
  const map = materializeAreas(INVITED_HOST);
  assert.deepEqual(
    Object.keys(map).sort(),
    [...DELEGATE_AREAS].sort(),
    'a partial map is the cliff — every area must be named',
  );
  for (const area of DELEGATE_AREAS) {
    assert.equal(map[area], resolveAreaLevel(INVITED_HOST, area), `${area} was not preserved`);
  }
});

test('THE GUARD: no writer edits an areas map by spreading it', () => {
  // 🔑 DERIVED FROM THE COLUMN, NOT FROM A LIST I TYPED — the four call sites
  // that had this defect were found by grepping every writer of
  // `permissions_json`, and this walks that same set. A hand-typed list is a
  // list of the writers somebody thought of.
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const out = execSync(
    "grep -rln \"permissions_json\" app lib --include=*.ts --include=*.tsx || true",
    { encoding: 'utf8', shell: '/bin/bash' },
  );
  const files = out.split('\n').filter((f) => f && !f.includes('.test.'));
  assert.ok(files.length >= 6, `expected the permissions_json writers, found ${files.length}`);

  const offenders: string[] = [];
  for (const f of files) {
    // ⚠ COMMENTS STRIPPED FIRST. The first run of this guard went red on the
    // comment I had just written explaining the fix, which quotes the broken
    // pattern verbatim. A rule that matches the sentence describing the rule is
    // a rule that can never be satisfied.
    const src = stripComments(readFileSync(f, 'utf8'));
    // The exact shape that was wrong four times: spread the existing map (or an
    // empty one) so that unnamed areas silently drop out.
    if (/\.\.\.\(\s*[A-Za-z_$][\w$]*\.areas\s*\?\?\s*\{\}\s*\)/.test(src)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `edit an areas map with withArea(), never a spread: ${offenders.join(', ')}`);
});
