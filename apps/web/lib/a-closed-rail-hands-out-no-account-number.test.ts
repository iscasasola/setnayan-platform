import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChannels, isChannelOpen, openRailDetails } from './payment-channels';
import { PAY_CHANNELS } from './payment-channels';

/**
 * The property: switching a rail OFF must stop every surface handing out that
 * rail's account number — not just checkout.
 *
 * 🔑 WHY IT MATTERS, in the owner's own words (2026-08-01): *"i need a button
 * to turn off the gcash once my gcash hits the limit for that month."* Past a
 * personal GCash wallet's monthly RECEIVING limit, incoming transfers **fail at
 * the bank rather than queue**. A page that still shows the number after the
 * switch is off does not merely look stale — it takes somebody's money into an
 * account that will bounce it, and the first signal is them saying so.
 *
 * Measured 2026-09-18: `hasMerchantPaymentInfo` asked "are any account details
 * filled in?" and two pages printed the number on the strength of it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/* ── THE DECISION, EXECUTED ──────────────────────────────────────────────── */

test('a closed rail is closed however its details are configured', () => {
  // Every combination of details a real settings row can hold. None of them
  // may reopen a rail the owner switched off.
  const details = [
    { gcash_number: '09178807163' },
    { gcash_qr_url: 'https://r2/gcash.png' },
    { gcash_number: '09178807163', gcash_qr_url: 'https://r2/gcash.png' },
  ];
  for (const d of details) {
    assert.equal(
      isChannelOpen({ ...d, gcash_enabled: false }, 'gcash'),
      false,
      `a closed GCash reopened via ${JSON.stringify(d)}`,
    );
  }
});

test('fail-open survives — a null flag still reads as enabled', () => {
  // The direction that matters: guessing wrong here empties checkout of
  // payment options, which is worse than showing one option too many.
  for (const flag of [undefined, null]) {
    assert.equal(
      isChannelOpen({ gcash_enabled: flag, gcash_number: '0917' }, 'gcash'),
      true,
      'a transient/missing flag closed a rail — that takes payments down',
    );
  }
});

/* ── NO SECOND SPELLING OF THE RULE ──────────────────────────────────────── */

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

