/**
 * 💳 Maya Checkout — how the rail is WIRED (owner 2026-11-21). Source-level, because the
 * pieces are a server page, a route and a form action that need a request to run:
 *
 *   · the button renders only when the gate says open (switch + keys) AND within the ceiling;
 *   · BDO stays the default — the Maya button sits UNDER the rails, never replaces them;
 *   · the start re-checks the gate on the server (a posted form is never trusted);
 *   · the webhook always answers 200 with nothing about what we hold;
 *   · the build-time NEXT_PUBLIC_MAYA_STATUS gate is retired everywhere;
 *   · no server action was added — each new press is an `intent` on an existing action.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(process.cwd(), process.cwd().endsWith('apps/web') ? '' : 'apps/web');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const code = (p: string) => stripComments(read(p));

test('the pay page offers Maya only when the gate is open and the bill is within the ceiling', () => {
  const page = code('app/pay/[reference]/page.tsx');
  assert.match(page, /maya=\{\(await maya\.railOpenFor\(payable\.amountPhp\)\) \? <MayaPayButton/);
  const ret = code('app/pay/[reference]/maya-return.ts');
  assert.match(ret, /readMayaGate\(\)/);
  assert.match(ret, /if \(!state\.open\) return false;/);
  assert.match(ret, /paymentWithinCeiling\(amountPhp, await getMaxPaymentPhp\(/);
});

test('BDO stays the default: the Maya slot renders below the rails, not instead of them', () => {
  const panel = code('app/pay/[reference]/_components/pay-panel.tsx');
  const rails = panel.indexOf('<PaymentDetailsBlock');
  const slot = panel.indexOf('{maya}');
  assert.ok(rails > 0 && slot > rails, 'the Maya button moved above the QR');
  assert.equal(panel.match(/\{maya\}/g)?.length, 1, 'one Maya button, once');
});

test('the start re-asks the gate, the ceiling and ownership on the server', () => {
  const start = code('lib/maya-checkout-start.server.ts');
  assert.match(start, /fetchPayableByReference\(supabase, reference, user\.id\)/);
  assert.match(start, /if \(!state\.open\) back\(/);
  assert.match(start, /paymentWithinCeiling\(payable\.amountPhp/);
  assert.match(start, /coordinatorMoneyScopeAllowed\(/);
  // The ORDER's amount, never anything posted.
  assert.match(start, /amountPhp: payable\.amountPhp/);
  assert.equal(/formData\.get\('amount/.test(start), false, 'the start reads an amount from the form');
});

test('the webhook always answers 200 and says nothing about what we hold', () => {
  const route = code('app/api/webhooks/maya/route.ts');
  const responses = route.match(/NextResponse\.json\([^)]*\)/g) ?? [];
  assert.ok(responses.length >= 2);
  for (const r of responses) assert.equal(r, 'NextResponse.json({ ok: true })', `the webhook answers ${r}`);
  assert.match(route, /after\(async \(\) =>/, 'the settle must run after the 200, inside Maya\'s 5 s');
});

test('the build-time NEXT_PUBLIC_MAYA_STATUS gate is retired', () => {
  for (const f of [
    'app/admin/integrations/page.tsx',
    'app/admin/integrations/_components/maya-card.tsx',
    'app/admin/switches/page.tsx',
  ]) {
    assert.equal(/NEXT_PUBLIC_MAYA_STATUS/.test(code(f)), false, `${f} still reads the build-time Maya gate`);
  }
});

test('no server action was added — the three presses are intents on existing actions', () => {
  assert.match(code('app/pay/[reference]/actions.ts'), /formData\.get\('intent'\) === 'maya_checkout'\) return startMayaCheckout\(formData\)/);
  assert.match(code('app/admin/settings/actions.ts'), /intent === 'maya_checkout_toggle'\) return saveMayaCheckoutSwitch\(/);
  assert.match(code('app/admin/integrations/actions.ts'), /formData\.get\('intent'\) === 'register_webhooks'\) return registerMayaWebhooksFromCard\(/);
  for (const f of ['lib/maya-checkout-start.server.ts', 'app/admin/payments/maya.ts', 'lib/maya-checkout.server.ts']) {
    assert.equal(/^\s*['"]use server['"]/.test(read(f)), false, `${f} became a "use server" file`);
  }
});

test('the payer pays the total exactly — no fee or surcharge words on the Maya button', () => {
  const button = code('app/pay/[reference]/_components/maya-pay-button.tsx');
  assert.match(button, /Pay with card or Maya/);
  assert.equal(/fee|surcharge|\+\s*₱|%/i.test(button), false, 'the Maya button mentions a fee');
});
