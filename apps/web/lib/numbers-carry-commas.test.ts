/**
 * numbers-carry-commas.test.ts — EVERY NUMBER A PERSON READS CARRIES ITS
 * THOUSANDS COMMAS.
 *
 * Owner, 2026-09-27 (DECISION_LOG "EVERY NUMBER ON THE WEBSITE CARRIES
 * THOUSANDS COMMAS"), on the event Overview's Papic tile reading
 * **"100050 shots ready"**: *"numbers with comma"* · *"all across the website.
 * all needs to have a ','"*.
 *
 * ── What this holds, as PROPERTIES (none of it greps for a formatter's name) ─
 *   T1  `formatCount` is EXECUTED: 100050 → "100,050", and it never prints a
 *       peso sign (money stays in lib/php.ts — one money formatter, not two).
 *   T2  the shared animated numeral `CountUp` is RENDERED server-side and its
 *       markup must read "100,050" — the Papic tile's exact failure. Money
 *       passes `format={formatPhp}` and renders "₱12,500".
 *   T3  the detector (`lib/raw-number-scan.ts`) is RUN over fixtures: it must
 *       catch each raw shape and pass each formatted / non-display one.
 *   T4  the repo sweep: every raw quantity render in app/ lib/ components/ is
 *       either formatted or has a reasoned row in
 *       `numbers-carry-commas.allowlist.txt`; a stale row fails too.
 *   T5  the walk is not vacuous.
 *
 * SABOTAGE, each seen red before this shipped:
 *   T2  put `{display}` back in app/_components/count-up.tsx
 *   T4  put `{r.live_pax ?? '—'}` back in app/admin/pax-changes/page.tsx
 *       (name signal) and `{DOC_SLOTS.length} items complete` in
 *       app/admin/verify/page.tsx (noun signal) — both named in the failure;
 *       and `₱{minPhp}` back in app/admin/pricing/_components/booking-fee-form.tsx
 *       (money signal)
 *   T4  delete a live allowlist row (its finding reappears); a row that matches
 *       nothing fails as stale (seen when a scanner fix retired one)
 *   T5  point the walk at `types/` (2 files)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatCount } from './format-number';
import { formatPhp } from './php';
import { parseAllowlist, scanRawNumbers, type RawNumberFinding } from './raw-number-scan';
import { collectSourceFiles, APP_ROOT } from './security/shadowed-export-scan';

// The component file uses the automatic JSX runtime; under tsx it needs `React` in scope.
(globalThis as unknown as { React: unknown }).React = React;
const { CountUp } = require('../app/_components/count-up') as typeof import('../app/_components/count-up');

/** The directories whose files render what a person reads. */
const SCANNED_DIRS = ['app', 'lib', 'components'];
/** Minimum files the walk must reach, or the sweep proves nothing. */
const MIN_FILES_SCANNED = 3000;
const ALLOWLIST = path.join(APP_ROOT, 'lib', 'numbers-carry-commas.allowlist.txt');

/* ═══ T1 · THE FORMATTER, EXECUTED ═════════════════════════════════════════ */

test('T1 · formatCount groups with commas, keeps fractions unpadded, never prints ₱', () => {
  assert.equal(formatCount(100050), '100,050'); // the Papic tile
  assert.equal(formatCount(1_234_567), '1,234,567');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(-2500), '-2,500');
  assert.equal(formatCount(1234.5), '1,234.5');
  assert.equal(formatCount(2), '2', 'a whole count never grows ".00"');
  assert.equal(formatCount(1536.25, 1), '1,536.3');
  assert.equal(formatCount(12.345, 0), '12');
  for (const absent of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(formatCount(absent as number | null | undefined), '—');
  }
  assert.ok(!formatCount(12500).includes('₱'), 'money belongs to lib/php.ts');
});

/* ═══ T2 · COUNTUP, RENDERED ═══════════════════════════════════════════════ */

test('T2 · CountUp renders the grouped value — "100,050 shots ready", never "100050"', () => {
  const html = renderToStaticMarkup(React.createElement(CountUp, { value: 100050 }));
  assert.match(html, /100,050/);
  assert.doesNotMatch(html, /100050/, 'the raw figure the owner saw on the Papic tile');

  const pct = renderToStaticMarkup(React.createElement(CountUp, { value: 1250, suffix: '%' }));
  assert.match(pct, /1,250%/);

  const money = renderToStaticMarkup(
    React.createElement(CountUp, { value: 12500, format: formatPhp }),
  );
  assert.match(money, /₱12,500/, 'money goes through the one money formatter');
});

/* ═══ T3 · THE DETECTOR, RUN ═══════════════════════════════════════════════ */

function exprs(src: string, file = 'fixture.tsx'): string[] {
  return scanRawNumbers(file, src).map((f) => f.expr);
}

