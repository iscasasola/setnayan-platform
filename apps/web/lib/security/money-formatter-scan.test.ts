/**
 * money-formatter-scan.test.ts — TWO EXPORTED MONEY HELPERS MAY NOT SHARE A
 * NAME, and one that drops the centavos must say why.
 *
 * ── The bug class ──────────────────────────────────────────────────────────
 * PR #5744: a real booking fee of ₱837.50 printed as ₱838 on the screen whose
 * only job is to name the figure to type into GCash. PR #5756: three places
 * rounded money BEFORE STORING IT, and named the cause — `centavosToPhp`
 * existed twice, once as `Math.round(centavos / 100)` and once correctly, and
 * `centavosToPhp(x)` reads identically either way. The sweep on 2026-09-20
 * found `formatPhp` defined FOUR times in two behaviours and
 * `formatCentavosPhp` THREE times in two behaviours.
 *
 * 🔑 A COLLISION IS NOT A DUPLICATE — IT IS A FORK NOBODY CAN SEE IN A DIFF.
 * Both definitions compile, both are correct for something, and the import line
 * that decides between them is nowhere near the call.
 *
 * ── How this suite is shaped (house style: shadowed-export-scan.test.ts) ────
 *  · What must hold regardless of repo state lives here: the two formatters
 *    are EXECUTED on a centavo-bearing amount (T1–T3), the detector finds the
 *    shape (T4–T7), and the scan is not silently empty (T10).
 *  · The repo-wide ratchet is the committed `money-formatter.baseline.txt`
 *    (T8–T9) — a diff a reviewer can read, not a constant they cannot.
 *  · T6 is a POSITIVE CONTROL TAKEN FROM HISTORY: the two `formatPhp` bodies
 *    exactly as `lib/orders.ts` and `lib/budget.ts` carried them. If the
 *    detector ever stops calling that pair a collision, it has stopped working.
 *
 * SABOTAGE, per rule (each proven to go red before this shipped):
 *   T1  change `₱${grouped}${centavos === '00' …}` to `maximumFractionDigits: 0`
 *   T3  give `formatCentavosPhp` back `Math.round(n / 100)`
 *   T6  point the detector at names instead of bodies
 *   T8  re-add `export function formatPhp` to `lib/budget.ts`
 *   T9  delete `@rounds-to-the-peso` from `formatPhpRounded`'s docblock
 *   T10 break the walk (it then guards zero files)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPhp, formatCentavosPhp, formatPhpRounded } from '../php';
import {
  baselineKeys,
  docblockAbove,
  dropsFraction,
  extractMoneyHelpers,
  readMoneyBaseline,
  rounderKey,
  scanMoneyFormatters,
  ROUNDING_MARKER,
} from './money-formatter-scan';

/** Minimum files the walk must reach, or every repo-wide assertion is vacuous. */
const MIN_FILES_SCANNED = 2000;
/** Minimum money helpers the detector must find, for the same reason. */
const MIN_HELPERS = 15;

/** The owner's own row, to the centavo (PR #5744). */
const CHARGE_CENTAVOS = 83_750;
const CHARGE_PHP = CHARGE_CENTAVOS / 100; // 837.5

/* ═══ 1–3 · THE FORMATTERS, EXECUTED ════════════════════════════════════════ */

test('T1 · formatPhp keeps the centavos, and spells them as TWO digits', () => {
  assert.equal(formatPhp(CHARGE_PHP), '₱837.50');
  assert.equal(formatPhp(837.05), '₱837.05');
  assert.equal(formatPhp(0.5), '₱0.50');
  assert.equal(formatPhp(1_234_567.89), '₱1,234,567.89');
  // ₱837.5 is a THIRD spelling of this number and is what four of the app's
  // formatters produced. One trailing zero is the whole point.
  assert.ok(!formatPhp(CHARGE_PHP).endsWith('.5'), 'the trailing zero was dropped');
  // Whole pesos carry no decimal point at all.
  assert.equal(formatPhp(2499), '₱2,499');
  assert.equal(formatPhp(0), '₱0');
  // ⚠ MEASURED, NOT ASSUMED: the ₱ comes FIRST and the minus sits inside it.
  // `₱-1,500.50`, not `-₱1,500.50` — the sign rides with the grouped whole part.
  assert.equal(formatPhp(-1500.5), '₱-1,500.50');
  for (const absent of [null, undefined, Number.NaN]) {
    assert.equal(formatPhp(absent as number | null | undefined), '—');
  }
});

