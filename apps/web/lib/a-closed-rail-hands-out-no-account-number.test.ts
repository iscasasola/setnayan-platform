import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChannels, isChannelOpen } from './payment-channels';
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
