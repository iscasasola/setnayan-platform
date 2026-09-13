/**
 * the-plan-meets-the-ledger.test.ts — BA3's fence.
 *
 * The per-category ledger (`lib/budget-ledger.ts` → `BudgetLedgerTable`) puts
 * the couple's plan beside their signed money for the first time. Three ways
 * to quietly undo it, three properties, each facing one:
 *
 *   1 · A BUCKET CARRYING MONEY RENDERS NO ROW. The tempting cleanup is to hide
 *       rows that have no plan to compare against — which is exactly the ₱30,000
 *       of Cake, ₱45,000 of Cocktail Booths and ₱22,000 of Photobooth that prod
 *       event `947e7bab…` carries against no seeded benchmark (measured
 *       2026-09-03). Money would leave the page for lacking a price list.
 *   2 · AN UNSEEDED CATEGORY PRINTS ₱0 PLANNED. §18.5 rule 5. `?? 0` is one
 *       keystroke and it turns "we have never published a typical price for
 *       cakes" into "you budgeted nothing for your cake".
 *   3 · THE FOUR COLUMN NAMES DRIFT. Owner-locked: Planned · Agreed · Paid ·
 *       Owed, in that order, unabbreviated. The couple misread the previous
 *       labels; that is WHY they read this way.
 *
 * ── HOW THE SOURCE PROPERTIES PROVE THEY CAN SEE ────────────────────────────
 * A source guard that cannot match the line it was written to catch ships inert
 * and green. So every detector below is run against HAND-WRITTEN SABOTAGE as
 * well as against the real file: if the detector cannot fail, the test fails.
 *
 * ⚠ Comments are stripped with `stripComments` (`lib/strip-comments.ts`), the
 * ONE stripper. The two-replace regex that guards used to copy deletes real
 * code — a `/*` inside a string opens a window to the next real close — so a
 * scan can assert against blanked source and pass.
 * `scripts/lint-one-comment-stripper.mjs` fails CI on a home-grown one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  buildBudgetLedger,
  BUDGET_LEDGER_COLUMNS,
  BUDGET_LEDGER_COLUMN_HINTS,
} from '@/lib/budget-ledger';
import type { EventMoney, MoneyBucket, MoneyDue } from '@/lib/budget-truth';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const TABLE = '_components/budget-ledger-table.tsx';
const PAGE = 'app/dashboard/[eventId]/budget/page.tsx';

const tableSrc = () =>
  stripComments(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), TABLE), 'utf8'),
  );
const pageSrc = () => stripComments(readFileSync(resolve(WEB, PAGE), 'utf8'));

const count = (h: string, re: RegExp) => h.match(re)?.length ?? 0;

const NO_DUE: MoneyDue = {
  overduePhp: 0,
  overdueCount: 0,
  dueSoonPhp: 0,
  dueSoonCount: 0,
  upcomingPhp: 0,
  upcomingCount: 0,
  laterPhp: 0,
  laterCount: 0,
};

function bucket(bucketId: string, committedPhp: number, hasBenchmark: boolean): MoneyBucket {
  return {
    bucketId,
    label: bucketId,
    committedPhp,
    paidPhp: 0,
    stillOwedPhp: committedPhp,
    overpaidPhp: 0,
    estimatedPhp: 0,
    hasBenchmark,
    benchmarkPhp: hasBenchmark ? 100_000 : null,
    due: NO_DUE,
  };
}

function money(byBucket: MoneyBucket[]): EventMoney {
  return {
    targetPhp: 930_000,
    estimated: 0,
    committed: byBucket.reduce((s, b) => s + b.committedPhp, 0),
    paid: 0,
    stillOwed: byBucket.reduce((s, b) => s + b.stillOwedPhp, 0),
    overpaid: 0,
    isOverBudget: false,
    overBudgetByPhp: 0,
    // REQUIRED on EventMoney since PR #5105.
    due: NO_DUE,
    byBucket,
    lines: [],
    sources: [],
    warnings: [],
  };
}

/** The three unseeded, money-carrying categories on prod event 947e7bab…. */
const PROD_UNSEEDED = money([
  bucket('cake', 30_000, false),
  bucket('cocktail_booths', 45_000, false),
  bucket('photobooth', 22_000, false),
  bucket('catering', 225_000, true),
]);

// ── 1 · A BUCKET CARRYING MONEY ALWAYS GETS A ROW ───────────────────────────