test('T2 · formatPhpRounded rounds — and is BYTE-IDENTICAL on a whole peso', () => {
  // ⚖ THIS IS THE PROPERTY THAT MADE THE SWEEP SAFE. Re-pointing ~40 call
  // sites at the exact formatter cannot change what a whole-peso row displays;
  // it can only stop a centavo-bearing row being misreported. If these two ever
  // disagree on a whole number, that reasoning is void.
  for (const whole of [0, 50, 2499, 125_000, 1_234_567]) {
    assert.equal(formatPhpRounded(whole), formatPhp(whole), `disagreed on ₱${whole}`);
  }
  assert.equal(formatPhpRounded(CHARGE_PHP), '₱838');
  assert.notEqual(formatPhpRounded(CHARGE_PHP), formatPhp(CHARGE_PHP));
  assert.equal(formatPhpRounded(null), '—');
});

test('T3 · formatCentavosPhp is formatPhp of the divided figure — one centavo is ₱0.01', () => {
  assert.equal(formatCentavosPhp(CHARGE_CENTAVOS), '₱837.50');
  // `Math.round(centavos / 100)` — the shape two modules shipped — makes this ₱1.
  assert.equal(formatCentavosPhp(1), '₱0.01');
  assert.equal(formatCentavosPhp(12_500_000), '₱125,000');
  assert.equal(formatCentavosPhp(350_000), '₱3,500');
  assert.equal(formatCentavosPhp(null), '—');
  // Structural agreement, not two formatters that happen to concur.
  for (const c of [0, 1, 4999, CHARGE_CENTAVOS, 187_501_030]) {
    assert.equal(formatCentavosPhp(c), formatPhp(c / 100), `disagreed at ${c}c`);
  }
});

/* ═══ 4–7 · THE DETECTOR ════════════════════════════════════════════════════ */

test('T3b · the centavo-safe roundings are NOT called rounders', () => {
  // ⚖ THE ONE DISTINCTION THE WHOLE RULE TURNS ON. `lib/payouts.ts` had both
  // of these and neither loses a centavo; `Math.round(centavos / 100)` — one
  // pair of parentheses away from the second — is the bug #5756 traced.
  assert.equal(dropsFraction('return Math.round(php * 100);'), false, 'rounding centavos is exact');
  assert.equal(dropsFraction('return Math.round(centavos) / 100;'), false, 'round-then-divide is exact');
  assert.equal(dropsFraction('return Math.round(Number(php) * 100);'), false, 'nested parens must not defeat it');
  assert.equal(dropsFraction('return Math.round(centavos / 100);'), true, 'THE BUG');
  assert.equal(dropsFraction('return Math.floor(centavos / 100);'), true);
  assert.equal(dropsFraction("x.toLocaleString('en-PH', { maximumFractionDigits: 0 })"), true);
  assert.equal(dropsFraction('return n.toFixed(0);'), true);
  assert.equal(dropsFraction('return n.toFixed(2);'), false);
});

test('T4 · a formatter is found by its RETURN, not by its name', () => {
  const src = `
    export function renderAmount(n: number) { return \`₱\${n}\`; }
    export function formatPhp(n: number) { return n + 1; }
    export function saveThing(n: number) {
      if (n > 10) return 'Fee must be under ₱10,000';
      return 'ok';
    }
  `;
  const names = extractMoneyHelpers(src, 'x.ts').map((h) => h.name);
  assert.ok(names.includes('renderAmount'), 'a peso-returning function must be seen');
  assert.ok(!names.includes('formatPhp'), 'a money NAME over a non-money body is not a formatter');
  // saveThing IS seen (it returns a ₱ string) — that is why the size cap exists;
  // a real server action runs to hundreds of lines. Documented as limit 5.
  assert.ok(names.includes('saveThing'), 'the short stub is in range of the size cap');
});