test('no surface re-spells "is this rail open" with the switch dropped out', () => {
  // `settings.gcash_number || settings.gcash_qr_url` IS `isChannelOpen` with
  // the kill switch missing. It reads as a completeness check and behaves as a
  // permission check, which is why it survived a review: the account number is
  // on screen, so the door looks shut.
  const offenders: string[] = [];
  for (const file of sourceFiles(join(WEB, 'app')).concat(sourceFiles(join(WEB, 'components')))) {
    const src = readFileSync(file, 'utf8');
    for (const [num, qr] of [
      ['gcash_number', 'gcash_qr_url'],
      ['bdo_account_number', 'bdo_qr_url'],
    ] as const) {
      const re = new RegExp(`${num}[^\\n]{0,40}\\|\\|[^\\n]{0,40}${qr}`);
      if (re.test(src)) offenders.push(`${relative(WEB, file)} (${num} || ${qr})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'These render the rail on a completeness check instead of isChannelOpen(), ' +
      'so switching the rail off leaves the account number on screen:\n  ' +
      offenders.join('\n  '),
  );
});

test('the shared helper asks the resolver, not the columns', () => {
  const src = readFileSync(join(WEB, 'lib/platform-settings.ts'), 'utf8');
  const body = src.slice(src.indexOf('export function hasMerchantPaymentInfo'));
  const fn = body.slice(0, body.indexOf('\n}') + 2);
  assert.match(
    fn,
    /openChannels\(/,
    'hasMerchantPaymentInfo stopped delegating to openChannels — it is back to ' +
      'answering "are any details filled in?", which ignores the kill switch',
  );
  assert.doesNotMatch(fn, /_enabled/, 'it re-implemented the switch instead of delegating');
});

test('both rail vocabularies are one vocabulary', () => {
  // A second list of which rails exist is the defect, not a style question:
  // two mechanisms that disagree about one fact each pass their own suite.
  assert.deepEqual([...PAY_CHANNELS], ['gcash', 'bdo']);
  assert.equal(openChannels({}).length, 0);
});

/* ── THE SUPPLIER SURFACES (S2 · 2026-09-18) ─────────────────────────────── */
//
// Measured before this was written: the handoff said "4 supplier surfaces, one
// already done". The real count was 8 pickers that hard-coded BOTH rails
// (including the one called done — its switch was the 3D one, not this one),
// 9 actions that minted an order with no rail check, 2 panels that printed
// both account numbers straight from settings, and the shared /pay page, which
// with both rails off still defaulted to the BDO tab and printed BDO's number.

test('openRailDetails prints nothing for a closed rail, and agrees with openChannels', () => {
  const full = {
    gcash_number: '09178807163',
    gcash_account_name: 'G Name',
    bdo_account_number: '0012 3456 7890',
    bdo_account_name: 'B Name',
  };
  const gOff = openRailDetails({ ...full, gcash_enabled: false });
  assert.equal(gOff.gcashNumber, null, 'a closed GCash still handed out its number');
  assert.equal(gOff.gcashName, null);
  assert.equal(gOff.bdoNumber, '0012 3456 7890', 'closing GCash hid an OPEN BDO');
  assert.deepEqual(gOff.open, ['bdo']);

  const allOff = openRailDetails({ ...full, gcash_enabled: false, bdo_enabled: false });
  assert.deepEqual(
    [allOff.bdoNumber, allOff.gcashNumber, allOff.open.length],
    [null, null, 0],
    'with every rail switched off, a number still reached the page',
  );
  for (const flags of [{}, { gcash_enabled: false }, { bdo_enabled: false }]) {
    assert.deepEqual(openRailDetails({ ...full, ...flags }).open, openChannels({ ...full, ...flags }));
  }
});

const VD = join(WEB, 'app', 'vendor-dashboard');
const rel = (f: string) => relative(WEB, f);

test('every supplier action that mints a payment asks the rail switch first', () => {
  const minting = sourceFiles(VD).filter((f) =>
    /\.from\('payments'\)\s*\.insert\(/.test(readFileSync(f, 'utf8')),
  );
  const offenders: string[] = [];
  for (const f of minting) {
    const src = readFileSync(f, 'utf8');
    if (!/\brailForNewOrder\(/.test(src)) offenders.push(`${rel(f)} (no railForNewOrder)`);
    // A local re-spelling of "which rail" is the switch dropped out again.
    if (/===\s*'gcash'\s*\?\s*'gcash'\s*:\s*'bdo'/.test(src) || /function parseChannel\b/.test(src)) {
      offenders.push(`${rel(f)} (re-spells the channel instead of resolving it)`);
    }
  }
  console.log(`# supplier actions that mint a payment: ${minting.length}`);
  assert.deepEqual(offenders, [], 'These mint an order a closed rail cannot receive:\n  ' + offenders.join('\n  '));
  // Floor, not a ceiling: an empty sweep (moved folder, broken regex) must not
  // read as "nothing to check". Raise it when a new paid action lands.
  assert.ok(minting.length >= 9, `only ${minting.length} minting actions found — the sweep went blind`);
});

test('every supplier "Pay with" choice offers only the open rails', () => {
  const pickers = sourceFiles(VD).filter((f) => readFileSync(f, 'utf8').includes('name="channel"'));
  const offenders: string[] = [];
  for (const f of pickers) {
    const src = readFileSync(f, 'utf8');
    if (/value="(bdo|gcash)"/.test(src)) offenders.push(`${rel(f)} (hard-codes a rail)`);
    if (!/\b(openRails|pay\.open)\.includes\(/.test(src)) offenders.push(`${rel(f)} (never asks which rails are open)`);
    if (!/<PaymentsPausedNote\b/.test(src)) offenders.push(`${rel(f)} (says nothing when every rail is closed)`);
  }
  console.log(`# supplier pay pickers: ${pickers.length}`);
  assert.deepEqual(offenders, [], 'These offer a rail the owner switched off:\n  ' + offenders.join('\n  '));
  assert.ok(pickers.length >= 8, `only ${pickers.length} pickers found — the sweep went blind`);
});

test('no page copies an account number out of settings without the switch', () => {
  const offenders: string[] = [];
  for (const f of sourceFiles(join(WEB, 'app')).concat(sourceFiles(join(WEB, 'components')))) {
    const src = readFileSync(f, 'utf8');
    if (/(bdo|gcash)Number:\s*settings\??\./.test(src)) offenders.push(rel(f));
  }
  assert.deepEqual(
    offenders,
    [],
    'These copy a number into props straight from settings — use openRailDetails():\n  ' +
      offenders.join('\n  '),
  );
});

test('/pay asks the one rule, and hands out nothing when every rail is closed', () => {
  const page = readFileSync(join(WEB, 'app/pay/[reference]/page.tsx'), 'utf8');
  assert.doesNotMatch(page, /_enabled\s*!==\s*false/, '/pay reads the flag alone again');
  const asks = page.match(/isChannelOpen\(settings, '(gcash|bdo)'\)/g) ?? [];
  assert.equal(asks.length, 2, `expected both rails asked through isChannelOpen, found ${asks.length}`);

  const panel = readFileSync(join(WEB, 'app/pay/[reference]/_components/pay-panel.tsx'), 'utf8');
  const gate = panel.indexOf('!gcash.enabled && !bdo.enabled ? (');
  assert.ok(gate > -1, 'the all-closed branch is gone — BDO becomes the fallback tab and prints its number');
  const paused = panel.indexOf('{PAYMENTS_PAUSED_MESSAGE}', gate);
  const qr = panel.indexOf('<QrTile', gate);
  const manual = panel.indexOf('or send manually to', gate);
  // The paused message is the TRUE arm; the QR and the number sit in the else.
  assert.ok(paused > gate && paused < qr && qr < manual, 'the QR or the number escaped the all-closed branch');
});
