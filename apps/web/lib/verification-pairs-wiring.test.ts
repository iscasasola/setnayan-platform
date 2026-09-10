import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { PAIR_COLUMNS, VERIFICATION_PAIRS } from './verification-pairs';
import { LOCKED_IDENTITY_FIELD_KEYS } from './vendor-corrections';

/**
 * WIRING GUARDS — the model is right, but is the SCREEN reading it?
 *
 * These are source guards on purpose: the pairs are a React tree and the
 * failures worth catching are structural, not behavioural. Each one is
 * mutation-checked (break the guarded thing → the count moves → red).
 *
 * 🔑 The guard that matters most is the LAST one. Until 2026-09-09 the
 * Get-verified section RETURNED its badge card and nothing else the moment a
 * shop was verified — and BOTH production shops are verified with no papers on
 * file. Re-adding that early return would take the entire feature away from
 * exactly the two shops it exists for, silently, with every other test green.
 */

const WEB = join(new URL('.', import.meta.url).pathname, '..');
const ACTIONS = join(WEB, 'app', 'vendor-dashboard', 'shop', 'inline-docs-actions.ts');
const DOCS_BODY = join(WEB, 'app', 'vendor-dashboard', 'shop', '_components', 'docs-body.tsx');
const PAIRS = join(WEB, 'app', 'vendor-dashboard', 'shop', '_components', 'verify-pairs.tsx');
const SECTION = join(WEB, 'app', 'vendor-dashboard', 'shop', '_components', 'verify-section.tsx');

function read(path: string): string {
  const src = readFileSync(path, 'utf8');
  assert.ok(src.length > 400, `${path} is empty or missing`);
  return src;
}

test('the identity read names every column the pairs type — a missing one reads as never typed', () => {
  const src = read(ACTIONS);
  const m = /\.select\(\s*\n?\s*'([^']*registered_business_name[^']*)'/.exec(src);
  assert.ok(m, 'the identity select literal is gone');
  const named = m[1]!.split(',').map((s) => s.trim());
  for (const col of PAIR_COLUMNS) {
    assert.ok(named.includes(col), `the identity select does not read ${col}`);
  }
  assert.equal(named.length, PAIR_COLUMNS.length, 'the identity read grew a column nothing asked for');
});

test('"is this shop verified?" has ONE source — the page read, threaded down', () => {
  // A soft probe inside the lazy payload would degrade to false and draw a box
  // on a verified shop whose save the server then refuses.
  const actions = stripComments(read(ACTIONS));
  assert.ok(
    !/isVerified/.test(actions),
    'the lazy payload grew its own verified probe — thread the page prop instead',
  );
  for (const f of [SECTION, DOCS_BODY, PAIRS]) {
    assert.match(stripComments(read(f)), /isVerified/, 'the verified prop is not threaded');
  }
  assert.ok(
    !/payload\.isVerified/.test(stripComments(read(PAIRS))),
    'verify-pairs reads verified off the payload again',
  );
});

test('every column the pairs type has a writer, and the number keeps its ONE writer', () => {
  const src = stripComments(read(ACTIONS));
  assert.match(src, /export async function saveVerificationIdentityField/);
  // The anti-farm uniqueness claim must not be duplicated.
  assert.equal(
    (src.match(/registration_number_normalized/g) ?? []).length,
    2,
    'the uniqueness claim has gained (or lost) a writer — it lives in saveRegistrationNumberInline only',
  );
  // …and that one writer is deliberately excluded from the generic field save.
  assert.match(src, /IDENTITY_FIELD_WRITABLE[\s\S]{0,160}registration_number_raw/);
});

test('the screen renders the pairs, and the standalone registration-number box is GONE', () => {
  const body = stripComments(read(DOCS_BODY));
  assert.match(body, /<VerifyPairs\b/, 'docs-body no longer renders the pairs');
  assert.ok(
    !/Government registration number/.test(body),
    'the standalone registration-number box is back — two boxes for one number',
  );
  // Exactly one place in the vendor tree carries that input now.
  const pairs = read(PAIRS);
  assert.equal(
    (pairs.match(/name="registration_number"/g) ?? []).length,
    1,
    'the registration-number input is duplicated or gone',
  );
  // The optional slots are DERIVED, never hand-listed.
  assert.match(body, /VENDOR_DOC_SLOTS\.filter\(\(s\) => !PAIR_SLOT_KEYS\.has\(s\.key\)\)/);
});

test('a locked column is never drawn as a box the server would refuse', () => {
  const src = read(PAIRS);
  const start = src.indexOf('function LockedLine(');
  assert.ok(start > 0, 'LockedLine is gone — a locked column would fall through to an input');
  const body = src.slice(start);
  assert.ok(!/<input\b/.test(body), 'LockedLine draws an input');
  assert.ok(!/<textarea\b/.test(body), 'LockedLine draws a textarea');
  // And the fork is decided by the shared helper, not by a hand-written list.
  const stripped = stripComments(src);
  assert.match(stripped, /pairFieldLockedKey\(/);
  for (const key of LOCKED_IDENTITY_FIELD_KEYS) {
    if (key === 'business_owner_name' || key === 'location_city') continue;
    assert.ok(
      !new RegExp(`'${key}'`).test(stripped),
      `verify-pairs hand-names the locked field ${key} — derive it from LOCKED_IDENTITY_FIELD_KEYS`,
    );
  }
});

test('the faint labels clear AA — the drawing made this exact correction', () => {
  // Stripped: the docblock EXPLAINING why we avoid the faint token names it,
  // and a raw-source count reports the defect it just fixed.
  const src = stripComments(read(PAIRS));
  // --m-slate-3 is #8A857B → 3.67:1 on this page's white. The port uses
  // #6E6A62 (5.38:1) for every small label and status line.
  assert.equal(
    (src.match(/--m-slate-3/g) ?? []).length,
    0,
    'a faint label fell back to the page token that measures 3.67:1',
  );
  assert.ok((src.match(/#6E6A62/g) ?? []).length >= 6, 'the AA-clearing grey is not being used');
});

test('A VERIFIED SHOP CAN STILL REACH ITS PAPERS — no early return may come back', () => {
  const src = stripComments(read(SECTION));
  assert.ok(
    !/if\s*\(\s*isVerified\s*\)\s*\{\s*\n?\s*return/.test(src),
    'the section returns early for a verified shop again — both production shops are verified, so this hides the whole feature from every real shop',
  );
  // The badge card survives, as a branch rather than a return.
  assert.match(src, /\{isVerified \? \(/);
  // …and the documents step opens for them.
  assert.match(src, /isVerified \|\| profileComplete/);
});

test('the pairs cover exactly the four papers the submit gate requires', () => {
  const src = stripComments(read(PAIRS));
  for (const pair of VERIFICATION_PAIRS) {
    assert.ok(
      src.includes('VERIFICATION_PAIRS'),
      'verify-pairs stopped reading the model and hand-lists papers',
    );
    assert.ok(pair.slotKey.length > 0);
  }
  // No paper may be hand-named in the screen — the list is the model's.
  for (const slot of ['bir_2303', 'mayors_permit', 'bank_account_proof']) {
    assert.ok(!new RegExp(`'${slot}'`).test(src), `verify-pairs hand-names ${slot}`);
  }
});