test('T5 · a converter needs a unit-conversion NAME, not merely a money-ish one', () => {
  const src = `
    export function centavosToPhp(c: number) { return Math.round(c) / 100; }
    export function phpToCentavos(p: number) { return Math.round(p * 100); }
    export function bookingFeePhp(total: number) { return (total * 5) / 100; }
  `;
  const found = extractMoneyHelpers(src, 'x.ts');
  assert.deepEqual(
    found.map((h) => `${h.name}:${h.kind}`).sort(),
    ['centavosToPhp:converter', 'phpToCentavos:converter'],
    'bookingFeePhp computes a figure; it does not convert a unit',
  );
});

test('T6 · POSITIVE CONTROL FROM HISTORY — the two formatPhp bodies, as they shipped', () => {
  // Verbatim from lib/orders.ts and lib/budget.ts at origin/main on 2026-09-20.
  const orders = `
export function formatPhp(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const exact = n.toFixed(2);
  const dot = exact.lastIndexOf('.');
  const whole = exact.slice(0, dot);
  const centavos = exact.slice(dot + 1);
  const grouped = Number(whole).toLocaleString('en-PH', { maximumFractionDigits: 0 });
  return \`₱\${grouped}\${centavos === '00' ? '' : \`.\${centavos}\`}\`;
}`;
  const budget = `
export function formatPhp(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return \`₱\${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}\`;
}`;
  const a = extractMoneyHelpers(orders, 'lib/orders.ts');
  const b = extractMoneyHelpers(budget, 'lib/budget.ts');
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0]?.name, b[0]?.name, 'the collision is that they share a name');

  // And the rounding rule must separate them — THE WHOLE POINT. The exact one
  // also writes `maximumFractionDigits: 0`, on the WHOLE part after toFixed(2)
  // split the centavos off; a naive fraction rule flags it first.
  assert.equal(a[0]?.roundsToThePeso, false, 'the EXACT formatter must not be called a rounder');
  assert.equal(b[0]?.roundsToThePeso, true, 'the rounding formatter must be caught');
});

test('T7 · the marker is read from the docblock, which stripComments would blank', () => {
  const marked = `
/**
 * @rounds-to-the-peso a band, not a bill.
 */
export function bandLabel(n: number) { return \`₱\${Math.round(n)}\`; }`;
  const bare = `
/** Just a label. */
export function bandLabel(pesos: number) { return \`₱\${Math.round(pesos)}\`; }`;
  assert.equal(extractMoneyHelpers(marked, 'x.ts')[0]?.declaresRounding, true);
  assert.equal(extractMoneyHelpers(bare, 'x.ts')[0]?.declaresRounding, false);
  assert.equal(extractMoneyHelpers(bare, 'x.ts')[0]?.roundsToThePeso, true);
  // A marker in a comment NOT attached to the declaration must not count.
  const detached = `
/** ${ROUNDING_MARKER} — prose about something else entirely. */
const unrelated = 1;

export function bandLabel(pesos: number) { return \`₱\${Math.round(pesos)}\`; }`;
  assert.equal(extractMoneyHelpers(detached, 'x.ts')[0]?.declaresRounding, false);
  assert.equal(docblockAbove(detached, 5), '', 'no docblock sits above the declaration');
});

/* ═══ 8–9 · THE RATCHET ═════════════════════════════════════════════════════ */

test('R1 · no NEW pair of definitions shares a money-helper name', () => {
  const found = scanMoneyFormatters();
  const { r1 } = readMoneyBaseline();
  const allowed = new Set(r1);
  const fresh = found.collisions.filter((c) => !allowed.has(c.key));
  assert.deepEqual(
    fresh.map((c) => c.key),
    [],
    'a money helper is now defined twice under one name. A call site reads the same\n' +
      'either way, so this is a fork nobody can see in a diff. Consolidate into\n' +
      'lib/php.ts and RE-EXPORT the name from where its importers already look —\n' +
      'a re-export is not a definition and does not trip this rule.',
  );
  // `formatPhp` and `formatCentavosPhp` were paid down to zero on 2026-09-20.
  // They are NOT in the baseline, so a fourth one cannot quietly come back.
  for (const name of ['formatPhp', 'formatCentavosPhp', 'formatCentavos']) {
    assert.ok(
      !r1.some((k) => k.startsWith(`${name}\t`)),
      `${name} must never re-enter the baseline — it is settled`,
    );
  }
  // Stale rows are reported, never fatal: a peer PR fixing one must not turn
  // main red. (#5756 is fixing exactly the rows listed today.)
  const live = new Set(found.collisions.map((c) => c.key));
  const stale = r1.filter((k) => !live.has(k));
  if (stale.length > 0) console.log('R1 baseline rows now fixed — delete them:', stale);
});

