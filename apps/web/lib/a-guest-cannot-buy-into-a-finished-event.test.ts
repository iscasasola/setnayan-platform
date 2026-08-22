import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * a-guest-cannot-buy-into-a-finished-event.test.ts
 *
 * Owner, 2026-08-21, asked whether a guest may still buy Papic shots after the
 * event: **"no. it needs to be in a new event."**
 *
 * Papic credits are scoped to ONE celebration — they are spent by cameras
 * shooting it — so selling more into a finished event takes money for something
 * the buyer can never use. This path never touched the couple-side gate: it
 * mints its own orders, reachable with NO ACCOUNT.
 *
 * 🛡 Mutation-checked by occurrence count. Comments stripped before matching —
 * every fix here quotes the rule it enforces.
 */

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const code = (p: string) =>
  readFileSync(join(WEB, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

test('the guest purchase refuses once the celebration is over', () => {
  const actions = code('app/papic/buy/actions.ts');
  assert.match(
    actions,
    /if \(await eventIsOver\(createAdminClient\(\), buyer!\.eventId\)\) backTo\(returnTo, 'event_over'\)/,
    'the mint must refuse',
  );
});

/*
  🔑 THE EVENT COMES OFF THE CREDENTIAL, NEVER OFF THE FORM.
  An action that accepted an event id would let anyone with the public key mint
  orders against arbitrary events — the reason this file has never had one. The
  gate must inherit that, or it becomes the way to point the check elsewhere.
*/
test('the gate reads the credential’s own event, not a form field', () => {
  const actions = code('app/papic/buy/actions.ts');
  const call = /eventIsOver\(createAdminClient\(\), ([^)]+)\)/.exec(actions);
  assert.ok(call?.[1], 'the gate must exist');
  assert.equal(call[1].trim(), 'buyer!.eventId');
  assert.ok(
    !/eventIsOver\([^)]*formData/.test(actions),
    'never let a form value choose which event is checked',
  );
});

/*
  ⚠ THE SIBLING ACTION MUST STAY OPEN. `submitPapicGuestPayment` settles an
  order that ALREADY EXISTS. A guest who bought before the party ended still
  owes that money; blocking them would strand a real debt behind a rule about
  NEW purchases.
*/
test('paying an order that already exists is never blocked by the event being over', () => {
  const actions = code('app/papic/buy/actions.ts');
  const submit = actions.slice(actions.indexOf('export async function submitPapicGuestPayment'));
  assert.ok(submit.length > 0, 'the payment action must exist');
  assert.ok(!/eventIsOver/.test(submit), 'settling an existing debt must stay open');
});

/*
  The doorway, closed too — so nobody is offered something they would then be
  refused. Both surfaces that mount the panel pass an eventId, or the gate
  silently does nothing on one of them.
*/
test('the buy panel stops offering, on both surfaces', () => {
  const panel = code('app/papic/_components/papic-guest-buy-panel.tsx');
  assert.match(panel, /eventIsOver\(admin, eventId\)/);
  assert.match(panel, /if \(isOver\) return null;/);
  for (const f of ['app/papic/guest/page.tsx', 'app/papic/seat/[token]/page.tsx']) {
    const src = code(f);
    const mount = src.slice(src.indexOf('<PapicGuestBuyPanel'));
    assert.match(mount.slice(0, 400), /eventId=/, `${f} must pass eventId or the gate is inert`);
  }
});

/*
  A refusal a person cannot read is a dead end. The code the action bounces back
  with must have a sentence, and it must say the RULE — shots are per event.
*/
test('the refusal says why, and says the rule', () => {
  const shell = code('app/papic/_components/papic-buy-shell.tsx');
  assert.match(shell, /event_over:/, 'the code needs copy');
  const copy = /event_over:\s*\n?\s*'([^']+)'/.exec(shell);
  assert.ok(copy?.[1], 'copy must be a plain string');
  assert.match(copy[1], /one event at a time/, 'the rule, not just a refusal');
});

/*
  ONE helper, not a second copy of the arithmetic — and it must never be
  swapped for the Papic capture window, which FAILS OPEN when a couple never
  set bounds.
*/
test('the shared helper asks the one resolver and fails soft', () => {
  const helper = code('lib/event-is-over.server.ts');
  assert.match(helper, /import 'server-only';/, 'it uses the admin client');
  assert.match(helper, /getMenuLifecyclePhase\(/, 'the one resolver');
  assert.ok(!/captureWindow|papic_window/.test(helper), 'never the capture window');
  assert.match(helper, /if \(!data\) return false;/, 'an unreadable row must not refuse a sale');
});
