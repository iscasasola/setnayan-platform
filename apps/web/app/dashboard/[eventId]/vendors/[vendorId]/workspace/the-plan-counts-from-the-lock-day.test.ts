/**
 * EDITING A LOCKED PLAN MUST NOT MOVE "AFTER LOCK" DATES. (owner 2026-09-21)
 *
 * "after lock" counts from "the date you clicked on lock". `finalizeVendor`
 * stamps that day on the plan; the couple's later edits must read it back.
 * Before this, the save anchored on `event_vendors.created_at` — the day the
 * supplier was ADDED — so a March add locked in June put "7 days after lock"
 * in the past. Re-deriving "today" instead would slide every date forward on
 * each re-save.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(path.join(HERE, 'payment-plan-actions.ts'), 'utf8'));

describe('the couple’s plan counts from the lock day', () => {
  it('reads the stamped lock day', () => {
    assert.match(SRC, /\.select\('on_lock_anchor_date'\)/);
    assert.match(SRC, /const lockDateIso = onLockAnchorIso\(/);
  });

  it('no longer anchors on the day the supplier was added', () => {
    assert.ok(!SRC.includes('created_at'), 'the plan save reads created_at again');
  });

  it('refuses when the lock day cannot be read, rather than guessing today', () => {
    assert.match(SRC, /if \(anchorErr\) \{\s*throw new Error/);
  });
});
