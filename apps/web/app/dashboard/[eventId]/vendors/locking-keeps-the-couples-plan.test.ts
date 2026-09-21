/**
 * LOCKING A SUPPLIER MUST NOT ERASE THE PAYMENT PLAN THE COUPLE TYPED.
 * (2026-09-21)
 *
 * The owner asked whether a self-added supplier's payment plan is "connected".
 * Tracing it answered: connected, then ERASED at lock. `finalizeVendor`
 * snapshots a plan at every lock with an `upsert`, written when only a
 * marketplace supplier could have one. For a supplier the couple added, there
 * is no service schedule to snapshot, so it seeded a generic 50/50 estimate and
 * REPLACED the couple's own "30% now, 70% two weeks before".
 *
 * The rule itself is pure and executed in `lib/self-added-payment-plan.test.ts`
 * (`lockMayOverwritePlan`). This file guards the other half, which a pure test
 * cannot see: that the lock step still ASKS it. Deleting the call would leave
 * every unit test green while the overwrite came straight back.
 *
 * ⚠ Scoped to the snapshot block — from the "THE COUPLE'S OWN PLAN SURVIVES"
 * marker to the upsert's `onConflict` — and asserts the anchor is present
 * first, so a rename fails loud instead of passing over nothing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ACTIONS = path.join(HERE, 'actions.ts');
const START = "THE COUPLE'S OWN PLAN SURVIVES THE LOCK";
const END = "{ onConflict: 'event_id,event_vendor_id' }";

describe('locking keeps the couple’s plan', () => {
  const src = readFileSync(ACTIONS, 'utf8');
  const a = src.indexOf(START);
  const b = src.indexOf(END, a);
  const block = a >= 0 && b > a ? src.slice(a, b) : '';

  it('found the lock-time snapshot block', () => {
    assert.ok(
      block.length > 0,
      'could not find the payment-plan snapshot block in finalizeVendor — ' +
        'if it moved or was renamed, re-point this guard; do not delete it.',
    );
  });

  it('asks lockMayOverwritePlan before writing', () => {
    assert.match(block, /lockMayOverwritePlan\s*\(/, 'the lock step no longer consults the rule');
  });

  it('actually skips the upsert when the couple’s plan must survive', () => {
    // Consulting the rule and ignoring the answer is the other way to lose the
    // plan — "keep the call, discard its result". The upsert must sit behind
    // the verdict.
    assert.match(
      block,
      /keepCouplePlan\s*\?\s*\{\s*error:\s*null\s*\}\s*:\s*await planAdmin/,
      'the upsert is no longer gated on keepCouplePlan — a lock would overwrite ' +
        'the couple’s own plan with a generic estimate again.',
    );
  });

  it('does not overwrite a self-added supplier’s plan when the read fails', () => {
    // An unreadable plan is not an absent one. Falling back to "overwrite"
    // would clobber the only copy of what the couple typed.
    assert.match(
      block,
      /existingPlanErr\s*\?\s*!onPlatformBooking/,
      'a failed read of the existing plan now falls through to overwriting it',
    );
  });
});
