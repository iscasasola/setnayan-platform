/**
 * The token economy is retired (owner 2026-07-21 · completed 2026-08-07 ·
 * its last visible stump removed 2026-08-18).
 *
 * 🔑 WHY THIS GUARD EXISTS, AND WHAT IT IS REALLY ABOUT.
 * The 2026-08-07 retirement removed the option to CREATE a token voucher and
 * deleted the vendor's token counter. It did NOT remove the screen that EDITS
 * one, or the parser that accepts one. Production held exactly one voucher and
 * it was that type — so the retired wallet was the only thing that screen could
 * ever show, and the owner met it and asked why.
 *
 * **A REMOVED CREATE-OPTION ONLY STOPS NEW ROWS. The existing row is what
 * renders.** Retiring a thing means retiring its editor and its parser too.
 * This is the FIFTH time a retired feature has resurfaced through a surface
 * nobody thought of as part of it.
 *
 * ⚠ SCOPE, deliberately narrow. This does NOT ban the word "token" — the app
 * is full of legitimate ones (CSRF, invite, QR, session, push, OAuth). It bans
 * exactly the retired VENDOR CURRENCY reaching an admin or vendor screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB = join(import.meta.dirname, '..');

function sources(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const VOUCHER_DIR = join(WEB, 'app/admin/discount-codes');

test('the voucher screens carry no live reference to the retired currency', () => {
  const files = sources(VOUCHER_DIR);
  assert.ok(files.length >= 4, `scanned only ${files.length} voucher files — the path is wrong`);

  const offenders: string[] = [];
  for (const f of files) {
    // Strip comments: every remaining mention is a deliberate note explaining
    // the retirement, and a guard that fires on its own explanation is noise.
    const code = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    // ⚖ WHAT THIS BANS IS A TOKEN VALUE BEING WRITTEN — not the identifier.
    //
    // 🪤 A LOOKAHEAD DID NOT WORK AND ITS GREEN MEANT NOTHING. The first cut
    // was /token_grant_count\s*:\s*(?!null)/ — and it matched
    // `token_grant_count: null` anyway, because `\s*` can match ZERO
    // characters, leaving the lookahead staring at the SPACE before `null`.
    // A space is not "null", so the negative lookahead passed. It reported
    // every correct line as an offender.
    // 🔑 WHEN A PATTERN MUST JUDGE A VALUE, EXTRACT THE VALUE AND COMPARE IT.
    // Do not ask a regex to assert a negative across optional whitespace.
    //
    // Three shapes are legitimate; anything else is a write of a live token
    // value and fails:
    //   • `: number | null;`  the type on the row shape
    //   • `: null`            every write path — the columns remain on the
    //     table and in its CHECK, and an OMITTED column keeps its old value on
    //     an UPDATE, so nulling explicitly is the safer shape, not laziness
    //   • `: prior.token_…`   the audit trail's BEFORE snapshot. An audit that
    //     cannot record what a value WAS is not an audit.
    for (const m of code.matchAll(/\btoken_grant_(?:count|ttl_days)\b\s*:\s*([^,;\n]+)/g)) {
      const value = (m[1] ?? '').trim();
      const allowed =
        value === 'null' ||
        value === 'number | null' ||
        /^prior\.token_grant_(?:count|ttl_days)$/.test(value);
      if (!allowed) offenders.push(`${relative(WEB, f)} — writes a token value: ${value}`);
    }
    for (const re of [/'grant_tokens'/, /showTokenInputs/]) {
      if (re.test(code)) offenders.push(`${relative(WEB, f)} — ${re}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'The retired vendor token currency is reachable from the voucher screens again:\n' +
      offenders.join('\n') +
      '\n\nRetiring a thing means retiring its EDITOR and its PARSER, not only its create-option.',
  );
});

test('the editor REFUSES a retired-type voucher rather than coercing it', () => {
  // Coercing an unknown type into a known one would silently change what a
  // money-adjacent object DOES. The refusal is the feature.
  const src = readFileSync(join(VOUCHER_DIR, '[id]/edit/page.tsx'), 'utf8');
  assert.match(
    src,
    /if \(!\[['"]pct_off['"], ?['"]pct_off_capped['"], ?['"]free['"]\]\.includes\(code\.discount_type\)\) \{\s*notFound\(\);/,
    'the edit page must refuse a voucher whose type the form cannot represent',
  );
});

test('no vendor-facing screen shows a token balance', () => {
  // The vendor's sidebar token pill was deleted 2026-08-07. Nothing may
  // reintroduce a balance the vendor can neither earn nor spend.
  const files = sources(join(WEB, 'app/vendor-dashboard'));
  assert.ok(files.length >= 20, `scanned only ${files.length} vendor files — the path is wrong`);
  const offenders = files.filter((f) => {
    const code = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    return /\bvendor_wallets\b|\bpurchased_tokens\b|\bearned_tokens\b|\btoken_balance\b/.test(code);
  });
  assert.deepEqual(
    offenders.map((f) => relative(WEB, f)),
    [],
    'a vendor screen reads a token wallet — the currency is retired and cannot be earned or spent',
  );
});