test('R2 · a money helper that drops the centavos must say WHY, in its docblock', () => {
  const found = scanMoneyFormatters();
  const { r2 } = readMoneyBaseline();
  const allowed = new Set(r2);
  const fresh = found.undeclaredRounders.filter((h) => !allowed.has(rounderKey(h)));
  assert.deepEqual(
    fresh.map((h) => `${h.file}:${h.line} ${h.name}`),
    [],
    `this helper throws the centavos away with no \`${ROUNDING_MARKER}\` reason in its\n` +
      'docblock. Either it is money — point it at formatPhp / formatCentavosPhp in\n' +
      'lib/php.ts — or it is a target, band, benchmark or allocation, in which case\n' +
      'add the marker AND the sentence that says which. The marker is a reason, not\n' +
      'a licence; see lib/php.ts#formatPhpRounded for the shape.',
  );
  const live = new Set(found.undeclaredRounders.map(rounderKey));
  const stale = r2.filter((k) => !live.has(k));
  if (stale.length > 0) console.log('R2 baseline rows now fixed — delete them:', stale);
});

test('R1+R2 · the baseline may only SHRINK', () => {
  // The committed size on 2026-09-20, when `formatPhp` (4 definitions),
  // `formatCentavosPhp` (3) and `formatCentavos` (2) were paid down to zero and
  // seven rounding helpers were given reasons. Lower it when you pay a row down;
  // never raise it.
  // It has already gone 3 → 2: PR #5756 merged mid-review and deleted the one R2
  // row, so that row came out of the file in the same commit that noticed — which
  // is the behaviour this number exists to force.
  const COMMITTED_ROWS = 2;
  const { r1, r2 } = readMoneyBaseline();
  assert.ok(
    r1.length + r2.length <= COMMITTED_ROWS,
    `the baseline has grown to ${r1.length + r2.length} rows (committed: ${COMMITTED_ROWS}).\n` +
      'Adding a row is how this guard stops guarding. Fix the collision instead.',
  );
  // And the file must parse into keys the scan can actually produce.
  const shape = /^[^\t]+\t[^\t]+$/;
  for (const k of [...r1, ...r2]) assert.match(k, shape, `malformed baseline key: ${k}`);
});

/* ═══ 10 · ANTI-VACUITY ═════════════════════════════════════════════════════ */

test('T10 · the scan is not silently empty', () => {
  const r = scanMoneyFormatters();
  assert.ok(
    r.filesScanned >= MIN_FILES_SCANNED,
    `walked ${r.filesScanned} files, expected >= ${MIN_FILES_SCANNED}. A collapsed count ` +
      'makes every repo-wide assertion above vacuous — which is exactly how four ' +
      'copies of formatPhp survived.',
  );
  assert.ok(
    r.helpers.length >= MIN_HELPERS,
    `found only ${r.helpers.length} money helpers (expected >= ${MIN_HELPERS}); the ` +
      'detector has broken.',
  );
  // The app's two canonical ones must be among them, by file — if lib/php.ts
  // ever stops being seen, R1 can never fire again.
  const php = r.helpers.filter((h) => h.file === 'lib/php.ts').map((h) => h.name).sort();
  assert.deepEqual(
    php,
    ['formatCentavosPhp', 'formatPhp', 'formatPhpRounded'],
    'lib/php.ts is the one place these are defined; if the scan stops seeing a\n' +
      'name here, a SECOND definition of it could be added and R1 would never fire.\n' +
      '(That is not hypothetical: formatCentavosPhp delegates to formatPhp and\n' +
      'carries no ₱ of its own, so it was invisible until the second pass landed.)',
  );
  // Print what was searched, so a green run is legible rather than merely quiet.
  console.log(
    `money-formatter scan: ${r.filesScanned} files · ${r.helpers.length} helpers · ` +
      `${r.collisions.length} collisions · ${r.undeclaredRounders.length} undeclared rounders`,
  );
  assert.deepEqual(baselineKeys(r).length, r.collisions.length + r.undeclaredRounders.length);
});
