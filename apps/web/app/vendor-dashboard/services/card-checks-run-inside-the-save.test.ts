/**
 * card-checks-run-inside-the-save — the automatic card check is wired where the ruling put it.
 *
 * ⚖ Owner 2026-10-26 (DECISION_LOG "APPROVED — SERVICE CARD CHECKS AS DRAWN"): checks run inside the existing
 * Create/Save; a pass publishes as today; a flag saves the card hidden with the gold box. Each assertion is a
 * PROPERTY of the source, anchored on symbols, with the count printed where a count is the claim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = join(process.cwd(), 'app', 'vendor-dashboard', 'services');
const actions = readFileSync(join(HERE, 'actions.ts'), 'utf8');
const manager = readFileSync(join(HERE, '_components', 'services-manager.tsx'), 'utf8');

function body(src: string, fn: string): string {
  const start = src.indexOf(`export async function ${fn}(`);
  assert.ok(start >= 0, `${fn} not found`);
  const next = src.indexOf('\nexport async function ', start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}

test('commitVendorService runs the check BEFORE the one write, and the write publishes only on a pass', () => {
  const b = body(actions, 'commitVendorService');
  const check = b.indexOf('await checkServiceCard(');
  const rpc = b.indexOf(".rpc('save_vendor_service'");
  assert.ok(check > 0 && rpc > 0 && check < rpc, `check at ${check}, write at ${rpc}`);
  const publishArgs = [...b.matchAll(/p_publish:\s*([A-Za-z]+)/g)].map((m) => m[1]);
  assert.deepEqual(publishArgs, ['publishNow'], 'the RPC must take the CHECKED publish, never the raw form value');
  assert.match(b, /const publishNow = wantsLive && !cardHeld;/);
});

test('after a Reject every save re-queues — a rejected hold keeps the card held even on a pass', () => {
  const b = body(actions, 'commitVendorService');
  assert.match(b, /cardHeld = cardCheckReasons\.length > 0 \|\| existingHold\?\.status === 'rejected'/);
});

test('a held card lands on the gold box, naming the card by id — reasons are never put on the address', () => {
  const b = body(actions, 'commitVendorService');
  assert.match(b, /&held=\$\{cardId\}/);
  assert.match(b, /created=held/);
  assert.doesNotMatch(b, /[?&](reason|reasons|why)=/, 'reasons travel on the address');
});

test('the shop’s switch asks the hold first, and refuses on an unread answer', () => {
  const b = body(actions, 'toggleVendorServiceActive');
  const ask = b.indexOf("rpc('service_card_held'");
  const write = b.indexOf(".update({ is_active");
  assert.ok(ask > 0 && write > 0 && ask < write, `ask at ${ask}, write at ${write}`);
  assert.match(b, /if \(heldErr \|\| heldNow === null\)/);
});

test('the manager draws the gold box from the flag row it read, never from the address', () => {
  const boxes = [...manager.matchAll(/<HeldCardBox[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.equal(boxes.length, 1, `HeldCardBox rendered ${boxes.length} times`);
  const box = boxes[0]!;
  assert.match(box, /reasons=\{[^}]*hold\.reasons\}/);
  assert.doesNotMatch(box, /search\./, 'a prop of the gold box reads the address');
});