test('T3a · the detector catches every raw shape', () => {
  const cases: [string, string][] = [
    ['const A = () => <b>{shotsLeft}</b>;', 'shotsLeft'], // name
    ['const A = () => <b>{stats.total}</b>;', 'stats.total'],
    ['const A = () => <p>{n} guests</p>;', 'n'], // noun, whatever it is called
    ["const A = () => <p><strong>{n}</strong>{' '}guests</p>;", 'n'], // noun after the element
    ['const A = () => <p>{guests.length}</p>;', 'guests.length'],
    ['const A = () => <p>{done} of {total}</p>;', 'done'], // either side of "of"
    ['const A = () => <p>{String(credits)}</p>;', 'String(credits)'],
    ['const A = () => <p>{(bytes / 1024).toFixed(1)} KB</p>;', '(bytes / 1024).toFixed(1)'],
    ['const A = () => <p>{creditsLeft ?? 0}</p>;', 'creditsLeft'],
    ['const A = () => <p>{ok ? photoCount : "—"}</p>;', 'photoCount'],
    ['const A = () => <p>{total - used} left</p>;', 'total - used'],
    ['const s = `${k} photos in the gallery`;', 'k'],
    ['const A = () => <p aria-label={`${guestCount} guests`} />;', 'guestCount'],
    ['export function line(n: number) { return `Added ${n} guests.`; }', 'n'],
    ['const s = `5% of booking fee ₱${feePhp}`;', 'feePhp'], // money, hand-spelled
    ['const A = () => <b>₱{minPhp}</b>;', 'minPhp'],
  ];
  for (const [src, want] of cases) {
    assert.ok(exprs(src).includes(want), `missed ${want} in: ${src} → ${JSON.stringify(exprs(src))}`);
  }
});

test('T3b · the detector passes formatted, textual and non-display numbers', () => {
  const clean = [
    'const A = () => <b>{formatCount(shotsLeft)}</b>;',
    "const A = () => <b>{count.toLocaleString('en-PH')}</b>;",
    'const A = () => <b>{formatPhp(amount)}</b>;',
    "const count = points.toLocaleString('en-PH'); const A = () => <b>{count}</b>;", // bound to text
    'const A = () => <b>{hasPhotos}</b>;', // a flag
    'const A = () => <b>{countLabel}</b>;', // a label
    'const A = () => <b>{discountReason}</b>;', // "count" inside a word
    'const A = () => <li key={`${count}`} />;',
    'const A = () => <a href={`/p/${photoCount}`} />;',
    'const A = () => <div style={{ width: `${total}px` }} />;',
    'console.log(`${count} rows`);',
    "throw new Error(`${count} bad`);",
    "const A = () => <p>{label} guests</p>;", // a string before a noun
    'export function sheetAspect(h: number) { return `${WIDTH} / ${h}`; }', // CSS aspect-ratio
    'const A = () => <T rowKey={(r) => `${r.id}|${r.total}`} />;',
    'const k = (n: number) => `₱${Math.round(n / 1000)}K`;', // a compact label is < 1,000
  ];
  for (const src of clean) {
    assert.deepEqual(exprs(src), [], `false positive in: ${src}`);
  }
});

/* ═══ T4 · THE REPO SWEEP ══════════════════════════════════════════════════ */

type Located = RawNumberFinding & { file: string };

function sweep(): { files: number; findings: Located[] } {
  const files = SCANNED_DIRS.flatMap((d) => collectSourceFiles(path.join(APP_ROOT, d)));
  const findings: Located[] = [];
  for (const abs of files) {
    const rel = path.relative(APP_ROOT, abs).split(path.sep).join('/');
    // The detector's own module and this suite quote raw shapes on purpose.
    if (rel === 'lib/raw-number-scan.ts') continue;
    for (const f of scanRawNumbers(abs, fs.readFileSync(abs, 'utf8'))) {
      findings.push({ ...f, file: rel });
    }
  }
  return { files: files.length, findings };
}

const SWEEP = sweep();

test('T4 · every raw quantity render is formatted or on the reasoned allowlist — and no row is stale', () => {
  const rows = parseAllowlist(fs.readFileSync(ALLOWLIST, 'utf8'));
  for (const r of rows) {
    assert.match(r.reason, /^(TEXT|IDENTIFIER|BOUNDED) — .{20,}/, `allowlist row needs a TEXT/IDENTIFIER/BOUNDED reason: ${r.path} :: ${r.expr}`);
  }
  // Each row consumes exactly ONE finding.
  const remaining = [...rows];
  const unexplained: Located[] = [];
  for (const f of SWEEP.findings) {
    const i = remaining.findIndex((r) => r.path === f.file && r.expr === f.expr);
    if (i >= 0) remaining.splice(i, 1);
    else unexplained.push(f);
  }
  assert.deepEqual(
    unexplained.map((f) => `${f.file}:${f.line} [${f.where}/${f.signal}] ${f.expr}`),
    [],
    'A number a person reads is printed without its commas. Route it through ' +
      '`formatCount` (lib/format-number.ts) — or, for money, `formatPhp` / ' +
      '`formatCentavosPhp` (lib/php.ts). Only if it is TEXT, an IDENTIFIER or BOUNDED, add ' +
      'one reasoned row to lib/numbers-carry-commas.allowlist.txt.',
  );
  assert.deepEqual(
    remaining.map((r) => `${r.path} :: ${r.expr}`),
    [],
    'these allowlist rows no longer match anything — delete them',
  );
});

/* ═══ T5 · THE WALK IS NOT VACUOUS ═════════════════════════════════════════ */

test('T5 · the sweep reaches the tree (a guard over zero files guards nothing)', () => {
  assert.ok(SWEEP.files >= MIN_FILES_SCANNED, `walk reached only ${SWEEP.files} files`);
  // The allowlist's own rows are findings the walk must still be producing.
  assert.ok(SWEEP.findings.length > 0, 'the detector found nothing at all — it is not running');
});
