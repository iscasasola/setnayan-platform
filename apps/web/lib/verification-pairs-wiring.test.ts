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
// The papers-beside-the-fields pairs were RETIRED by the owner-approved design v10 (2026-11-14, "ONE UPLOAD
// PLACE — THE APP TELLS WHICH PAPER IT IS"); the guards below that read them now hold the upload place.
const PLACE = join(WEB, 'app', 'vendor-dashboard', 'shop', '_components', 'paper-upload-place.tsx');
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
  for (const f of [SECTION, DOCS_BODY, PLACE]) {
    assert.match(stripComments(read(f)), /isVerified/, 'the verified prop is not threaded');
  }
  assert.ok(
    !/payload\.isVerified/.test(stripComments(read(PLACE))),
    'the upload place reads verified off the payload again',
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

test('the screen renders the ONE upload place (design v10), and the standalone registration-number box is GONE', () => {
  const body = stripComments(read(DOCS_BODY));
  // Owner 2026-11-14 ("ONE UPLOAD PLACE — THE APP TELLS WHICH PAPER IT IS", design v10 approved):
  // the papers-beside-the-fields pairs gave way to one upload place that fills what it read in READ-ONLY.
  assert.match(body, /<PaperUploadPlace\b/, 'docs-body no longer renders the upload place');
  assert.ok(!/<VerifyPairs\b/.test(body), 'the retired pairs are drawn again beside the upload place');
  assert.ok(
    !/Government registration number/.test(body),
    'the standalone registration-number box is back — two boxes for one number',
  );
  // The number is READ off the paper now (design v10): the upload place carries no number box at all.
  assert.ok(
    !/name="registration_number"/.test(read(PLACE)),
    'a typed registration-number box is back on the upload place — the number comes off the paper',
  );
  // The optional slots are DERIVED, never hand-listed.
  assert.match(body, /VENDOR_DOC_SLOTS\.filter\(\(s\) => !PAIR_SLOT_KEYS\.has\(s\.key\)\)/);
});

test('what was read is shown READ-ONLY — the only typed box is the form after the third try', () => {
  // Design v10: "If any of it is wrong, the fix is a clearer copy, never typing over it."
  const src = stripComments(read(PLACE));
  const lines = src.slice(src.indexOf('readLines(row.slot, model)'), src.indexOf('Something wrong? Upload a clearer copy'));
  assert.ok(lines.length > 0, 'the read values are no longer drawn');
  assert.ok(!/<input\b|<TypedRow\b|<textarea\b/.test(lines), 'a read value is drawn as a box the supplier can type over');
  const typedForm = src.slice(src.indexOf('function TypedForm('));
  assert.equal((src.match(/<TypedRow\b/g) ?? []).length, 1, 'a typed box appeared outside the third-try form');
  assert.match(typedForm, /<TypedRow\b/);
  assert.match(src, /s\?\.r2_key && s\.manual \? \(\s*<TypedForm/, 'the typed form opens on a paper that is not manual');
});

test('the faint labels clear AA — the drawing made this exact correction', () => {
  // Stripped: the docblock EXPLAINING why we avoid the faint token names it,
  // and a raw-source count reports the defect it just fixed.
  const src = stripComments(read(PLACE));
  // --m-slate-3 is #8A857B → 3.67:1 on this page's white. The upload place uses
  // #6E6A62 (5.38:1) for every small label and status line, through ONE constant.
  assert.equal(
    (src.match(/--m-slate-3/g) ?? []).length,
    0,
    'a faint label fell back to the page token that measures 3.67:1',
  );
  // --m-slate-2 is #6E6A62 (globals.css) — a token, never a raw hex (lib/every-back-goes-home.test.ts).
  assert.match(src, /const MUTE = 'var\(--m-slate-2\)';/, 'the AA-clearing grey is not the label colour');
  assert.ok((src.match(/\bMUTE\b/g) ?? []).length >= 6, 'the AA-clearing grey is not being used');
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

test('the upload place covers exactly the three papers (bank proof dropped), in the model’s slots', () => {
  const src = stripComments(read(PLACE));
  for (const slot of ['dti_certificate', 'bir_2303', 'mayors_permit']) {
    assert.match(src, new RegExp(`slot: '${slot}'`), `the upload place lost ${slot}`);
    assert.ok(VERIFICATION_PAIRS.some((p) => p.slotKey === slot), `${slot} is not a slot the model knows`);
  }
  assert.ok(!/bank_account_proof/.test(src), 'the bank proof is back on the upload place');
});
