/**
 * 💳 The Maya pay page — how it is WIRED (owner 2026-11-21; DECISION_LOG "MAYA IS THE MAIN WAY TO PAY", "BDO QR IS
 * NOT AN OPTION — ONLY THE SAFETY ROUTE WHEN MAYA IS OFF", "MAYA PAY PAGE v3 — APPROVED"). Source-level, because the
 * pieces are a server page, a route and a form action that need a request to run:
 *
 *   · Maya on → Maya IS stage 2: no BDO card, no QR, no proof stage, no BDO numbers on stage 1;
 *   · Maya is offered only when the gate says open (switch + keys), within the ceiling, and not busy;
 *   · back from Maya and not confirmed → "Checking…", with NO pay controls (never a live QR beside a started payment);
 *   · Maya will not open → the BDO QR with the drawing's one line, and one admin notice;
 *   · the start re-asks the gate, ownership and the ceiling, and re-settles the previous checkout first;
 *   · the webhook answers 200 to everyone and only Maya's addresses are acted on;
 *   · the switch lives in ONE place — the Integrations Maya card;
 *   · no server action was added.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(process.cwd(), process.cwd().endsWith('apps/web') ? '' : 'apps/web');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const code = (p: string) => stripComments(read(p));
const PANEL = 'app/pay/[reference]/_components/pay-panel.tsx';
const PAGE = 'app/pay/[reference]/page.tsx';

test('Maya on → no BDO while Maya is on: the BDO stage, the proof stage and the BDO numbers all step aside', () => {
  const panel = code(PANEL);
  assert.match(panel, /const mayaMode = maya != null;/);
  assert.match(panel, /<div hidden=\{stage !== 2 \|\| mayaMode\}>/, 'the BDO stage 2 still shows beside Maya');
  assert.match(panel, /\{proofMounted && !mayaMode && \(/, 'the proof stage still mounts on the Maya path');
  assert.match(panel, /\{!mayaMode && \(\s*<details/, 'stage 1 still prints the BDO numbers while Maya is on');
  assert.match(panel, /last=\{mayaMode \? 2 : PROOF_STAGE\}/, 'the Maya path must draw two dots, not three');
  assert.equal(/\{maya\}\s*\n\s*<p className="mt-4 text-xs/.test(panel), false, 'the old "button under the QR" shape is back');
});

test('the page offers Maya only when the gate says open, within the ceiling, not busy and not checking', () => {
  const page = code(PAGE);
  assert.match(page, /const mayaOpen = !waiting && !overCeiling && \(await maya\.railOpenFor\(payable\.amountPhp\)\);/);
  assert.match(page, /mayaOpen \? \(\s*<MayaPayStage/);
  const ret = code('app/pay/[reference]/maya-return.ts');
  assert.match(ret, /if \(phase === 'busy'\) return false;/);
  assert.match(ret, /if \(!state\.open\) return false;/);
  assert.match(ret, /paymentWithinCeiling\(amountPhp, await getMaxPaymentPhp\(/);
});

test('back from Maya, not confirmed: "Checking…" and no pay controls at all', () => {
  const page = code(PAGE);
  const early = page.slice(page.indexOf("if (maya.phase === 'checking' && !waiting) {"));
  assert.ok(early.length > 0 && page.includes("if (maya.phase === 'checking' && !waiting) {"), 'the checking state is gone');
  const block = early.slice(0, early.indexOf('\n  }\n'));
  assert.match(block, /<MayaChecking \/>/);
  assert.equal(/<PayPanel|<MayaPayStage|mintedUrl/.test(block), false, 'something to pay with renders while checking');
  assert.ok(page.indexOf("if (maya.phase === 'checking'") < page.indexOf('<PayPanel'), 'the checking return must come before the pay panel');
  assert.match(code('app/pay/[reference]/_components/maya-checking.tsx'), /Checking your payment…/);
});

test('Maya will not open → the BDO QR with the drawing\'s line, and one admin notice per outage', () => {
  const start = code('app/pay/[reference]/maya-start.ts');
  assert.match(start, /await noteMayaBusy\(/);
  assert.match(start, /\?maya=busy&step=2/);
  assert.match(start, /if \(!created\.ok\) return busy\(/);
  const busy = code('lib/maya-busy.server.ts');
  assert.match(busy, /\.or\(`maya_busy_noticed_at\.is\.null,maya_busy_noticed_at\.lt\.\$\{since\}`\)/, 'the notice is no longer claimed once per window');
  assert.match(busy, /type: 'payment_rail_down'/);
});

test('the start re-asks the gate, ownership and the ceiling — and re-settles the previous checkout first', () => {
  const start = code('app/pay/[reference]/maya-start.ts');
  assert.match(start, /fetchPayableByReference\(supabase, reference, user\.id\)/);
  assert.match(start, /if \(!state\.open\) redirect\(/);
  assert.match(start, /paymentWithinCeiling\(payable\.amountPhp/);
  assert.match(start, /coordinatorMoneyScopeAllowed\(/);
  assert.match(start, /amountPhp: payable\.amountPhp/);
  assert.equal(/formData\.get\('amount/.test(start), false, 'the start reads an amount from the form');
  const settleFirst = start.indexOf('await settleMaya(');
  const create = start.indexOf('await createMayaCheckout(');
  assert.ok(settleFirst > 0 && settleFirst < create, 'a new checkout opens before the previous one is re-asked — a payer could pay twice');
});

test('the webhook answers 200 to everyone, acts only for Maya\'s addresses, settles after the response', () => {
  const route = code('app/api/webhooks/maya/route.ts');
  const responses = route.match(/NextResponse\.json\([^)]*\)/g) ?? [];
  assert.ok(responses.length >= 3);
  for (const r of responses) assert.equal(r, 'NextResponse.json({ ok: true })', `the webhook answers ${r}`);
  const gate = route.indexOf('isMayaWebhookSource(');
  assert.ok(gate > 0 && gate < route.indexOf('req.json()'), 'the IP gate must come before the body is read');
  assert.match(route, /after\(async \(\) =>/);
});

test('the switch has ONE home — the Integrations Maya card — and the build-time gate is gone', () => {
  assert.match(code('app/admin/integrations/_components/maya-card.tsx'), /name="intent" value="payers_see_maya"/);
  assert.equal(existsSync(join(WEB, 'app/admin/settings/payment-methods/_components/maya-rail-switch.tsx')), false);
  assert.equal(/maya_checkout/.test(code('app/admin/settings/actions.ts')), false, 'a second home for the switch');
  for (const f of ['app/admin/integrations/page.tsx', 'app/admin/integrations/_components/maya-card.tsx', 'app/admin/switches/page.tsx']) {
    assert.equal(/NEXT_PUBLIC_MAYA_STATUS/.test(code(f)), false, `${f} still reads the build-time Maya gate`);
  }
});

test('no server action was added — the presses are intents on existing actions', () => {
  assert.match(code('app/pay/[reference]/actions.ts'), /formData\.get\('intent'\) === 'maya_checkout'\) return startMayaCheckout\(formData\)/);
  const integ = code('app/admin/integrations/actions.ts');
  assert.match(integ, /formData\.get\('intent'\) === 'register_webhooks'\) return registerMayaWebhooksFromCard\(/);
  assert.match(integ, /formData\.get\('intent'\) === 'payers_see_maya'\) return savePayersSeeMaya\(/);
  for (const f of ['app/pay/[reference]/maya-start.ts', 'app/admin/payments/maya.ts', 'lib/maya-checkout.server.ts', 'lib/maya-busy.server.ts']) {
    assert.equal(/^\s*['"]use server['"]/.test(read(f)), false, `${f} became a "use server" file`);
  }
});

test('the payer pays the total exactly — no fee or surcharge words on the Maya stage', () => {
  const stage = code('app/pay/[reference]/_components/maya-pay-stage.tsx');
  assert.match(stage, /Pay \{payAmount\(amountPhp\)\}/);
  assert.match(stage, /Secured by Maya · Your receipt arrives here the moment it&rsquo;s paid\./);
  assert.equal(/\bfee\b|surcharge|\+\s*₱|%\s*\+/i.test(stage), false, 'the Maya stage mentions a fee');
  const marks = code('app/pay/[reference]/_components/maya-marks.tsx');
  assert.match(marks, /'QR Ph', wallet === 'apple' \? 'Apple Pay' : wallet === 'google' \? 'Google Pay' : null, 'Visa', 'Mastercard', 'ShopeePay'/, 'the ruled order moved');
  assert.equal(/Grab|install?ment/i.test(marks), false, 'no Grab, no installments');
});
