/**
 * calculations-are-real.test.ts — every calculation the Root map names is
 * computed by code that exists, over columns that exist.
 *
 * `CALCULATIONS` (lib/ugat/fields.ts) is a short hand-kept list, so it is held
 * to the code and the schema: an anchor that is renamed or deleted, or an
 * input column that is dropped, turns this red instead of leaving the map
 * describing a calculation nobody performs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CALCULATIONS } from './fields';
import { listSources } from './scan-screens';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');

test('every anchor is a function defined somewhere in the app', () => {
  const all = listSources(WEB)
    .map((r) => readFileSync(join(WEB, r), 'utf8'))
    .join('\n');
  for (const c of CALCULATIONS) {
    for (const a of c.anchors) {
      assert.ok(
        new RegExp(`\\bfunction\\s+${a}\\b|\\bconst\\s+${a}\\s*=`).test(all),
        `${c.id}: anchor ${a} no longer exists`,
      );
    }
  }
});

test('every input column is in the production schema snapshot', () => {
  const snap = readFileSync(join(WEB, '../../supabase/security/prod-schema.snapshot.txt'), 'utf8');
  const cols = new Set(snap.split('\n').map((l) => l.trim()));
  for (const c of CALCULATIONS) {
    for (const i of c.inputs) {
      if (i === 'today') continue;
      assert.ok(cols.has(i), `${c.id}: input ${i} is not a production column`);
    }
  }
});