test('every bucket carrying money gets a row — benchmark or not', () => {
  const { rows } = buildBudgetLedger({
    money: PROD_UNSEEDED,
    suggestedPhp: new Map([['catering', 450_000]]),
  });
  for (const b of PROD_UNSEEDED.byBucket) {
    assert.ok(
      rows.some((r) => r.bucketId === b.bucketId),
      `${b.bucketId} carries ₱${b.committedPhp} and rendered no row. Prod event ` +
        `947e7bab… has money in three categories with NO seeded benchmark; ` +
        `dropping the unplanned rows deletes it from the page.`,
    );
  }
});

test('the rendered list is every row the ledger built — no filter in between', () => {
  const src = tableSrc();
  // The one map over `rows`. A `.filter(` inserted before it is the sabotage.
  assert.equal(
    count(src, /\brows\s*\.\s*map\s*\(/g),
    1,
    `${TABLE} must map ledger.rows exactly once.`,
  );
  const detector = (s: string) => /\brows\b[^;]{0,80}?\.\s*(filter|slice)\s*\(/.test(s);
  assert.ok(
    detector('{rows.filter((r) => !r.unplanned).map((row) => ('),
    'the no-filter detector cannot see the sabotage it exists to catch',
  );
  assert.ok(detector('rows.slice(0, 8).map((row) => ('), 'detector blind to a top-N cap');
  assert.ok(
    !detector(src),
    `${TABLE} narrows ledger.rows before rendering. A category with money and ` +
      `no plan must still appear — that is §18.5 rule 5's whole subject.`,
  );
});

// ── 2 · AN UNSEEDED CATEGORY NEVER PRINTS ₱0 PLANNED ────────────────────────

test('a category with hasBenchmark === false never carries a ₱0 planned figure', () => {
  const { rows } = buildBudgetLedger({
    money: PROD_UNSEEDED,
    // The real production shape: `resolveAllocationInputs` filters unpriceable
    // leaves out entirely, so they are simply absent from the suggestion map.
    suggestedPhp: new Map([['catering', 450_000]]),
  });
  for (const b of PROD_UNSEEDED.byBucket) {
    if (b.hasBenchmark) continue;
    const row = rows.find((r) => r.bucketId === b.bucketId)!;
    assert.notEqual(
      row.plannedPhp,
      0,
      `${b.bucketId} has no seeded benchmark and planned ₱0. §18.5 rule 5: ` +
        `"no typical price yet", NEVER ₱0 — a zero says the couple budgeted ` +
        `nothing, which is a different and worse claim than "we don't know".`,
    );
    assert.equal(row.plannedPhp, null);
    assert.equal(row.unplanned, true);
  }
});

test('a ₱0 arriving from EITHER plan source is folded to null, never printed', () => {
  // The core makes the rule structural: no caller can produce a ₱0 Planned.
  for (const source of ['savedPlanPhp', 'suggestedPhp'] as const) {
    const { rows } = buildBudgetLedger({
      money: money([bucket('cake', 30_000, false)]),
      [source]: new Map([['cake', 0]]),
    });
    assert.equal(
      rows[0]!.plannedPhp,
      null,
      `a ₱0 from ${source} became a planned figure. Zero is not a plan.`,
    );
  }
});

test('the Planned cell renders "—" for an unplanned row, never a defaulted ₱0', () => {
  const src = tableSrc();

  /**
   * ⚠ THE WINDOW MUST FACE THE SABOTAGE. A defaulted zero would land in the
   * `value=` expression of the Planned cell, which is the text that FOLLOWS
   * `label={BUDGET_LEDGER_COLUMNS[0]}`. Slicing from anywhere else — the top of
   * the file, the row header — cannot see it, and the guard would ship inert.
   *
   * A bare `?? 0` elsewhere in the file is legitimate: the progress bar needs a
   * number for its geometry and never prints one. Only a PRINTED zero is the
   * lie, so the window is the printed cell and nothing else.
   */
  /**
   * ⚠ EVERY window, not the first one. Written with `indexOf` this guard faced
   * the TOTALS cell (source line ~82) while the sabotage lands in the ROW cell
   * (~144) — it passed its own mutation test green and would have shipped
   * inert. Both cells print a Planned figure, so both are scanned.
   */
  const plannedCells = (s: string): string[] => {
    const out: string[] = [];
    const needle = 'BUDGET_LEDGER_COLUMNS[0]';
    for (let i = s.indexOf(needle); i !== -1; i = s.indexOf(needle, i + 1)) {
      out.push(s.slice(i, i + 320));
    }
    return out;
  };
  const detector = (s: string) =>
    plannedCells(s).some(
      (w) => /plannedPhp\s*(\?\?|\|\|)\s*0\b/.test(w) || /formatPhp\(\s*0\s*\)/.test(w),
    );

  const SABOTAGE = [
    "label={BUDGET_LEDGER_COLUMNS[0]}\n value={formatPhp(row.plannedPhp ?? 0)}\n note={x}",
    "label={BUDGET_LEDGER_COLUMNS[0]}\n value={formatPhp(row.plannedPhp || 0)}\n note={x}",
    "label={BUDGET_LEDGER_COLUMNS[0]}\n value={row.plannedPhp === null ? formatPhp(0) : formatPhp(row.plannedPhp)}",
    // The one that got past the first version of this guard: a clean totals
    // cell FIRST, the sabotage in the second cell.
    "label={BUDGET_LEDGER_COLUMNS[0]}\n value={formatPhp(totals.plannedPhp)}\n" +
      'x'.repeat(400) +
      "\nlabel={BUDGET_LEDGER_COLUMNS[0]}\n value={formatPhp(row.plannedPhp ?? 0)}",
  ];
  for (const bad of SABOTAGE) {
    assert.ok(detector(bad), `the ₱0 detector cannot see: ${bad.slice(0, 70)}…`);
  }
  // …and it is looking at BOTH places a Planned figure is printed: the per-row
  // cell and the totals cell. One window means the other stopped being scanned.
  assert.equal(
    plannedCells(src).length,
    2,
    `${TABLE} labels ${plannedCells(src).length} cell(s) with BUDGET_LEDGER_COLUMNS[0]; ` +
      `this guard scans every one, and expects the row cell and the totals cell.`,
  );

  assert.ok(
    !detector(src),
    `${TABLE} prints a defaulted ₱0 for Planned. §18.5 rule 5 — unknown is ` +
      `unknown. "You budgeted nothing for your cake" is a different and worse ` +
      `claim than "we have not published a typical cake price".`,
  );
  // And the em-dash branch is really there.
  for (const w of plannedCells(src)) {
    assert.ok(
      /plannedPhp\s*===\s*null\s*\?\s*'—'/.test(w),
      `${TABLE} has a Planned cell with no "—" branch:\n${w.slice(0, 160)}`,
    );
  }
});

// ── 3 · THE FOUR NAMES ──────────────────────────────────────────────────────

test('the columns are Planned · Agreed · Paid · Owed, in that order', () => {
  assert.deepEqual(
    [...BUDGET_LEDGER_COLUMNS],
    ['Planned', 'Agreed', 'Paid', 'Owed'],
    `Owner-locked, and the ORDER is part of it: Planned (what you budgeted) · ` +
      `Agreed (what you signed for) · Paid (handed over so far) · Owed (agreed ` +
      `minus paid). The couple misread the previous labels — that is why these ` +
      `read this way. Do not abbreviate and do not reorder.`,
  );
});

test('each column keeps its gloss, and none is abbreviated', () => {
  assert.deepEqual(BUDGET_LEDGER_COLUMN_HINTS, {
    Planned: 'What you budgeted',
    Agreed: 'What you signed for',
    Paid: 'Handed over so far',
    Owed: 'Agreed minus paid',
  });
  for (const col of BUDGET_LEDGER_COLUMNS) {
    assert.ok(
      /^[A-Z][a-z]+$/.test(col),
      `"${col}" is not a whole word. "Agr." / "Bal." / "Amt" are the drift this ` +
        `refuses — the labels are what the couple reads.`,
    );
  }
});

test('the table spells no column heading of its own', () => {
  const src = tableSrc();
  // Every heading must come from the constant, so there is ONE place to change.
  const refs = count(src, /\bBUDGET_LEDGER_COLUMNS\b/g);
  assert.ok(
    refs >= 9,
    `${TABLE} reads BUDGET_LEDGER_COLUMNS only ${refs} time(s); the header row, ` +
      `the four per-row cells and the four totals all need it.`,
  );

  const HEADINGS = String.raw`Planned|Agreed|Paid|Owed|Agr\.?|Amt\.?|Bal\.?|Balance|Budgeted|Spent`;
  const detector = (s: string) =>
    new RegExp(String.raw`label\s*=\s*\{?\s*['"](?:${HEADINGS})['"]`).test(s) ||
    new RegExp(String.raw`<(?:dt|th)[^>]*>\s*(?:${HEADINGS})\s*<`).test(s);
  assert.ok(detector('<dt>Agr.</dt>'), 'detector blind to an abbreviated literal heading');
  assert.ok(detector('label="Paid"'), 'detector blind to a hardcoded label prop');
  assert.ok(detector("label={'Owed'}"), 'detector blind to a braced literal');
  assert.ok(detector('<th scope="col">Spent</th>'), 'detector blind to a renamed table head');
  assert.ok(
    !detector(src),
    `${TABLE} hardcodes a column heading. It must read BUDGET_LEDGER_COLUMNS — ` +
      `a second spelling is how the head and the foot of the table start ` +
      `disagreeing about what a number means.`,
  );
});

// ── 4 · THE MEASUREMENT REACHES THE RENDER ──────────────────────────────────
/**
 * A log line never changed a pixel. `byBucket` was computed on every load of
 * this page and read by nothing; the point of BA3 is that it now reaches a
 * human. These two assert the wiring itself, which properties 1–3 cannot see.
 */

test('the page builds the ledger and mounts it', () => {
  const src = pageSrc();
  assert.equal(
    count(src, /\bbuildBudgetLedger\s*\(/g),
    1,
    `${PAGE} must build the ledger through buildBudgetLedger() — once.`,
  );
  assert.ok(
    /<BudgetLedgerTable\b/.test(src),
    `${PAGE} builds the ledger and never renders it. That is the whole defect ` +
      `this slice closes: a measurement that reaches no pixel.`,
  );
  assert.ok(
    /\bfetchSavedAllocationPlan\s*\(/.test(src),
    `${PAGE} must read the couple's OWN saved plan; otherwise a saved figure is ` +
      `silently overwritten by our suggestion.`,
  );
});

test('the ledger is absent — not zeroed — when the resolver gives nothing', () => {
  const src = pageSrc();
  assert.ok(
    /const\s+ledger\s*=\s*money\s*\n?\s*\?\s*buildBudgetLedger/.test(src),
    `${PAGE} must gate the ledger on \`money\`. With no resolver there is no ` +
      `per-category truth, and a table of confident ₱0s is the one failure ` +
      `mode a money page must never have.`,
  );
});

test('the wedding-shaped suggestion never reaches a non-wedding event', () => {
  /**
   * `budget_leaf_benchmarks` IS the wedding budget taxonomy, and it is read
   * unconditionally by `resolveAllocationInputs`. Every other event type that
   * enables this surface — birthday, debut, christening, wake — carries
   * `budgetTaxonomyKey: null`, which is why the "Suggested budget split" above
   * renders for weddings only. Ungated, the ledger would print a ₱450,000
   * catering plan on a debut, out of a table that does not describe it.
   */
  const src = pageSrc();
  const detector = (s: string) =>
    /\bsuggestedPlanPhp\b[\s\S]{0,200}?\bif\s*\(\s*isWeddingBudget\s*&&/.test(s);
  assert.ok(
    detector('const suggestedPlanPhp = new Map();\n  if (isWeddingBudget && allocInputs.budgetPhp != null) {'),
    'the wedding-gate detector cannot see the gate it exists to require',
  );
  assert.ok(
    !detector('const suggestedPlanPhp = new Map();\n  if (allocInputs.budgetPhp != null) {'),
    'the wedding-gate detector passes an UNGATED build — it proves nothing',
  );
  assert.ok(
    detector(src),
    `${PAGE} fills the suggested plan without checking isWeddingBudget. Those ` +
      `benchmarks are the wedding taxonomy; a debut would be shown a plan it ` +
      `never made. Leave Planned as "—" instead — that is the truth.`,
  );
});

// ── 5 · NO QUOTES, STILL (BA2 is not undone by a new table) ─────────────────

test('the ledger prints no estimate — BA2 holds', () => {
  // `estimatedPhp` is carried on the row on purpose (the Merkado lens and the
  // checklist read the same field) and must NOT be rendered here.
  const src = tableSrc();
  assert.ok(
    !/\{[^}]*\bestimatedPhp\b[^}]*\}/.test(src) && !/formatPhp\([^)]*estimatedPhp/.test(src),
    `${TABLE} renders an estimate. Owner 2026-09-02: "no quotes here. we only ` +
      `add the finalized budgets." Quotes belong in the Merkado.`,
  );
});

test('the ledger’s Agreed column is the resolver’s committed money, nothing else', () => {
  const { rows } = buildBudgetLedger({
    money: money([
      { ...bucket('catering', 225_000, true), estimatedPhp: 800_000 },
    ]),
    suggestedPhp: new Map([['catering', 450_000]]),
  });
  assert.equal(
    rows[0]!.agreedPhp,
    225_000,
    'an ₱800,000 quote leaked into Agreed. Agreed is what was SIGNED for.',
  );
});
