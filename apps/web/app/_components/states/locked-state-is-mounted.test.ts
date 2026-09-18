import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

/**
 * State 04 · LOCKED shipped with the six-state system (design-six-state-system)
 * and then sat unmounted for a month while every paid gate drew its own grey
 * box — the both-ends guard (#5625) listed it as component-no-mount. S36 gave it
 * its first real mount, on the payment-links gate. This pins that mount so the
 * primitive cannot quietly become an orphan again, and checks the mount carries
 * the one thing the grey box lacked: a single unlock step.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const GATE = 'app/vendor-dashboard/payment-options/_components/add-payment-method.tsx';

test('LockedState is mounted on the payment-links gate, with an unlock step', () => {
  const src = stripComments(readFileSync(join(WEB, GATE), 'utf8'));
  assert.match(src, /import \{ LockedState \} from '@\/app\/_components\/states\/locked-state';/);
  const mounts = src.match(/<LockedState\b/g) ?? [];
  console.log(`# LockedState mounts in ${GATE}: ${mounts.length}`);
  assert.equal(mounts.length, 1, 'exactly one LockedState on this gate');
  assert.match(src, /href=\{routes\.vendor\.subscription\(\)\}/, 'the unlock step must point at the plans page');
  // The old grey box is gone, not sitting beside the new frame.
  assert.doesNotMatch(src, /<Lock\b/, 'the bespoke grey lock box was left behind');
});

test('the LOCKED frame never carries a price literal', () => {
  const src = readFileSync(join(WEB, 'app/_components/states/locked-state.tsx'), 'utf8');
  assert.doesNotMatch(src, /₱\s?\d/, 'a peso figure in the frame — prices come from the live catalog');
  // The mount's copy is words about tiers, not money.
  const gate = stripComments(readFileSync(join(WEB, GATE), 'utf8'));
  const block = gate.slice(gate.indexOf('<LockedState'), gate.indexOf('/>', gate.indexOf('<LockedState')));
  assert.doesNotMatch(block, /₱\s?\d/, 'the payment-links gate names a price');
});
