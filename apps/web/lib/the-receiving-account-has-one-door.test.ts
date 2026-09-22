/**
 * the-receiving-account-has-one-door.test.ts — § 9.1's highest-consequence row.
 *
 * ── Why this one is different from the other money gates ────────────────────
 * A comp gives away one entitlement. A refund moves one amount. Changing the
 * receiving account **redirects every future payment**, from every customer,
 * until somebody notices. § 9.1 names it for exactly that reason:
 *
 *     | Modify Setnayan's static BDO / GCash payment-receiving account numbers
 *     | Payment redirection = fraud risk |
 *
 * ── 🔑 THE FINDING: THERE WERE THREE DOORS, NOT ONE ─────────────────────────
 * `savePaymentInstruments` writes the account fields. `uploadMerchantQr`
 * writes the QR image — and **a QR is a destination**: scanning it is how
 * customers actually send money, and that action never touches
 * `gcash_number`. A gate on the text fields alone would have protected the
 * number while leaving the real payment path open.
 *
 * So the property this file holds is not "the obvious action is gated". It is
 * **every write path to a destination column is gated**, which is what catches
 * a fourth door somebody adds next year.
 *
 * ⚠ Scope, stated: this reads source. It proves the SHAPE of the gate. That
 * the database refuses `decided_by = initiated_by` is the constraint's job.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';
import {
  PAYMENT_DESTINATION_FIELDS,
  PAYMENT_RAIL_CONTROLS,
  PAYMENT_QR_COLUMNS,
  changedDestinationFields,
  redirectsMoney,
} from './payment-destination';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const SETTINGS = 'app/admin/settings/actions.ts';
const DISPATCHER = 'app/admin/approvals/actions.ts';

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the rule tells a destination from a rail control', () => {
  // Blank, whitespace and null all mean "not set". Comparing raw would open an
  // approval every time an admin saved the form with an empty BDO name.
  assert.deepEqual(
    changedDestinationFields({ gcash_number: null }, { gcash_number: '' }),
    [],
    'null vs empty string must not read as a redirect',
  );
  assert.deepEqual(changedDestinationFields({ gcash_number: '0917' }, { gcash_number: '  0917  ' }), []);

  assert.deepEqual(
    changedDestinationFields({ gcash_number: '0917' }, { gcash_number: '0918' }),
    ['gcash_number'],
  );
  assert.equal(redirectsMoney({ gcash_number: '0917' }, { gcash_number: '0918' }), true);
  assert.equal(redirectsMoney({ gcash_number: '0917' }, { gcash_number: '0917' }), false);

  // Setting a previously-unset account IS a redirect — it is the first one.
  assert.deepEqual(changedDestinationFields({}, { bdo_account_number: '123' }), ['bdo_account_number']);

  // 🔒 The rail controls are NOT destinations, and must never become them.
  for (const c of PAYMENT_RAIL_CONTROLS) {
    assert.ok(
      !(PAYMENT_DESTINATION_FIELDS as readonly string[]).includes(c),
      `${c} is a rail control, not a destination. Gating it would make a bouncing rail ` +
        'un-closable until a second admin appeared — a control that STOPS money must not wait ' +
        'on a quorum.',
    );
  }
});

test('EVERY write path to a destination column is gated — all three doors', () => {
  const SKIP = new Set(['node_modules', '.next', 'dist']);
  const targets = [...PAYMENT_DESTINATION_FIELDS, ...PAYMENT_QR_COLUMNS];
  const writers: string[] = [];
  let scanned = 0;

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue;
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) { walk(abs); continue; }
      if (!/\.(ts|tsx)$/.test(entry) || entry.includes('.test.')) continue;
      scanned += 1;
      const rel = abs.slice(WEB.length + 1);
      const body = stripComments(readFileSync(abs, 'utf8'));
      if (!body.includes('platform_settings')) continue;
      if (!body.includes('.update(')) continue;
      // Does it name a destination column, or write one through the qrColumn
      // helper (which resolves to *_qr_url at runtime)?
      const namesTarget =
        targets.some((t) => body.includes(t)) || /qrColumn\s*\(/.test(body);
      if (namesTarget) writers.push(rel);
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));

  // 🔑 FLOOR THE SCAN. A walk that finds nothing reads exactly like a walk that
  // proves nothing.
  console.log(`[pay-gate] scanned ${scanned} files · ${writers.length} write a destination column`);
  assert.ok(scanned > 500, `only ${scanned} files scanned — the walk is not reaching the tree`);
  assert.ok(writers.length > 0, 'no file writes a destination column — the scan is looking in the wrong place');

  assert.deepEqual(
    writers.sort(),
    [SETTINGS],
    'A file outside the gated settings action writes the BDO/GCash receiving account or its QR. ' +
      'That is a fourth door onto payment redirection, and a gate with another door is ' +
      'decoration. Route it through approve_payment_account_change.\n  ' + writers.join('\n  '),
  );
});

test('the REQUEST paths open an approval instead of redirecting money', () => {
  const src = read(SETTINGS);

  // Both doors must consult the rule and raise a request.
  assert.match(src, /changedDestinationFields\s*\(/, 'savePaymentInstruments no longer consults the § 9.1 rule');
  const requests = src.match(/action_type: 'approve_payment_account_change'/g) ?? [];
  console.log(`[pay-gate] ${requests.length} door(s) open an approve_payment_account_change request`);
  assert.equal(
    requests.length,
    2,
    'Expected exactly two request sites — the account fields and the QR upload. A count of 1 ' +
      'means a door was un-gated (most likely the QR, which is the one that looks like a file ' +
      'upload rather than a payment change).',
  );

  // The QR door must not write the row itself any more.
  const qrStart = src.indexOf('export async function uploadMerchantQr');
  const qrEnd = src.indexOf('export async function removeMerchantQr');
  assert.ok(qrStart >= 0 && qrEnd > qrStart, 'uploadMerchantQr moved');
  const qrBody = src.slice(qrStart, qrEnd);
  assert.doesNotMatch(
    qrBody,
    /\.update\(\s*\{\s*\[qrColumn/,
    'uploadMerchantQr writes the QR column directly again — the upload would go live without a ' +
      'second admin, which is the exact door this gate was built to close.',
  );
});

test('the rail controls still save WITHOUT an approval', () => {
  // The deliberate exclusion, held so a later session cannot "helpfully" gate
  // it. An admin must always be able to close a bouncing rail alone.
  const src = read(SETTINGS);
  const fnStart = src.indexOf('export async function savePaymentInstruments');
  const fnEnd = src.indexOf('type QrKind', fnStart);
  const body = src.slice(fnStart, fnEnd);

  for (const c of ['gcash_enabled', 'bdo_enabled']) {
    assert.ok(body.includes(c), `${c} is no longer written by savePaymentInstruments`);
  }
  // The gated branch deletes ONLY destination fields from the payload before
  // saving the rest, so the kill switch is never held hostage.
  assert.match(
    body,
    /delete \(payload as Record<string, unknown>\)\[f\]/,
    'the gated branch no longer strips just the destination fields — if it now withholds the ' +
      'whole payload, an admin correcting a cap is blocked by an unrelated pending account change.',
  );
});

test('the EXECUTOR is reachable only from the approvals dispatcher', () => {
  const SKIP = new Set(['node_modules', '.next', 'dist']);
  const callers: string[] = [];
  let scanned = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue;
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) { walk(abs); continue; }
      if (!/\.(ts|tsx)$/.test(entry) || entry.includes('.test.')) continue;
      scanned += 1;
      const rel = abs.slice(WEB.length + 1);
      if (rel === SETTINGS) continue; // its definition
      const body = stripComments(readFileSync(abs, 'utf8'));
      if (!body.includes('executePaymentAccountChange')) continue;
      // Naming is not reaching: a generated registry lists every exported
      // admin function as DATA. Ask whether the file CALLS or IMPORTS it.
      const callsIt = /executePaymentAccountChange\s*\(/.test(body);
      const importsIt =
        /import[^;]*executePaymentAccountChange/.test(body) ||
        /await import\([^)]*\)[^;]*executePaymentAccountChange/.test(body);
      if (!callsIt && !importsIt) continue;
      callers.push(rel);
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));

  console.log(`[pay-gate] scanned ${scanned} files for executePaymentAccountChange callers`);
  assert.ok(scanned > 500, `only ${scanned} files scanned`);
  assert.deepEqual(callers.sort(), [DISPATCHER], 'a second door onto the executor');
});

test('the executor writes only destination columns, and records both admins', () => {
  const src = read(SETTINGS);
  const start = src.indexOf('export async function executePaymentAccountChange');
  const end = src.indexOf('export async function uploadBrandIcon', start);
  assert.ok(start >= 0 && end > start, 'the executor moved');
  const body = src.slice(start, end);

  // A payload that names its own target column is a write primitive. The
  // executor must refuse anything outside the destination set.
  assert.match(
    body,
    /names non-destination column/,
    'the executor no longer rejects payload keys outside PAYMENT_DESTINATION_FIELDS. A pending ' +
      'row could then name any column in platform_settings and have a second admin approve it ' +
      'without seeing what they were writing.',
  );
  assert.match(body, /confirmed_by: params\.confirmingAdminId/, 'the audit row no longer names the confirming admin');
  assert.match(body, /initiated_by: params\.initiatedByAdminId/, 'the audit row no longer names the initiator');
});
