/**
 * 🎟 The supplier claim scanner's pure half — `lib/supplier-scan.ts`.
 *
 *   1. the souvenir list is ONE list in three places: the taxonomy, this module, and `public.supplier_scan_is_souvenir`
 *      in the newest migration that defines it — a souvenir leaf added to the taxonomy turns this red;
 *   2. the dropdown offers exactly the BUILT modes, and the newest CHECK on `supplier_scan_settings.mode` accepts exactly
 *      those — a mode the code cannot run can never be saved;
 *   3. "#0042" is the one number format; the answer draws no name unless the action handed one in (the first name, after a recorded claim);
 *   4. NFC: every place says what works there, and only that.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SCAN_MODES,
  SCAN_MODES_BUILT,
  SCANNER_OFF,
  SOUVENIR_SERVICES,
  claimedOfWords,
  nfcLine,
  nfcPlace,
  scanAnswerWords,
  scanNumberLabel,
  scannerChoiceOf,
  scannerChoiceOptions,
  scannerChoiceToSetting,
} from './supplier-scan';
import { TAXONOMY_MAP } from './taxonomy';

const MIGRATIONS = path.join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();

/** The text of the NEWEST migration that matches — the definition prod ends up with. */
function newest(re: RegExp): string {
  for (let i = migrationFiles.length - 1; i >= 0; i--) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, migrationFiles[i]!), 'utf8');
    if (re.test(sql)) return sql;
  }
  throw new Error(`no migration matches ${re}`);
}

test('1 · the souvenir services: the taxonomy, this module and the database say the same list', () => {
  const fromTaxonomy = Object.entries(TAXONOMY_MAP)
    .filter(([, e]) => e.tile === 'souvenir_giveaways')
    .map(([k]) => k);
  assert.ok(fromTaxonomy.length > 0, 'the taxonomy has no souvenir leaves — the tile was renamed?');
  assert.deepEqual([...SOUVENIR_SERVICES].sort(), [...new Set(['souvenir_giveaways', ...fromTaxonomy])].sort());

  const sql = newest(/FUNCTION public\.supplier_scan_is_souvenir/);
  const body = sql.slice(sql.indexOf('FUNCTION public.supplier_scan_is_souvenir'));
  const list = body.slice(body.indexOf('IN ('), body.indexOf(');'));
  const inSql = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...inSql].sort(), [...SOUVENIR_SERVICES].sort());
});

test('2 · the dropdown offers Off + the built modes, and the database accepts exactly those', () => {
  assert.deepEqual(
    scannerChoiceOptions().map((o) => o.key),
    [SCANNER_OFF, ...SCAN_MODES_BUILT],
  );
  for (const m of SCAN_MODES_BUILT) assert.ok(SCAN_MODES.some((x) => x.key === m));
  const sql = newest(/supplier_scan_settings_mode_check CHECK/);
  const check = sql.slice(sql.lastIndexOf('supplier_scan_settings_mode_check CHECK'));
  const inSql = [...check.slice(0, check.indexOf(';')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...inSql].sort(), [...SCAN_MODES_BUILT].sort());

  assert.deepEqual(scannerChoiceToSetting('off', { enabled: true, mode: 'once' }), { enabled: false, mode: 'once' });
  assert.deepEqual(scannerChoiceToSetting('once', null), { enabled: true, mode: 'once' });
  assert.equal(scannerChoiceToSetting('teleport', null), null, 'an unknown choice saves nothing');
  assert.equal(scannerChoiceOf(null), 'off');
  assert.equal(scannerChoiceOf({ enabled: false, mode: 'once' }), 'off');
  assert.equal(scannerChoiceOf({ enabled: true, mode: 'once' }), 'once');
});

test('3 · one number format, and no name unless one was handed in', () => {
  assert.equal(scanNumberLabel(42), '#0042');
  assert.equal(scanNumberLabel(1), '#0001');
  assert.equal(scanNumberLabel(12345), '#12345');
  assert.equal(claimedOfWords(142, 176), '142 of 176');
  assert.equal(claimedOfWords(3, 0), '3', 'never "of 0"');

  const ok = scanAnswerWords({ outcome: 'claimed', number: 42, claimed: 142, total: 176 });
  assert.equal(ok.title, '✓ #0042 · Claimed 142 of 176');
  assert.equal(ok.line, null, 'no name was handed in, so none is shown');
  assert.equal(scanAnswerWords({ outcome: 'already', number: 17 }).title, 'Already claimed · #0017');
  assert.equal(scanAnswerWords({ outcome: 'not_guest' }).title, 'Not a guest of this event');
  assert.match(scanAnswerWords({ outcome: 'no_signal' }).line ?? '', /Nothing was recorded/);
  assert.equal(scanAnswerWords({ outcome: 'claimed', number: 1, claimed: 1, total: 1, name: 'Ana' }).line, 'Ana');
});

test('4 · NFC: each phone is told only what works on it', () => {
  assert.equal(nfcPlace({ nfcSupported: true, isIos: true }), 'reads');
  assert.equal(nfcPlace({ nfcSupported: false, isIos: true }), 'iphone-browser');
  assert.equal(nfcPlace({ nfcSupported: false, isIos: false }), 'none');
  assert.match(nfcLine('iphone-browser'), /iPhone browsers can’t read NFC/);
  assert.match(nfcLine('iphone-browser'), /Setnayan app/);
  assert.doesNotMatch(nfcLine('reads'), /can’t/);
});
